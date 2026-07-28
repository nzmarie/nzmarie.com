import { NextResponse } from 'next/server';
import { marieDB } from '@/lib/db';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cron MV refresh failed:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
