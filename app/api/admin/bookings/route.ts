import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { findLocationBySuburb } from '@/lib/geo-data';

// Cache whether region/city columns exist to avoid checking every request
let hasLocationColumns: boolean | null = null;

function hasMeaningfulLocationValue(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() !== 'unknown';
}

async function checkLocationColumns(): Promise<boolean> {
  if (hasLocationColumns !== null) return hasLocationColumns;
  try {
    const result = await marieDB.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'appraisal_leads'
        AND column_name IN ('region', 'city')
    `);
    hasLocationColumns = result.rows.length === 2;
  } catch {
    hasLocationColumns = false;
  }
  return hasLocationColumns;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  // Check whether region/city columns exist before filtering/selecting them
  const useLocationColumns = await checkLocationColumns();

  let query = `SELECT * FROM appraisal_leads WHERE 1=1`;
  const params: unknown[] = [];
  let idx = 1;

  // Only apply region/city filters if columns exist
  if (useLocationColumns) {
    if (region) {
      query += ` AND COALESCE(region, '') = $${idx++}`;
      params.push(region);
    }
    if (city) {
      query += ` AND COALESCE(city, '') = $${idx++}`;
      params.push(city);
    }
  }

  if (suburb) {
    if (suburb === 'Other') {
      query += ` AND (suburb IS NULL OR suburb = '')`;
    } else {
      query += ` AND COALESCE(suburb, '') = $${idx++}`;
      params.push(suburb);
    }
  }
  if (status) {
    query += ` AND contact_status = $${idx++}`;
    params.push(status);
  }
  if (priority) {
    query += ` AND priority = $${idx++}`;
    params.push(priority);
  }
  if (search) {
    let searchClause = `(
      client_name ILIKE $${idx}
      OR email ILIKE $${idx}
      OR phone ILIKE $${idx}
      OR property_address ILIKE $${idx}
      OR COALESCE(suburb, '') ILIKE $${idx}
    `;
    if (useLocationColumns) {
      searchClause += ` OR COALESCE(region, '') ILIKE $${idx} OR COALESCE(city, '') ILIKE $${idx}`;
    }
    searchClause += `)`;
    query += ` AND ${searchClause}`;
    params.push(`%${search}%`);
    idx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  try {
    const result = await marieDB.query(query, params);

    const mappedRows = result.rows.map(row => {
      const fallbackLocation = !hasMeaningfulLocationValue(row.region) || !hasMeaningfulLocationValue(row.city)
        ? findLocationBySuburb(row.suburb || '')
        : null;

      return {
        ...row,
        region: useLocationColumns ? (hasMeaningfulLocationValue(row.region) ? row.region : fallbackLocation?.region || null) : null,
        city: useLocationColumns ? (hasMeaningfulLocationValue(row.city) ? row.city : fallbackLocation?.city || null) : null,
        suburb: row.suburb || 'Other',
      };
    });

    // Count query
    let countQuery = `SELECT COUNT(*) FROM appraisal_leads WHERE 1=1`;
    const countParams: unknown[] = [];
    let ci = 1;

    if (useLocationColumns) {
      if (region) { countQuery += ` AND COALESCE(region, '') = $${ci++}`; countParams.push(region); }
      if (city) { countQuery += ` AND COALESCE(city, '') = $${ci++}`; countParams.push(city); }
    }
    if (suburb) {
      if (suburb === 'Other') {
        countQuery += ` AND (suburb IS NULL OR suburb = '')`;
      } else {
        countQuery += ` AND COALESCE(suburb, '') = $${ci++}`;
        countParams.push(suburb);
      }
    }
    if (status) { countQuery += ` AND contact_status = $${ci++}`; countParams.push(status); }
    if (priority) { countQuery += ` AND priority = $${ci++}`; countParams.push(priority); }
    if (search) {
      let searchClause = `(
        client_name ILIKE $${ci}
        OR email ILIKE $${ci}
        OR phone ILIKE $${ci}
        OR property_address ILIKE $${ci}
        OR COALESCE(suburb, '') ILIKE $${ci}
      `;
      if (useLocationColumns) {
        searchClause += ` OR COALESCE(region, '') ILIKE $${ci} OR COALESCE(city, '') ILIKE $${ci}`;
      }
      searchClause += `)`;
      countQuery += ` AND ${searchClause}`;
      countParams.push(`%${search}%`);
    }

    const countResult = await marieDB.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Location stats — derive effective region/city from suburb when the stored values are empty.
    let locationStats: { region: string; city: string; suburb: string; count: number }[] = [];
    if (useLocationColumns) {
      const statsResult = await marieDB.query(`
        SELECT
          region,
          city,
          COALESCE(suburb, 'Other') as suburb,
          COUNT(*) as count
        FROM appraisal_leads
        GROUP BY region, city, suburb
        ORDER BY count DESC
      `);

      const aggregated = new Map<string, { region: string; city: string; suburb: string; count: number }>();

      statsResult.rows.forEach((row) => {
        const fallbackLocation = !hasMeaningfulLocationValue(row.region) || !hasMeaningfulLocationValue(row.city)
          ? findLocationBySuburb(row.suburb || '')
          : null;
        const effectiveRegion = hasMeaningfulLocationValue(row.region) ? row.region : fallbackLocation?.region || 'Unknown';
        const effectiveCity = hasMeaningfulLocationValue(row.city) ? row.city : fallbackLocation?.city || 'Unknown';
        const effectiveSuburb = row.suburb || 'Other';
        const key = `${effectiveRegion}::${effectiveCity}::${effectiveSuburb}`;
        const existing = aggregated.get(key);

        if (existing) {
          existing.count += Number(row.count);
        } else {
          aggregated.set(key, {
            region: effectiveRegion,
            city: effectiveCity,
            suburb: effectiveSuburb,
            count: Number(row.count),
          });
        }
      });

      locationStats = Array.from(aggregated.values()).sort((a, b) => b.count - a.count);
    }

    return NextResponse.json({
      data: mappedRows,
      locationStats,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
