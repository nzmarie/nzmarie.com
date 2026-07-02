import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { NZ_SUBURBS } from '@/lib/address-parser';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const suburb = searchParams.get('suburb');
  const search = searchParams.get('search');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const source = searchParams.get('source');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      id, email, name, suburb, report_type, downloaded_at, 
      source, tracking_code, created_at
    FROM report_downloads
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let idx = 1;

  if (suburb && suburb !== 'all') {
    if (suburb === 'Other') {
      query += ` AND (suburb IS NULL OR suburb = '')`;
    } else {
      query += ` AND COALESCE(suburb, '') = $${idx++}`;
      params.push(suburb);
    }
  }

  if (source && source !== 'all') {
    query += ` AND source = $${idx++}`;
    params.push(source);
  }

  if (dateFrom) {
    query += ` AND downloaded_at >= $${idx++}::timestamp`;
    params.push(dateFrom);
  }
  if (dateTo) {
    query += ` AND downloaded_at <= $${idx++}::timestamp`;
    params.push(dateTo);
  }

  if (search) {
    query += ` AND (email ILIKE $${idx} OR name ILIKE $${idx} OR tracking_code ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  query += ` ORDER BY downloaded_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  try {
    const result = await marieDB.query(query, params);

    const mappedRows = result.rows.map(row => ({
      ...row,
      suburb: row.suburb || 'Other',
    }));

    let countQuery = `SELECT COUNT(*) FROM report_downloads WHERE 1=1`;
    const countParams: unknown[] = [];
    let ci = 1;
    
    if (suburb && suburb !== 'all') {
      if (suburb === 'Other') {
        countQuery += ` AND (suburb IS NULL OR suburb = '')`;
      } else {
        countQuery += ` AND COALESCE(suburb, '') = $${ci++}`;
        countParams.push(suburb);
      }
    }
    if (source && source !== 'all') { 
      countQuery += ` AND source = $${ci++}`; 
      countParams.push(source); 
    }
    if (dateFrom) { 
      countQuery += ` AND downloaded_at >= $${ci++}::timestamp`; 
      countParams.push(dateFrom); 
    }
    if (dateTo) { 
      countQuery += ` AND downloaded_at <= $${ci++}::timestamp`; 
      countParams.push(dateTo); 
    }
    if (search) { 
      countQuery += ` AND (email ILIKE $${ci} OR name ILIKE $${ci} OR tracking_code ILIKE $${ci})`; 
      countParams.push(`%${search}%`); 
    }

    const countResult = await marieDB.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const statsResult = await marieDB.query(`
      SELECT 
        COUNT(*) as total_downloads,
        COUNT(*) FILTER (WHERE downloaded_at >= date_trunc('month', CURRENT_TIMESTAMP)) as this_month,
        COUNT(DISTINCT email) as unique_users
      FROM report_downloads
    `);

    return NextResponse.json({
      success: true,
      data: mappedRows,
      suburbs: Array.from(new Set([...NZ_SUBURBS, 'Other'])),
      stats: statsResult.rows[0],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching downloads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch downloads' },
      { status: 500 }
    );
  }
}
