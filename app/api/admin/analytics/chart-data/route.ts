import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/permissions';
import { getQuarterlyComparison } from '@/lib/market-data-aggregator';

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

  try {
    const chartData = await getQuarterlyComparison(suburb, district, from, to);
    return NextResponse.json({
      success: true,
      data: {
        suburb,
        district,
        timeRange: { from, to },
        chartData,
      },
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
