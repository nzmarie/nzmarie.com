import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';
import { getQuarterlyComparison, getMonthlyData } from '@/lib/market-data-aggregator';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const district = searchParams.get('district') || 'North Shore City';
  const from = searchParams.get('from') || '2025-01-01';
  const to = searchParams.get('to') || '2026-12-31';

  if (!suburb) {
    return NextResponse.json({ error: 'suburb parameter is required' }, { status: 400 });
  }

  const tableCheck = await query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'market_monthly_snapshots'
    ) AS exists`
  );
  if (!tableCheck.rows[0]?.exists) {
    return NextResponse.json({
      success: false,
      error: 'Database table "market_monthly_snapshots" does not exist.',
      needsMigration: true,
      chartData: [],
      monthlyData: [],
      availableSuburbs: [],
    });
  }

  try {
    const suburbResult = await query<{ region_name: string }>(
      `SELECT DISTINCT region_name FROM market_monthly_snapshots
       WHERE region_type = 'suburb' ORDER BY region_name`
    );
    const availableSuburbs = suburbResult.rows.map(r => r.region_name);

    const [chartData, monthlyData] = await Promise.all([
      getQuarterlyComparison(suburb, district, from, to),
      getMonthlyData(suburb, district, from, to),
    ]);

    return NextResponse.json({
      success: true,
      availableSuburbs,
      data: {
        suburb,
        district,
        timeRange: { from, to },
        chartData,
        monthlyData,
      },
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json({ error: 'Failed to fetch chart data', availableSuburbs: [] }, { status: 500 });
  }
}
