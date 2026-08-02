import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { clusterStreets, splitRuns, splitOrderedStreets, StreetPoint } from '@/lib/street-clustering';

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
 * Returns streets in a suburb clustered by proximity, with pending counts,
 * ready for the "Today's Run" planner.
 *
 * Query params:
 *   - suburb: suburb to cluster (required)
 *   - radius: clustering radius in meters (default 500)
 *   - budget: run budget - number of addresses per run (default 20)
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
  const sentStatus = searchParams.get('sent_status') || 'all';
  const reportQuarter = searchParams.get('report_quarter');

  if (!suburb) {
    return NextResponse.json({ error: 'Missing suburb parameter' }, { status: 400 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();

    const params: unknown[] = [suburb, status];
    let idx = 3;

    let sentCondition = '';
    if (sentStatus === 'unsent' || sentStatus === 'sent') {
      const exists = sentStatus === 'sent' ? 'EXISTS' : 'NOT EXISTS';
      let sub = `SELECT 1 FROM outreach_send_logs sl3
        JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id
        WHERE sl3.outreach_property_id = op.id
          AND sr3.suburb = $${idx}`;
      params.push(suburb);
      idx++;
      if (reportQuarter) {
        const parts = reportQuarter.split('-');
        if (parts.length === 2) {
          const y = parseInt(parts[0], 10);
          sub += ` AND sr3.quarter = $${idx} AND sr3.year = $${idx + 1}`;
          params.push(parts[1], isNaN(y) ? 0 : y);
          idx += 2;
        }
      }
      sentCondition = `AND ${exists} (${sub})`;
    }

    const { rows: addressRows } = await marieDB.query(
      `
      SELECT
        op.street,
        op.property_address,
        sl.center_lat AS lat,
        sl.center_lng AS lng
      FROM outreach_properties op
      JOIN street_locations sl
        ON sl.suburb = op.suburb
        AND sl.street = op.street
        AND sl.center_lat IS NOT NULL
        AND sl.center_lng IS NOT NULL
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.suburb = $1
        AND op.status = $2
        AND op.street IS NOT NULL
        AND TRIM(op.street) <> ''
        AND (p.no_junk_mail = false OR p.no_junk_mail IS NULL)
        ${sentCondition}
      ORDER BY op.street ASC, op.property_address ASC
      `,
      params
    );

    const streetMap = new Map<string, { lat: number; lng: number; addresses: string[] }>();
    for (const r of addressRows) {
      if (!streetMap.has(r.street)) {
        streetMap.set(r.street, { lat: Number(r.lat), lng: Number(r.lng), addresses: [] });
      }
      streetMap.get(r.street)!.addresses.push(r.property_address);
    }

    const streetPoints: StreetPoint[] = Array.from(streetMap.entries()).map(([street, data]) => ({
      street,
      suburb,
      lat: data.lat,
      lng: data.lng,
      pendingCount: data.addresses.length,
      addresses: data.addresses,
    }));

    const noCoordParams: unknown[] = [suburb, status];
    let noCoordIdx = 3;
    let noCoordSentCondition = '';

    if (sentStatus === 'unsent' || sentStatus === 'sent') {
      const exists = sentStatus === 'sent' ? 'EXISTS' : 'NOT EXISTS';
      let sub = `SELECT 1 FROM outreach_send_logs sl3
        JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id
        WHERE sl3.outreach_property_id = op.id
          AND sr3.suburb = $${noCoordIdx}`;
      noCoordParams.push(suburb);
      noCoordIdx++;
      if (reportQuarter) {
        const parts = reportQuarter.split('-');
        if (parts.length === 2) {
          const y = parseInt(parts[0], 10);
          sub += ` AND sr3.quarter = $${noCoordIdx} AND sr3.year = $${noCoordIdx + 1}`;
          noCoordParams.push(parts[1], isNaN(y) ? 0 : y);
          noCoordIdx += 2;
        }
      }
      noCoordSentCondition = `AND ${exists} (${sub})`;
    }

    const { rows: noCoords } = await marieDB.query(
      `
      SELECT op.street, COUNT(*) AS address_count
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.suburb = $1
        AND op.status = $2
        AND op.street IS NOT NULL
        AND TRIM(op.street) <> ''
        AND (p.no_junk_mail = false OR p.no_junk_mail IS NULL)
        ${noCoordSentCondition}
        AND NOT EXISTS (
          SELECT 1 FROM street_locations sl
          WHERE sl.suburb = op.suburb AND sl.street = op.street
        )
      GROUP BY op.street
      ORDER BY op.street ASC
      `,
      noCoordParams
    );

    const storedOrder = await marieDB.query(
      `SELECT setting_value FROM admin_settings WHERE setting_key = $1 LIMIT 1`,
      [`${STREET_ORDER_KEY_PREFIX}${suburb}`]
    );
    const savedOrder = parseStreetOrder(storedOrder?.rows?.[0]?.setting_value ?? null);
    const validOrder = savedOrder.filter((s) => streetMap.has(s));

    let groups;
    let runs;
    let manualOrder = false;
    let manualOrderCount = 0;

    if (validOrder.length > 0) {
      manualOrder = true;
      manualOrderCount = validOrder.length;

      const orderIndex = new Map<string, number>();
      validOrder.forEach((name, i) => orderIndex.set(name, i));

      const noCoordPoints: StreetPoint[] = noCoords.map((r) => ({
        street: r.street,
        suburb,
        lat: 0,
        lng: 0,
        pendingCount: Number(r.address_count) || 0,
        addresses: [],
      }));

      const combined = [...streetPoints, ...noCoordPoints].sort((a, b) => {
        const ia = orderIndex.get(a.street);
        const ib = orderIndex.get(b.street);
        if (ia !== undefined && ib !== undefined) return ia - ib;
        if (ia !== undefined) return -1;
        if (ib !== undefined) return 1;
        return a.street.localeCompare(b.street, undefined, { sensitivity: 'base' });
      });

      groups = [
        {
          groupId: 1,
          streets: combined,
          totalPending: combined.reduce((s, st) => s + st.pendingCount, 0),
          extentMeters: 0,
        },
      ];
      runs = splitOrderedStreets(combined, budget);
    } else {
      groups = clusterStreets(streetPoints, radius);
      runs = splitRuns(groups, budget);
    }

    return NextResponse.json({
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
      unclusteredStreets: noCoords.map((r) => ({
        street: r.street,
        has_coords: false,
      })),
      manualOrder,
      manualOrderCount,
    });
  } catch (error) {
    console.error('Error fetching street clusters:', error);
    return NextResponse.json({ error: 'Failed to fetch street clusters' }, { status: 500 });
  }
}
