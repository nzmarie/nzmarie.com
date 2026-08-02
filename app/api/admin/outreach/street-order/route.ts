import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { clusterStreets, StreetPoint } from '@/lib/street-clustering';

const KEY_PREFIX = 'outreach_street_order:';
const MAX_ORDER_STREETS = 500;

interface StreetRow {
  street: string;
  address_count: string | number;
  has_coords: boolean | string;
  center_lat: string | number | null;
  center_lng: string | number | null;
}

function parseOrder(value: string | null): string[] {
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

function buildUnsentCondition(
  params: unknown[],
  idx: number,
  suburb: string,
  reportQuarter: string | null
): string {
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
    }
  }
  return `AND NOT EXISTS (${sub})`;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const status = searchParams.get('status') || 'pending';
  const reportQuarter = searchParams.get('report_quarter');
  const radius = Math.min(
    2000,
    Math.max(100, parseInt(searchParams.get('radius') || '500', 10) || 500)
  );

  if (!suburb) {
    return NextResponse.json({ error: 'Missing suburb parameter' }, { status: 400 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();

    const params: unknown[] = [suburb, status];
    const sentCondition = buildUnsentCondition(params, 3, suburb, reportQuarter);

    const { rows } = await marieDB.query(
      `
      SELECT
        op.street,
        COUNT(*) AS address_count,
        BOOL_OR(sl.center_lat IS NOT NULL AND sl.center_lng IS NOT NULL) AS has_coords,
        sl.center_lat,
        sl.center_lng
      FROM outreach_properties op
      LEFT JOIN street_locations sl
        ON sl.suburb = op.suburb AND sl.street = op.street
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.suburb = $1
        AND op.status = $2
        AND op.street IS NOT NULL
        AND TRIM(op.street) <> ''
        AND (p.no_junk_mail = false OR p.no_junk_mail IS NULL)
        ${sentCondition}
      GROUP BY op.street, sl.center_lat, sl.center_lng
      ORDER BY op.street ASC
      `,
      params
    );

    const streetRows = rows as unknown as StreetRow[];

    const streets = streetRows.map((r) => ({
      street: r.street,
      suburb,
      address_count: Number(r.address_count) || 0,
      has_coords: Boolean(r.has_coords),
    }));

    const stored = await marieDB.query(
      `SELECT setting_value FROM admin_settings WHERE setting_key = $1 LIMIT 1`,
      [`${KEY_PREFIX}${suburb}`]
    );
    const rawOrder = parseOrder(stored?.rows?.[0]?.setting_value ?? null);
    const streetSet = new Set(streets.map((s) => s.street));
    const savedOrder = rawOrder.filter((s) => streetSet.has(s));

    let ordered: string[] = [];

    if (savedOrder.length > 0) {
      const known = new Set(savedOrder);
      const rest = streets
        .filter((s) => !known.has(s.street))
        .map((s) => s.street)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      ordered = [...savedOrder, ...rest];
    } else {
      const points: StreetPoint[] = streetRows
        .filter((r) => r.center_lat != null && r.center_lng != null)
        .map((r) => ({
          street: r.street,
          suburb,
          lat: Number(r.center_lat),
          lng: Number(r.center_lng),
          pendingCount: Number(r.address_count) || 0,
        }));
      const groups = clusterStreets(points, radius);
      const clustered = groups.flatMap((g) => g.streets.map((s) => s.street));
      const known = new Set(clustered);
      const noCoord = streets
        .filter((s) => !known.has(s.street))
        .map((s) => s.street)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      ordered = [...clustered, ...noCoord];
    }

    const orderIndex = new Map(ordered.map((name, i) => [name, i]));
    const orderedStreets = [...streets].sort((a, b) => {
      const ia = orderIndex.get(a.street);
      const ib = orderIndex.get(b.street);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return a.street.localeCompare(b.street, undefined, { sensitivity: 'base' });
    });

    return NextResponse.json({
      success: true,
      suburb,
      streets: orderedStreets,
      savedOrder,
      hasSavedOrder: savedOrder.length > 0,
    });
  } catch (error) {
    console.error('Error fetching street order:', error);
    return NextResponse.json({ error: 'Failed to fetch street order' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let suburb = '';
  let streets: unknown = [];
  try {
    const body = await request.json();
    suburb = typeof body?.suburb === 'string' ? body.suburb.trim() : '';
    streets = body?.streets;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!suburb) {
    return NextResponse.json({ error: 'suburb is required' }, { status: 400 });
  }
  if (!Array.isArray(streets)) {
    return NextResponse.json({ error: 'streets must be an array' }, { status: 400 });
  }

  const seen = new Set<string>();
  const clean: string[] = [];
  for (const s of streets) {
    if (typeof s !== 'string') continue;
    const trimmed = s.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    clean.push(trimmed);
    if (clean.length >= MAX_ORDER_STREETS) break;
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const value = JSON.stringify(clean);
    await marieDB.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_at = NOW(), updated_by = $3`,
      [`${KEY_PREFIX}${suburb}`, value, session.user.email]
    );
    return NextResponse.json({ success: true, suburb, order: clean });
  } catch (error) {
    console.error('Error saving street order:', error);
    return NextResponse.json({ error: 'Failed to save street order' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');

  if (!suburb) {
    return NextResponse.json({ error: 'Missing suburb parameter' }, { status: 400 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    await marieDB.query(
      `DELETE FROM admin_settings WHERE setting_key = $1`,
      [`${KEY_PREFIX}${suburb}`]
    );
    return NextResponse.json({ success: true, suburb });
  } catch (error) {
    console.error('Error clearing street order:', error);
    return NextResponse.json({ error: 'Failed to clear street order' }, { status: 500 });
  }
}
