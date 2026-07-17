import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

/**
 * GET /api/admin/outreach
 * Fetch outreach properties with filtering and pagination
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const campaign = searchParams.get('campaign');
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const street = searchParams.get('street');
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

  try {
    await marieDB.ensureOutreachTablesExist?.();
    let query = `
      SELECT 
        op.*,
        COUNT(*) OVER() as total_count,
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
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id OR op.louis_property_id = p.id
      LEFT JOIN real_estate re ON LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(re.address, ',', 1)), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.address), '  +', ' ', 'g')) AND LOWER(REGEXP_REPLACE(TRIM(re.suburb), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.suburb), '  +', ' ', 'g'))
      LEFT JOIN real_estate_rent rer ON LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(rer.address, ',', 1)), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.address), '  +', ' ', 'g')) AND LOWER(REGEXP_REPLACE(TRIM(rer.suburb), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.suburb), '  +', ' ', 'g'))
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      query += ` AND op.status = $${idx++}`;
      params.push(status);
    }
    if (campaign) {
      query += ` AND op.campaign = $${idx++}`;
      params.push(campaign);
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
      query += ` AND op.street ILIKE $${idx++}`;
      params.push(street);
    }
    if (search) {
      query += ` AND op.property_address ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }

    // Filters on the joined properties table
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
      query += ` AND re.id IS NULL AND rer.id IS NULL`;
    }

    // 智能排序：suburb → street → 录入日期 → 门牌号
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
    query += ` 
      ORDER BY 
        op.suburb ASC,
        op.street ASC NULLS LAST,
        op.created_at ${orderDirection},
        NULLIF(REGEXP_REPLACE(op.property_address, '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

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
  } catch (error) {
    console.error('Error fetching outreach properties:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/outreach
 * Add a new property to outreach list
 */
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

    // Idempotent check: prefer property_id, then louis_property_id, otherwise check address+campaign
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
