import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { buildOutreachFilter } from '@/lib/outreach-filter';
import { buildStreetSummaries, toOrderable, AddressRow } from '@/lib/outreach-streets';
import { orderStreetsGreedily } from '@/lib/street-ordering';
import { splitOrderedStreets, StreetPoint } from '@/lib/street-clustering';
import {
  reorderStreetClustersForStart,
  StreetClusterPayload,
} from '@/lib/street-cluster-reorder';
import {
  streetClustersKey,
  getStreetClustersFromCache,
  setStreetClustersInCache,
} from '@/lib/redis';

const STREET_ORDER_KEY_PREFIX = 'outreach_street_order:';

function parseStreetOrder(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    }
  } catch {
    // ignore malformed values
  }
  return [];
}

/**
 * GET /api/admin/outreach/street-clusters
 * Returns streets in a suburb ordered by nearest walking distance
 * (greedy nearest-neighbor from the minimum house number address of
 * each street), split into budget-sized runs for the "Today's Run" planner.
 *
 * Query params:
 *   - suburb: suburb to plan (required)
 *   - radius: kept for API compatibility (no longer used for ordering)
 *   - budget: run budget - number of addresses per run (default 20)
 *   - start_street: optional street to start the route from (defaults to the
 *     street with the globally smallest house number)
 *   - status: which status to count (default 'pending')
 *   - sent_status: 'all' | 'sent' | 'unsent'
 *   - report_quarter: optional quarter filter, e.g. '2026-Q2'
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const radius = Math.min(
    2000,
    Math.max(100, parseInt(searchParams.get('radius') || '500', 10) || 500)
  );
  const budget = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('budget') || '20', 10) || 20)
  );
  const status = searchParams.get('status') || 'pending';
  const sentStatus = (searchParams.get('sent_status') || 'all') as 'all' | 'unsent' | 'sent';
  const reportQuarter = searchParams.get('report_quarter');
  const startStreet = searchParams.get('start_street') || '';

  if (!suburb) {
    return NextResponse.json({ error: 'Missing suburb parameter' }, { status: 400 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();

    // ── Cache lookup (Upstash, TTL 30 min) ────────────────────────────────────
    // start_street is intentionally excluded from the key: changing the start
    // only reorders the existing streets, it doesn't change pending counts.
    // We still serve cached data but it will be reordered client-side if needed.
    const cacheKey = streetClustersKey(suburb, status, sentStatus, reportQuarter ?? null, budget);
    const cached = await getStreetClustersFromCache<StreetClusterPayload>(cacheKey);
    if (cached) {
      // start_street is intentionally excluded from the cache key (changing the
      // start only reorders the existing streets, it doesn't change pending
      // counts), so re-apply the requested start to the cached order here.
      if (startStreet) {
        return NextResponse.json(reorderStreetClustersForStart(cached, startStreet));
      }
      return NextResponse.json(cached);
    }

    // ── Cache miss — compute from DB ──────────────────────────────────────────
    const { sql: where, params } = buildOutreachFilter({
      suburb,
      status,
      sentStatus,
      reportQuarter,
    });

    const { rows: addressRows } = await marieDB.query(
      `
      SELECT op.street, op.house_number, op.property_address,
             p.latitude AS lat, p.longitude AS lng
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE ${where}
      ORDER BY op.street ASC, op.house_number ASC NULLS LAST, op.property_address ASC
      `,
      params
    );

    const summaries = buildStreetSummaries(addressRows as AddressRow[], suburb);

    const storedOrder = await marieDB.query(
      `SELECT setting_value FROM admin_settings WHERE setting_key = $1 LIMIT 1`,
      [`${STREET_ORDER_KEY_PREFIX}${suburb}`]
    );
    const savedOrder = parseStreetOrder(storedOrder?.rows?.[0]?.setting_value ?? null);
    const streetNames = new Set(summaries.map((s) => s.street));
    const validOrder = savedOrder.filter((s) => streetNames.has(s));

    let orderedSummaries = summaries;
    if (validOrder.length > 0) {
      const orderIndex = new Map<string, number>();
      validOrder.forEach((name, i) => orderIndex.set(name, i));
      orderedSummaries = [...summaries].sort((a, b) => {
        const ia = orderIndex.get(a.street);
        const ib = orderIndex.get(b.street);
        if (ia !== undefined && ib !== undefined) return ia - ib;
        if (ia !== undefined) return -1;
        if (ib !== undefined) return 1;
        return a.street.localeCompare(b.street, undefined, { sensitivity: 'base' });
      });
    } else {
      const order = orderStreetsGreedily(summaries.map(toOrderable), startStreet || undefined);
      const orderIndex = new Map(order.map((name, i) => [name, i]));
      orderedSummaries = [...summaries].sort(
        (a, b) => (orderIndex.get(a.street) ?? 0) - (orderIndex.get(b.street) ?? 0)
      );
    }

    const streetPoints: StreetPoint[] = orderedSummaries.map((s) => ({
      street: s.street,
      suburb,
      lat: s.anchorLat ?? 0,
      lng: s.anchorLng ?? 0,
      pendingCount: s.address_count,
      addresses: s.addresses,
    }));

    const groups = [
      {
        groupId: 1,
        streets: streetPoints,
        totalPending: orderedSummaries.reduce((sum, s) => sum + s.address_count, 0),
        extentMeters: 0,
      },
    ];
    const runs = splitOrderedStreets(streetPoints, budget);

    const noAnchorStreets = summaries.filter((s) => s.anchorLat == null || s.anchorLng == null);

    const responsePayload = {
      success: true,
      radius,
      budget,
      suburb,
      groups,
      runs: runs.map((run, i) => ({
        runId: i + 1,
        groups: run,
        totalPending: run.reduce((s, g) => s + g.totalPending, 0),
        streetCount: run.reduce((s, g) => s + g.streets.length, 0),
      })),
      unclusteredStreets: noAnchorStreets.map((s) => ({
        street: s.street,
        has_coords: s.has_coords,
      })),
      startStreet: orderedSummaries[0]?.street ?? null,
      allStreets: summaries
        .map((s) => ({ street: s.street, count: s.address_count }))
        .sort((a, b) => a.street.localeCompare(b.street, undefined, { sensitivity: 'base' })),
      manualOrder: validOrder.length > 0,
      manualOrderCount: validOrder.length,
    };

    // Write to cache asynchronously — don't block the response
    setStreetClustersInCache(cacheKey, responsePayload).catch(() => { });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error fetching street clusters:', error);
    return NextResponse.json({ error: 'Failed to fetch street clusters' }, { status: 500 });
  }
}
