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
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      ot.*,
      CASE WHEN rd.id IS NOT NULL THEN true ELSE false END as has_downloaded,
      COUNT(rd.id) as download_count
    FROM outreach_tasks ot
    LEFT JOIN report_downloads rd 
      ON rd.suburb = ot.suburb 
      AND rd.tracking_code = ot.tracking_code
    WHERE ot.status = $1
  `;

  const params: unknown[] = [status];
  let paramIndex = 2;

  if (suburb) {
    query += ` AND ot.suburb = $${paramIndex}`;
    params.push(suburb);
    paramIndex++;
  }

  query += ` GROUP BY ot.id ORDER BY ot.added_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const result = await marieDB.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM outreach_tasks WHERE status = $1`;
    const countParams = [status];
    
    if (suburb) {
      countQuery += ` AND suburb = $2`;
      countParams.push(suburb);
    }

    const countResult = await marieDB.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      data: result.rows,
      status,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching outreach tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outreach tasks' },
      { status: 500 }
    );
  }
}
