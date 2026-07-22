import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';
import { ensureCampaignTablesExist } from '@/lib/campaign-tracker';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureCampaignTablesExist();

    const { searchParams } = new URL(request.url);
    const selectedCampaign = searchParams.get('campaign');

    const summaryResult = await marieDB.query(`
      SELECT 
        COALESCE(SUM(total_pv), 0) as total_pv,
        COALESCE(SUM(total_uv), 0) as total_uv
      FROM campaign_analytics
    `);

    const campaignsResult = await marieDB.query(`
      SELECT campaign_key, campaign_name, total_pv, total_uv, last_visited_at
      FROM campaign_analytics
      ORDER BY total_pv DESC
    `);

    let logsQuery = `
      SELECT id, campaign_key, visitor_hash, ip_address, user_agent, device_type, referrer, is_unique, created_at
      FROM campaign_visit_logs
    `;
    const params: unknown[] = [];

    if (selectedCampaign) {
      logsQuery += ` WHERE campaign_key = $1`;
      params.push(selectedCampaign);
    }

    logsQuery += ` ORDER BY created_at DESC LIMIT 100`;

    const logsResult = await marieDB.query(logsQuery, params);

    return NextResponse.json({
      success: true,
      total_scans: parseInt(summaryResult.rows[0]?.total_pv || '0', 10),
      total_unique: parseInt(summaryResult.rows[0]?.total_uv || '0', 10),
      campaigns: campaignsResult.rows.map(row => ({
        campaign_key: row.campaign_key,
        campaign_name: row.campaign_name,
        total_pv: parseInt(row.total_pv || '0', 10),
        total_uv: parseInt(row.total_uv || '0', 10),
        last_visited_at: row.last_visited_at,
      })),
      logs: logsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching scan analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan analytics' },
      { status: 500 }
    );
  }
}
