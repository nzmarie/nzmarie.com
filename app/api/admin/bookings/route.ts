import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/drizzle';
import { isAdmin } from '@/lib/permissions';
import { findLocationBySuburb } from '@/lib/geo-data';
import { sql, and, or, eq, ilike, desc, count } from 'drizzle-orm';
import { appraisalLeads } from '@/database/schema';

let hasLocationColumns: boolean | null = null;

function hasMeaningfulLocationValue(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.trim().toLowerCase() !== 'unknown';
}

async function checkLocationColumns(): Promise<boolean> {
  if (hasLocationColumns !== null) return hasLocationColumns;
  try {
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'appraisal_leads'
        AND column_name IN ('region', 'city')
    `);
    hasLocationColumns = result.rows.length === 2;
  } catch {
    hasLocationColumns = false;
  }
  return hasLocationColumns;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  const useLocationColumns = await checkLocationColumns();

  try {
    const conditions: ReturnType<typeof eq>[] = [];

    if (useLocationColumns) {
      if (region) {
        conditions.push(eq(appraisalLeads.region, region));
      }
      if (city) {
        conditions.push(eq(appraisalLeads.city, city));
      }
    }

    if (suburb) {
      if (suburb === 'Other') {
        conditions.push(
          or(eq(appraisalLeads.suburb, ''), sql`${appraisalLeads.suburb} IS NULL`) as any
        );
      } else {
        conditions.push(eq(appraisalLeads.suburb, suburb));
      }
    }
    if (status) {
      conditions.push(eq(appraisalLeads.contact_status, status));
    }
    if (priority) {
      conditions.push(eq(appraisalLeads.priority, priority));
    }

    if (search) {
      const searchConditions: any[] = [
        ilike(appraisalLeads.client_name, `%${search}%`),
        ilike(appraisalLeads.email, `%${search}%`),
        ilike(appraisalLeads.phone, `%${search}%`),
        ilike(appraisalLeads.property_address, `%${search}%`),
        ilike(appraisalLeads.suburb, `%${search}%`),
      ];
      if (useLocationColumns) {
        searchConditions.push(ilike(appraisalLeads.region, `%${search}%`));
        searchConditions.push(ilike(appraisalLeads.city, `%${search}%`));
      }
      conditions.push(or(...searchConditions) as any);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select().from(appraisalLeads)
      .where(whereClause)
      .orderBy(desc(appraisalLeads.created_at))
      .limit(limit)
      .offset(offset);

    const mappedRows = rows.map(row => {
      const fallbackLocation = !hasMeaningfulLocationValue(row.region) || !hasMeaningfulLocationValue(row.city)
        ? findLocationBySuburb(row.suburb || '')
        : null;

      return {
        ...row,
        region: useLocationColumns ? (hasMeaningfulLocationValue(row.region) ? row.region : fallbackLocation?.region || null) : null,
        city: useLocationColumns ? (hasMeaningfulLocationValue(row.city) ? row.city : fallbackLocation?.city || null) : null,
        suburb: row.suburb || 'Other',
      };
    });

    const countResult = await db.select({ total: count() }).from(appraisalLeads)
      .where(whereClause);

    const total = countResult[0]?.total ?? 0;

    let locationStats: { region: string; city: string; suburb: string; count: number }[] = [];
    if (useLocationColumns) {
      const statsResult = await db.execute(sql`
        SELECT
          region,
          city,
          COALESCE(suburb, 'Other') as suburb,
          COUNT(*) as count
        FROM appraisal_leads
        GROUP BY region, city, suburb
        ORDER BY count DESC
      `);

      const aggregated = new Map<string, { region: string; city: string; suburb: string; count: number }>();

      (statsResult.rows as Array<{ region: string | null; city: string | null; suburb: string; count: number }>).forEach((row) => {
        const fallbackLocation = !hasMeaningfulLocationValue(row.region) || !hasMeaningfulLocationValue(row.city)
          ? findLocationBySuburb(row.suburb || '')
          : null;
        const effectiveRegion = hasMeaningfulLocationValue(row.region) ? row.region : fallbackLocation?.region || 'Unknown';
        const effectiveCity = hasMeaningfulLocationValue(row.city) ? row.city : fallbackLocation?.city || 'Unknown';
        const effectiveSuburb = row.suburb || 'Other';
        const key = `${effectiveRegion}::${effectiveCity}::${effectiveSuburb}`;
        const existing = aggregated.get(key);

        if (existing) {
          existing.count += Number(row.count);
        } else {
          aggregated.set(key, {
            region: effectiveRegion,
            city: effectiveCity,
            suburb: effectiveSuburb,
            count: Number(row.count),
          });
        }
      });

      locationStats = Array.from(aggregated.values()).sort((a, b) => b.count - a.count);
    }

    return NextResponse.json({
      data: mappedRows,
      locationStats,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
