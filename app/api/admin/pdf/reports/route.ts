import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { deleteFromR2 } from '@/lib/r2-storage';

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
      doc_label,
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

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let id: string;
  try {
    const body = await request.json();
    id = body?.id;
  } catch {
    return NextResponse.json({ error: 'Missing report id' }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing report id' }, { status: 400 });
  }

  try {
    const result = await marieDB.query(
      `SELECT file_url FROM suburb_reports WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    await marieDB.query(`DELETE FROM suburb_reports WHERE id = $1`, [id]);

    // Best-effort: also remove the object from R2 storage.
    try {
      const fileUrl = row.file_url as string;
      const publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://reports.nzmarie.com').replace(/\/+$/, '');
      if (fileUrl.startsWith(publicDomain)) {
        const key = fileUrl.slice(publicDomain.length + 1);
        await deleteFromR2(key);
      }
    } catch (e) {
      console.error('Failed to delete R2 object:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
