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
  const suburb = searchParams.get('suburb');
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = `SELECT * FROM appraisal_leads WHERE 1=1`;
  const params: unknown[] = [];
  let idx = 1;

  if (suburb) {
    query += ` AND suburb = $${idx++}`;
    params.push(suburb);
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
    query += ` AND (client_name ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx} OR property_address ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  try {
    const result = await marieDB.query(query, params);

    let countQuery = `SELECT COUNT(*) FROM appraisal_leads WHERE 1=1`;
    const countParams: unknown[] = [];
    let ci = 1;
    if (suburb) { countQuery += ` AND suburb = $${ci++}`; countParams.push(suburb); }
    if (status) { countQuery += ` AND contact_status = $${ci++}`; countParams.push(status); }
    if (priority) { countQuery += ` AND priority = $${ci++}`; countParams.push(priority); }
    if (search) {
      countQuery += ` AND (client_name ILIKE $${ci} OR email ILIKE $${ci} OR phone ILIKE $${ci} OR property_address ILIKE $${ci})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await marieDB.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
