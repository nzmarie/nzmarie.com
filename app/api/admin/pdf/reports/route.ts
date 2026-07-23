import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(request: Request) {
  const session = await auth();
  
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const status = searchParams.get('status') || 'active';

  let query = `
    SELECT 
      id,
      suburb,
      quarter,
      year,
      file_url,
      file_name,
      file_size,
      download_count,
      view_count,
      status,
      uploaded_by,
      uploaded_at,
      created_at
    FROM suburb_reports
    WHERE status = $1
  `;

  const params: unknown[] = [status];
  let paramIndex = 2;

  if (suburb) {
    query += ` AND suburb = $${paramIndex}`;
    params.push(suburb);
    paramIndex++;
  }

  query += ` ORDER BY year DESC, quarter DESC, suburb ASC`;

  try {
    const result = await marieDB.query(query, params);

    return NextResponse.json({
      reports: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
