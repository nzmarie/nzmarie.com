import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';
import { ensureCampaignTablesExist } from '@/lib/campaign-tracker';

// ─── In-memory cache (30 s TTL) ──────────────────────────────────────────────
const scansCache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | null {
  const entry = scansCache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data as T;
  scansCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  if (scansCache.size > 20) {
    const oldest = [...scansCache.keys()].slice(0, 5);
    oldest.forEach(k => scansCache.delete(k));
  }
  scansCache.set(key, { data, expiry: Date.now() + ttlMs });
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureCampaignTablesExist();

    const { searchParams } = new URL(request.url);
    const selectedCampaign = searchParams.get('campaign');
    const cacheKey = `scans_${selectedCampaign ?? 'all'}`;

    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Run all 3 queries in parallel instead of sequentially
    const logsQuery = selectedCampaign
      ? `SELECT id, campaign_key, visitor_hash, ip_address, user_agent, device_type, referrer, is_unique, created_at
         FROM campaign_visit_logs
         WHERE campaign_key = $1
         ORDER BY created_at DESC LIMIT 100`
      : `SELECT id, campaign_key, visitor_hash, ip_address, user_agent, device_type, referrer, is_unique, created_at
         FROM campaign_visit_logs
         ORDER BY created_at DESC LIMIT 100`;

    const [summaryResult, campaignsResult, logsResult] = await Promise.all([
      marieDB.query(`
        SELECT
          COALESCE(SUM(total_pv), 0) as total_pv,
          COALESCE(SUM(total_uv), 0) as total_uv
        FROM campaign_analytics
      `),
      marieDB.query(`
        SELECT campaign_key, campaign_name, total_pv, total_uv, last_visited_at
        FROM campaign_analytics
        ORDER BY total_pv DESC
      `),
      marieDB.query(logsQuery, selectedCampaign ? [selectedCampaign] : []),
    ]);

    const capitalize = (s: string) =>
      s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const response = {
      success: true,
      total_scans: parseInt(summaryResult.rows[0]?.total_pv || '0', 10),
      total_unique: parseInt(summaryResult.rows[0]?.total_uv || '0', 10),
      campaigns: campaignsResult.rows.map(row => ({
        campaign_key: row.campaign_key,
        campaign_name: capitalize(row.campaign_name || row.campaign_key),
        total_pv: parseInt(row.total_pv || '0', 10),
        total_uv: parseInt(row.total_uv || '0', 10),
        last_visited_at: row.last_visited_at,
      })),
      logs: logsResult.rows,
    };

    setCache(cacheKey, response, 30_000);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching scan analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan analytics' },
      { status: 500 }
    );
  }
}
