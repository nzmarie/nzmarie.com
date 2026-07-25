import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/drizzle';
import { isAdmin } from '@/lib/permissions';
import { NZ_SUBURBS } from '@/lib/address-parser';
import { sql, and, or, eq, ilike, desc, count, gte, lte } from 'drizzle-orm';
import { reportDownloads } from '@/database/schema';

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

  try {
    const conditions: any[] = [];

    if (suburb && suburb !== 'all') {
      if (suburb === 'Other') {
        conditions.push(
          or(eq(reportDownloads.suburb, ''), sql`${reportDownloads.suburb} IS NULL`)
        );
      } else {
        conditions.push(eq(reportDownloads.suburb, suburb));
      }
    }

    if (source && source !== 'all') {
      conditions.push(eq(reportDownloads.source, source));
    }

    if (dateFrom) {
      conditions.push(gte(reportDownloads.downloaded_at, sql`${dateFrom}::timestamp`));
    }
    if (dateTo) {
      conditions.push(lte(reportDownloads.downloaded_at, sql`${dateTo}::timestamp`));
    }

    if (search) {
      conditions.push(
        or(
          ilike(reportDownloads.email, `%${search}%`),
          ilike(reportDownloads.name, `%${search}%`),
          ilike(reportDownloads.tracking_code, `%${search}%`),
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select().from(reportDownloads)
      .where(whereClause)
      .orderBy(desc(reportDownloads.downloaded_at))
      .limit(limit)
      .offset(offset);

    const mappedRows = rows.map(row => ({
      ...row,
      suburb: row.suburb || 'Other',
    }));

    const countResult = await db.select({ total: count() }).from(reportDownloads)
      .where(whereClause);

    const total = countResult[0]?.total ?? 0;

    const statsResult = await db.execute(sql`
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
