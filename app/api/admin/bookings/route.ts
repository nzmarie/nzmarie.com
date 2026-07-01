import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(request: Request) {
  const session = await auth();
  
  // Permission check
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  // Build query
  let query = `
    SELECT 
      al.*,
      dma.has_downloaded,
      dma.download_count,
      dma.has_requested_appraisal
    FROM appraisal_leads al
    LEFT JOIN direct_mail_addresses dma 
      ON dma.property_address = al.property_address 
      AND dma.suburb = al.suburb
    WHERE 1=1
  `;
  
  const params: unknown[] = [];
  let paramIndex = 1;

  if (suburb) {
    query += ` AND al.suburb = $${paramIndex}`;
    params.push(suburb);
    paramIndex++;
  }

  if (status) {
    query += ` AND al.contact_status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const result = await marieDB.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM appraisal_leads WHERE 1=1`;
    const countParams: unknown[] = [];
    let countIndex = 1;

    if (suburb) {
      countQuery += ` AND suburb = $${countIndex}`;
      countParams.push(suburb);
      countIndex++;
    }

    if (status) {
      countQuery += ` AND contact_status = $${countIndex}`;
      countParams.push(status);
    }

    const countResult = await marieDB.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}
