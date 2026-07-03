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
  const sortOrder = searchParams.get('sortOrder') || 'asc'; // 'asc' or 'desc'
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = (page - 1) * limit;

  try {
    await (marieDB as any).ensureOutreachTablesExist?.();
    let query = `SELECT * FROM outreach_properties WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (campaign) {
      query += ` AND campaign = $${idx++}`;
      params.push(campaign);
    }
    if (region) {
      query += ` AND region = $${idx++}`;
      params.push(region);
    }
    if (city) {
      query += ` AND city = $${idx++}`;
      params.push(city);
    }
    if (suburb) {
      query += ` AND suburb = $${idx++}`;
      params.push(suburb);
    }
    if (street) {
      query += ` AND street = $${idx++}`;
      params.push(street);
    }
    if (search) {
      query += ` AND property_address ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }

    // 智能排序：suburb → street → 录入日期 → 门牌号
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
    query += ` 
      ORDER BY 
        suburb ASC,
        street ASC NULLS LAST,
        created_at ${orderDirection},
        NULLIF(REGEXP_REPLACE(property_address, '\\D', '', 'g'), '')::INTEGER ASC NULLS LAST
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const result = await marieDB.query(query, params);

    // Count total
    let countQuery = `SELECT COUNT(*) FROM outreach_properties WHERE 1=1`;
    const countParams: unknown[] = [];
    let ci = 1;

    if (status) { countQuery += ` AND status = $${ci++}`; countParams.push(status); }
    if (campaign) { countQuery += ` AND campaign = $${ci++}`; countParams.push(campaign); }
    if (region) { countQuery += ` AND region = $${ci++}`; countParams.push(region); }
    if (city) { countQuery += ` AND city = $${ci++}`; countParams.push(city); }
    if (suburb) { countQuery += ` AND suburb = $${ci++}`; countParams.push(suburb); }
    if (street) { countQuery += ` AND street = $${ci++}`; countParams.push(street); }
    if (search) { countQuery += ` AND property_address ILIKE $${ci++}`; countParams.push(`%${search}%`); }

    const countResult = await marieDB.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

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
    const body = await request.json();
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
    } = body;

    if (!property_address || !suburb || !city || !region) {
      return NextResponse.json(
        { error: 'Address, suburb, city, and region are required' },
        { status: 400 }
      );
    }

    // Idempotent check: prefer louis_property_id, otherwise check address+campaign
    let duplicate;
    if (louis_property_id && louis_property_id.trim().length > 0) {
      duplicate = await marieDB.query(
        `SELECT id FROM outreach_properties WHERE louis_property_id = $1 AND campaign = $2 LIMIT 1`,
        [louis_property_id.trim(), campaign]
      );
    } else {
      duplicate = await marieDB.query(
        `SELECT id FROM outreach_properties 
         WHERE property_address ILIKE $1 AND campaign = $2 LIMIT 1`,
        [property_address.trim(), campaign]
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
       (louis_property_id, property_address, suburb, city, region, street, owner_name, property_type, campaign, notes, status, selected_by, selected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, NOW())
       RETURNING *`,
      [
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
