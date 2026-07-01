import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';

export async function GET(request: Request) {
  const session = await auth();
  
  // Only Louis can access downloads
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      rd.id,
      rd.email,
      rd.name,
      rd.suburb,
      rd.downloaded_at,
      rd.source,
      (SELECT COUNT(*) 
       FROM report_downloads rd2 
       WHERE rd2.email = rd.email 
         AND rd2.suburb = rd.suburb 
         AND rd2.downloaded_at >= date_trunc('month', CURRENT_TIMESTAMP)
      ) as month_count
    FROM report_downloads rd
    WHERE 1=1
  `;

  const params: unknown[] = [];
  let paramIndex = 1;

  if (suburb) {
    query += ` AND rd.suburb = $${paramIndex}`;
    params.push(suburb);
    paramIndex++;
  }

  query += ` ORDER BY rd.downloaded_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const result = await marieDB.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM report_downloads WHERE 1=1`;
    const countParams: unknown[] = [];
    
    if (suburb) {
      countQuery += ` AND suburb = $1`;
      countParams.push(suburb);
    }

    const countResult = await marieDB.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      downloads: result.rows,
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
