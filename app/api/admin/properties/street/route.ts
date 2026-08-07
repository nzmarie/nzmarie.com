import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { extractStreetNameFromAddress, parseHouseNumber, orderStreetsGreedily } from '@/lib/street-ordering';
import { buildStreetSummaries, toOrderable } from '@/lib/outreach-streets';

const STREET_PREFIX = 'properties_start_street:';
const DEFAULT_STREET_LIMIT = 20;
const MAX_STREET_LIMIT = 500;

interface StreetRow {
  address: string;
  lat: string | null;
  lng: string | null;
}

async function fetchSavedStart(suburb: string): Promise<string> {
  try {
    const res = await query<{ setting_value: string }>(
      `SELECT setting_value FROM admin_settings WHERE setting_key = $1 LIMIT 1`,
      [`${STREET_PREFIX}${suburb}`]
    );
    return res?.rows?.[0]?.setting_value ?? '';
  } catch {
    return '';
  }
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb') ?? '';
  const requestedStart = searchParams.get('start') ?? '';
  const search = searchParams.get('search') ?? '';
  const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const requestedLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_STREET_LIMIT), 10);
  const inputLimit = Number.isNaN(requestedLimit) ? DEFAULT_STREET_LIMIT : requestedLimit;
  const limit = Math.max(1, Math.min(inputLimit, MAX_STREET_LIMIT));
  const offset = Number.isNaN(offsetParam) ? (page - 1) * limit : Math.max(0, offsetParam);

  if (!suburb.trim()) {
    return NextResponse.json({ error: 'Missing suburb parameter' }, { status: 400 });
  }

  try {
    const result = await query<StreetRow>(
      `SELECT RTRIM(REGEXP_REPLACE(p.address, '\\d{7,}$', '')) AS address,
              p.latitude AS lat,
              p.longitude AS lng
       FROM properties p
       WHERE LOWER(p.suburb) = LOWER($1)
       ORDER BY p.address ASC`,
      [suburb]
    );

    const rows = (result.rows || [])
      .map((r) => ({
        street: extractStreetNameFromAddress(r.address),
        house_number: parseHouseNumber(r.address),
        property_address: r.address,
        lat: r.lat != null && r.lng != null ? r.lat : null,
        lng: r.lat != null && r.lng != null ? r.lng : null,
      }))
      .filter((r) => r.street !== 'Unknown Street');

    const summaries = buildStreetSummaries(rows, suburb);

    const alphaFirst =
      summaries.length > 0
        ? [...summaries].sort((a, b) => a.street.localeCompare(b.street, undefined, { sensitivity: 'base' }))[0].street
        : '';

    const savedStart = await fetchSavedStart(suburb);
    const start = requestedStart || savedStart || alphaFirst;

    const orderedNames = orderStreetsGreedily(summaries.map(toOrderable), start || undefined);

    const countMap = new Map(summaries.map((s) => [s.street, s.address_count]));

    let streetList = orderedNames.map((street) => ({ street, count: countMap.get(street) ?? 0 }));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      streetList = streetList.filter((s) => s.street.toLowerCase().includes(q));
    }

    const totalStreets = streetList.length;
    const window = streetList.slice(offset, offset + limit);
    const nextOffset = offset + window.length < totalStreets ? offset + window.length : null;

    return NextResponse.json({
      success: true,
      suburb,
      start: start || null,
      saved_start: savedStart || null,
      totalStreets,
      streets: window,
      offset,
      limit,
      next_offset: nextOffset,
      has_next: nextOffset !== null,
    });
  } catch (error) {
    console.error('Error fetching property streets:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch property streets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let suburb = '';
  let start = '';
  try {
    const body = await request.json();
    suburb = typeof body?.suburb === 'string' ? body.suburb.trim() : '';
    start = typeof body?.start === 'string' ? body.start.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!suburb) {
    return NextResponse.json({ error: 'suburb is required' }, { status: 400 });
  }
  if (!start) {
    return NextResponse.json({ error: 'start street is required' }, { status: 400 });
  }

  try {
    await query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_at = NOW(), updated_by = $3`,
      [`${STREET_PREFIX}${suburb}`, start, session.user.email]
    );
    return NextResponse.json({ success: true, suburb, start });
  } catch (error) {
    console.error('Error saving start street:', error);
    return NextResponse.json({ error: 'Failed to save start street' }, { status: 500 });
  }
}