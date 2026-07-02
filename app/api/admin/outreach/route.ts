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
  const status = searchParams.get('status') || 'PENDING';
  const suburb = searchParams.get('suburb');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = `
    SELECT id, louis_property_id, property_address, suburb, street, city,
           bedrooms, bathrooms, rv_value, status, tracking_code,
           selected_by, selected_at, sent_by, sent_at, notes
    FROM outreach_selected_properties
    WHERE status = $1
  `;
  const params: unknown[] = [status];
  let idx = 2;

  if (suburb && suburb !== 'all') {
    query += ` AND suburb = $${idx++}`;
    params.push(suburb);
  }
  if (search) {
    query += ` AND (property_address ILIKE $${idx} OR tracking_code ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  query += ` ORDER BY selected_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  try {
    const result = await marieDB.query(query, params);

    let countQuery = `SELECT COUNT(*) FROM outreach_selected_properties WHERE status = $1`;
    const countParams: unknown[] = [status];
    let ci = 2;
    if (suburb && suburb !== 'all') { countQuery += ` AND suburb = $${ci++}`; countParams.push(suburb); }
    if (search) {
      countQuery += ` AND (property_address ILIKE $${ci} OR tracking_code ILIKE $${ci})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await marieDB.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const suburbsResult = await marieDB.query(
      `SELECT DISTINCT suburb FROM outreach_selected_properties ORDER BY suburb`
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      status,
      suburbs: suburbsResult.rows.map((r: { suburb: string }) => r.suburb),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching outreach:', error);
    return NextResponse.json({ error: 'Failed to fetch outreach' }, { status: 500 });
  }
}
