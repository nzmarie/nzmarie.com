import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const useMV = process.env.USE_OUTREACH_MV === 'true';
  const view = searchParams.get('view') || 'full';

  try {
    await marieDB.ensureOutreachTablesExist?.();

    if (useMV) {
      return handleMVQuery(searchParams, view);
    }

    return handleLegacyQuery(searchParams);
  } catch (error) {
    console.error('Error fetching outreach properties:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}

function paginationParams(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  return { page, limit, offset: (page - 1) * limit };
}

async function handleMVQuery(searchParams: URLSearchParams, view: string) {
  const status = searchParams.get('status');
  const campaign = searchParams.get('campaign');
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const street = searchParams.get('street');
  const streets = (searchParams.get('streets') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const search = searchParams.get('search');
  const lastSoldNone = searchParams.get('last_sold_none');
  const lastSoldMinYears = searchParams.get('last_sold_min_years');
  const lastSoldMaxYears = searchParams.get('last_sold_max_years');
  const standaloneOnly = searchParams.get('standalone_only');
  const townhouseOnly = searchParams.get('townhouse_only');
  const marketStatus = searchParams.get('market_status');
  const noJunkMail = searchParams.get('no_junk_mail');
  const sentStatus = searchParams.get('sent_status');
  const reportQuarter = searchParams.get('report_quarter');
  const sentDates = (searchParams.get('sent_dates') || '').split(',').map(s => s.trim()).filter(Boolean);
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const sortMode = searchParams.get('sort_mode');
  const startStreet = searchParams.get('start_street')?.trim() || '';

  const { page, limit, offset } = paginationParams(searchParams);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status === 'sent') {
    conditions.push(`EXISTS (SELECT 1 FROM outreach_send_logs sl2 WHERE sl2.outreach_property_id = id)`);
  } else if (status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(status);
  }

  if (sentDates.length > 0) {
    const placeholders = sentDates.map((_, i) => `$${params.length + 1 + i}`).join(', ');
    conditions.push(
      `EXISTS (SELECT 1 FROM outreach_send_logs sl6 WHERE sl6.outreach_property_id = id AND (sl6.sent_at AT TIME ZONE 'Pacific/Auckland')::date IN (${placeholders}))`
    );
    params.push(...sentDates);
  }

  if (campaign) {
    conditions.push(`(campaign = $${params.length + 1} OR last_campaign = $${params.length + 1} OR EXISTS (SELECT 1 FROM outreach_send_logs sl WHERE sl.outreach_property_id = id AND sl.campaign_key = $${params.length + 1}))`);
    params.push(campaign);
  }
  if (region) {
    conditions.push(`region ILIKE $${params.length + 1}`);
    params.push(region);
  }
  if (city) {
    conditions.push(`city ILIKE $${params.length + 1}`);
    params.push(city);
  }
  if (suburb) {
    conditions.push(`suburb ILIKE $${params.length + 1}`);
    params.push(suburb);
  }
  if (street) {
    conditions.push(`(street ILIKE $${params.length + 1} OR property_address ILIKE $${params.length + 2})`);
    params.push(street, `%${street}%`);
  }
  if (streets.length > 0) {
    const placeholders = streets.map((_, i) => `$${params.length + 1 + i}`).join(', ');
    conditions.push(`street IN (${placeholders})`);
    params.push(...streets);
  }
  if (search) {
    const cleanSearch = search.split(',')[0].trim();
    conditions.push(`(property_address ILIKE $${params.length + 1} OR suburb ILIKE $${params.length + 1})`);
    params.push(`%${cleanSearch}%`);
  }

  if (lastSoldNone === 'true') {
    conditions.push('last_sold_date IS NULL');
  } else {
    if (lastSoldMinYears) {
      const years = parseInt(lastSoldMinYears);
      if (!isNaN(years) && years > 0) {
        conditions.push(`last_sold_date <= NOW() - INTERVAL '${years} years'`);
      }
    }
    if (lastSoldMaxYears) {
      const years = parseInt(lastSoldMaxYears);
      if (!isNaN(years) && years > 0) {
        conditions.push(`last_sold_date >= NOW() - INTERVAL '${years} years'`);
      }
    }
  }
  if (standaloneOnly === 'true') {
    conditions.push(`property_address NOT LIKE '%/%'`);
  }
  if (townhouseOnly === 'true') {
    conditions.push(`property_address LIKE '%/%'`);
  }
  if (marketStatus === 'for_sale') {
    conditions.push('on_market_sale = true');
  } else if (marketStatus === 'for_rent') {
    conditions.push('on_market_rent = true');
  } else if (marketStatus === 'rented') {
    conditions.push('has_rental_history = true');
  } else if (marketStatus === 'never_rented') {
    conditions.push('has_rental_history = false');
  } else if (marketStatus === 'not_listed') {
    conditions.push('on_market_sale = false AND on_market_rent = false AND has_rental_history = false');
  }
  if (noJunkMail === 'true') {
    conditions.push('no_junk_mail = true');
  } else if (noJunkMail === 'false') {
    conditions.push('(no_junk_mail = false OR no_junk_mail IS NULL)');
  }

  if (sentStatus === 'sent') {
    if (suburb) {
      let sub = `EXISTS (SELECT 1 FROM outreach_send_logs sl3 JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id WHERE sl3.outreach_property_id = id AND sr3.suburb = $${params.length + 1}`;
      params.push(suburb);
      if (reportQuarter) {
        const parts = reportQuarter.split('-');
        if (parts.length === 2) {
          const y = parseInt(parts[0], 10);
          sub += ` AND sr3.quarter = $${params.length + 1} AND sr3.year = $${params.length + 2}`;
          params.push(parts[1], isNaN(y) ? 0 : y);
        }
      }
      sub += ')';
      conditions.push(sub);
    } else {
      conditions.push('EXISTS (SELECT 1 FROM outreach_send_logs sl3 WHERE sl3.outreach_property_id = id)');
    }
  } else if (sentStatus === 'unsent') {
    if (suburb) {
      let sub = `NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3 JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id WHERE sl3.outreach_property_id = id AND sr3.suburb = $${params.length + 1}`;
      params.push(suburb);
      if (reportQuarter) {
        const parts = reportQuarter.split('-');
        if (parts.length === 2) {
          const y = parseInt(parts[0], 10);
          sub += ` AND sr3.quarter = $${params.length + 1} AND sr3.year = $${params.length + 2}`;
          params.push(parts[1], isNaN(y) ? 0 : y);
        }
      }
      sub += ')';
      conditions.push(sub);
    } else {
      conditions.push('NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3 WHERE sl3.outreach_property_id = id)');
    }
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
  let orderClause: string;
  if (sortMode === 'time') {
    orderClause = `ORDER BY latest_sent_at ${orderDirection} NULLS LAST`;
  } else {
    const streetSortExpr = `COALESCE(
        NULLIF(TRIM(street), ''),
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(property_address, '^-?\\d+/\\s*', ''), '^-?\\d+[A-Za-z]?\\s*', ''))
      )`;
    orderClause = `
      ORDER BY
        suburb ASC,
        ${startStreet ? `(CASE WHEN ${streetSortExpr} >= $${params.length + 1} THEN 0 ELSE 1 END) ASC,` : ''}
        ${streetSortExpr} ASC,
        NULLIF(REGEXP_REPLACE(REGEXP_REPLACE(property_address, '^-?\\d+/\\s*', ''), '\\D.*', ''), '')::INTEGER ASC NULLS LAST,
        created_at ${orderDirection}
    `;
  }

  if (startStreet) {
    params.push(startStreet);
  }
  params.push(limit, offset);

  const cardFields = `
    id, property_address, suburb, city, region, street,
    campaign, status, created_at, sent_at, no_junk_mail, owner_name,
    property_type, notes, selected_by, selected_at, last_campaign,
    total_send_count, last_sent_at,
    cover_image_url, bedrooms, bathrooms, car_spaces,
    capital_value, last_sold_price, last_sold_date, year_built,
    on_market_sale, sale_listing_status, sale_price, sale_agent,
    on_market_rent, rent_listing_status, rent_price,
    realestate_url,
    latest_send_title, latest_sent_at, latest_campaign,
    latest_send_quarter, latest_send_year, latest_send_report_suburb,
    COUNT(*) OVER() as total_count
  `;

  const selectClause = view === 'card' ? cardFields : '*, COUNT(*) OVER() as total_count';

  const query = `
    SELECT ${selectClause}
    FROM outreach_enriched
    ${whereClause}
    ${orderClause}
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const result = await marieDB.query(query, params);
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  return NextResponse.json({
    success: true,
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

async function handleLegacyQuery(searchParams: URLSearchParams) {
  const status = searchParams.get('status');
  const campaign = searchParams.get('campaign');
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const street = searchParams.get('street');
  const streets = (searchParams.get('streets') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const search = searchParams.get('search');
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = (page - 1) * limit;
  const lastSoldNone = searchParams.get('last_sold_none');
  const lastSoldMinYears = searchParams.get('last_sold_min_years');
  const lastSoldMaxYears = searchParams.get('last_sold_max_years');
  const standaloneOnly = searchParams.get('standalone_only');
  const townhouseOnly = searchParams.get('townhouse_only');
  const marketStatus = searchParams.get('market_status');
  const noJunkMail = searchParams.get('no_junk_mail');
  const sentStatus = searchParams.get('sent_status');
  const reportQuarter = searchParams.get('report_quarter');
  const sentDates = (searchParams.get('sent_dates') || '').split(',').map(s => s.trim()).filter(Boolean);
  const sortMode = searchParams.get('sort_mode');
  const startStreet = searchParams.get('start_street')?.trim() || '';

  let query = `
    SELECT
      op.*,
      COUNT(*) OVER() as total_count,
      ls.report_title as latest_send_title,
      ls.sent_at as latest_sent_at,
      ls.campaign_key as latest_campaign,
      ls.quarter as latest_send_quarter,
      ls.year as latest_send_year,
      ls.report_suburb as latest_send_report_suburb,
      p.id as joined_property_id,
      p.property_url,
      p.cover_image_url as image_url,
      p.bedrooms,
      p.bathrooms,
      p.car_spaces,
      p.floor_size as floor_area,
      p.land_area,
      p.last_sold_price,
      p.last_sold_date,
      p.capital_value,
      p.year_built as build_year,
      p.property_url as pv_url,
      p.description,
      p.has_rental_history,
      p.is_currently_rented,
      p.estimated_value_low,
      p.estimated_value_high,
      p.suburb_median_price,
      p.suburb_days_on_market,
      p.no_junk_mail,
      COALESCE(re.original_link, rer.original_link, re.property_url, rer.property_url) as realestate_url,
      p.property_history,
      CASE WHEN re.id IS NOT NULL THEN true ELSE false END as on_market_sale,
      re.status as sale_listing_status,
      re.price_display as sale_price,
      re.agent_name as sale_agent,
      CASE WHEN rer.id IS NOT NULL THEN true ELSE false END as on_market_rent,
      rer.status as rent_listing_status,
      rer.price_display as rent_price
    FROM outreach_properties op
    LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
    LEFT JOIN real_estate re ON TRIM(LOWER(SPLIT_PART(re.address, ',', 1))) = TRIM(LOWER(p.address)) AND TRIM(LOWER(re.suburb)) = TRIM(LOWER(p.suburb))
    LEFT JOIN real_estate_rent rer ON TRIM(LOWER(SPLIT_PART(rer.address, ',', 1))) = TRIM(LOWER(p.address)) AND TRIM(LOWER(rer.suburb)) = TRIM(LOWER(p.suburb))
    LEFT JOIN LATERAL (
      SELECT sl.report_title, sl.sent_at, sl.campaign_key, sr.quarter, sr.year, sr.suburb as report_suburb
      FROM outreach_send_logs sl
      LEFT JOIN suburb_reports sr ON sl.suburb_report_id = sr.id
      WHERE sl.outreach_property_id = op.id
      ORDER BY sl.sent_at DESC
      LIMIT 1
    ) ls ON true
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let idx = 1;

  if (status === 'sent') {
    query += ` AND EXISTS (SELECT 1 FROM outreach_send_logs sl2 WHERE sl2.outreach_property_id = op.id)`;
  } else if (status) {
    query += ` AND op.status = $${idx++}`;
    params.push(status);
  }

  if (campaign) {
    query += ` AND (op.campaign = $${idx} OR op.last_campaign = $${idx} OR EXISTS (SELECT 1 FROM outreach_send_logs sl WHERE sl.outreach_property_id = op.id AND sl.campaign_key = $${idx}))`;
    params.push(campaign);
    idx++;
  }
  if (region) {
    query += ` AND op.region ILIKE $${idx++}`;
    params.push(region);
  }
  if (city) {
    query += ` AND op.city ILIKE $${idx++}`;
    params.push(city);
  }
  if (suburb) {
    query += ` AND op.suburb ILIKE $${idx++}`;
    params.push(suburb);
  }
  if (street) {
    query += ` AND (op.street ILIKE $${idx} OR op.property_address ILIKE $${idx + 1})`;
    params.push(street, `%${street}%`);
    idx += 2;
  }
  if (streets.length > 0) {
    const placeholders = streets.map(() => `$${idx++}`).join(', ');
    query += ` AND op.street IN (${placeholders})`;
    params.push(...streets);
  }
  if (search) {
    const cleanSearch = search.split(',')[0].trim();
    query += ` AND (op.property_address ILIKE $${idx} OR op.suburb ILIKE $${idx})`;
    params.push(`%${cleanSearch}%`);
    idx++;
  }

  if (lastSoldNone === 'true') {
    query += ` AND p.last_sold_date IS NULL`;
  } else {
    if (lastSoldMinYears) {
      const years = parseInt(lastSoldMinYears);
      if (!isNaN(years) && years > 0) {
        query += ` AND p.last_sold_date <= NOW() - INTERVAL '${years} years'`;
      }
    }
    if (lastSoldMaxYears) {
      const years = parseInt(lastSoldMaxYears);
      if (!isNaN(years) && years > 0) {
        query += ` AND p.last_sold_date >= NOW() - INTERVAL '${years} years'`;
      }
    }
  }
  if (standaloneOnly === 'true') {
    query += ` AND p.address NOT LIKE '%/%'`;
  }
  if (townhouseOnly === 'true') {
    query += ` AND p.address LIKE '%/%'`;
  }
  if (marketStatus === 'for_sale') {
    query += ` AND re.id IS NOT NULL`;
  } else if (marketStatus === 'for_rent') {
    query += ` AND rer.id IS NOT NULL`;
  } else if (marketStatus === 'rented') {
    query += ` AND p.has_rental_history = true`;
  } else if (marketStatus === 'never_rented') {
    query += ` AND p.has_rental_history = false`;
  } else if (marketStatus === 'not_listed') {
    query += ` AND re.id IS NULL AND rer.id IS NULL AND p.has_rental_history = false`;
  }
  if (noJunkMail === 'true') {
    query += ` AND p.no_junk_mail = true`;
  } else if (noJunkMail === 'false') {
    query += ` AND (p.no_junk_mail = false OR p.no_junk_mail IS NULL)`;
  }

  if (sentStatus === 'sent') {
    if (suburb) {
      let sub = `SELECT 1 FROM outreach_send_logs sl3 JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id WHERE sl3.outreach_property_id = op.id AND sr3.suburb = $${idx}`;
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
      query += ` AND EXISTS (${sub})`;
    } else {
      query += ` AND EXISTS (SELECT 1 FROM outreach_send_logs sl3 WHERE sl3.outreach_property_id = op.id)`;
    }
  } else if (sentStatus === 'unsent') {
    if (suburb) {
      let sub = `SELECT 1 FROM outreach_send_logs sl3 JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id WHERE sl3.outreach_property_id = op.id AND sr3.suburb = $${idx}`;
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
      query += ` AND NOT EXISTS (${sub})`;
    } else {
      query += ` AND NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3 WHERE sl3.outreach_property_id = op.id)`;
    }
  }

  if (sentDates.length > 0) {
    const placeholders = sentDates.map((_, i) => `$${idx + i}`).join(', ');
    query += ` AND EXISTS (SELECT 1 FROM outreach_send_logs sl6 WHERE sl6.outreach_property_id = op.id AND (sl6.sent_at AT TIME ZONE 'Pacific/Auckland')::date IN (${placeholders}))`;
    params.push(...sentDates);
    idx += sentDates.length;
  }

  const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
  if (sortMode === 'time') {
    query += ` ORDER BY ls.sent_at ${orderDirection} NULLS LAST LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
  } else {
    const streetSortExpr = `COALESCE(
        NULLIF(TRIM(op.street), ''),
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(op.property_address, '^\\d+/\\s*', ''), '^\\d+[A-Za-z]?\\s*', ''))
      )`;
    const startCmp = startStreet
      ? `(CASE WHEN ${streetSortExpr} >= $${idx} THEN 0 ELSE 1 END) ASC,`
      : '';
    const limitIdx = idx + (startStreet ? 1 : 0);
    query += `
      ORDER BY
        ${startCmp}
        op.suburb ASC,
        ${streetSortExpr} ASC,
        NULLIF(REGEXP_REPLACE(REGEXP_REPLACE(op.property_address, '^\\d+/\\s*', ''), '\\D.*', ''), '')::INTEGER ASC NULLS LAST,
        op.created_at ${orderDirection}
      LIMIT $${limitIdx} OFFSET $${limitIdx + 1}
    `;
    if (startStreet) {
      params.push(startStreet);
      idx++;
    }
    params.push(limit, offset);
  }

  const result = await marieDB.query(query, params);
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  return NextResponse.json({
    success: true,
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      property_address?: string;
      suburb?: string;
      city?: string;
      region?: string;
      street?: string;
      owner_name?: string;
      property_type?: string;
      campaign?: string;
      notes?: string;
      louis_property_id?: string;
      property_id?: string;
    };
    const {
      property_address,
      suburb,
      city,
      region,
      street,
      owner_name,
      property_type,
      campaign = '2026_Q3_Report',
      notes,
      louis_property_id,
      property_id,
    } = body;

    if (!property_address || !suburb || !city || !region) {
      return NextResponse.json(
        { error: 'Address, suburb, city, and region are required' },
        { status: 400 }
      );
    }

    let duplicate;
    if (property_id) {
      duplicate = await marieDB.query(
        `SELECT id FROM outreach_properties WHERE property_id = $1 LIMIT 1`,
        [property_id]
      );
    } else if (louis_property_id && louis_property_id.trim().length > 0) {
      duplicate = await marieDB.query(
        `SELECT id FROM outreach_properties WHERE louis_property_id = $1 AND campaign = $2 LIMIT 1`,
        [louis_property_id.trim(), campaign]
      );
    } else {
      const normalizedAddress = property_address
        .toLowerCase()
        .replace(/,\s*new\s*zealand/g, '')
        .replace(/new\s*zealand/g, '')
        .replace(/\b\d{4}\b/g, '')
        .replace(/[^a-z0-9]/g, '');

      duplicate = await marieDB.query(
        `SELECT id FROM outreach_properties
         WHERE LOWER(
           REGEXP_REPLACE(
             REGEXP_REPLACE(
               REGEXP_REPLACE(property_address, ',\\s*New\\s*Zealand', '', 'gi'),
               '\\b\\d{4}\\b',
               '',
               'g'
             ),
             '[^a-zA-Z0-9]',
             '',
             'g'
           )
         ) = $1 AND campaign = $2 LIMIT 1`,
        [normalizedAddress, campaign]
      );
    }

    if (duplicate.rows.length > 0) {
      return NextResponse.json(
        { error: 'Address already exists in this campaign' },
        { status: 409 }
      );
    }

    const result = await marieDB.query(
      `INSERT INTO outreach_properties
       (property_id, louis_property_id, property_address, suburb, city, region, street, owner_name, property_type, campaign, notes, status, selected_by, selected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, NOW())
       RETURNING *`,
      [
        property_id?.trim() || null,
        louis_property_id?.trim() || null,
        property_address.trim(),
        suburb.trim(),
        city.trim(),
        region.trim(),
        street?.trim() || null,
        owner_name?.trim() || null,
        property_type?.trim() || null,
        campaign,
        notes?.trim() || null,
        session.user.email,
      ]
    );

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating outreach property:', error);
    return NextResponse.json(
      { error: 'Failed to create property' },
      { status: 500 }
    );
  }
}
