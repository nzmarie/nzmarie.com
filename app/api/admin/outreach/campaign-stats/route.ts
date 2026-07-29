import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number): void {
  if (cache.size > 50) {
    const keys = [...cache.keys()].slice(0, 10);
    keys.forEach(k => cache.delete(k));
  }
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaign = searchParams.get('campaign');

  try {
    await marieDB.ensureOutreachTablesExist?.();

    if (!campaign) {
      const cachedList = getCached<string[]>('campaign_list');
      if (cachedList) {
        return NextResponse.json({ available_campaigns: cachedList });
      }

      const result = await marieDB.query(
        `SELECT DISTINCT campaign_key FROM outreach_send_logs ORDER BY campaign_key DESC`
      );
      const list = result.rows.map((r: { campaign_key: string }) => r.campaign_key);
      setCache('campaign_list', list, 300_000);
      return NextResponse.json({ available_campaigns: list });
    }

    const cacheKey = `stats_${campaign}`;
    const cachedStats = getCached<unknown>(cacheKey);
    if (cachedStats) {
      return NextResponse.json(cachedStats);
    }

    const campaignParts = campaign.split('_');
    const suburb = campaignParts.length > 2 ? campaignParts.slice(2).join(' ') : campaign;
    const scanKey = suburb.toLowerCase();

    const [dailyResult, pendingDailyResult, statusResult, scanResult, bizScanResult] = await Promise.all([
      marieDB.query(
        `SELECT TO_CHAR(sl.sent_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS send_date,
                COUNT(*)::int AS total_sent
         FROM outreach_send_logs sl
         WHERE sl.campaign_key = $1 AND sl.sent_at IS NOT NULL
         GROUP BY TO_CHAR(sl.sent_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD')
         ORDER BY send_date ASC`,
        [campaign]
      ),
      marieDB.query(
        `SELECT TO_CHAR(
           (CASE WHEN p.no_junk_mail = TRUE AND p.no_junk_mail_updated_at IS NOT NULL
                 THEN p.no_junk_mail_updated_at
                 ELSE op.created_at
            END) AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD'
         ) AS day,
         COUNT(*)::int AS daily_pending,
         COUNT(*) FILTER (WHERE p.no_junk_mail = TRUE)::int AS daily_no_junk
         FROM outreach_properties op
         LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
         WHERE op.suburb = $1 AND op.status = 'pending'
         GROUP BY day
         ORDER BY day ASC`,
        [suburb]
      ),
      marieDB.query(
        `SELECT status, COUNT(*)::int AS count
         FROM outreach_properties
         WHERE last_campaign = $1 AND status IN ('interacted', 'converted')
         GROUP BY status`,
        [campaign]
      ),
      marieDB.query(
        `SELECT TO_CHAR(created_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS scan_date,
                COUNT(*)::int AS pv,
                COUNT(*) FILTER (WHERE is_unique = TRUE)::int AS uv
         FROM campaign_visit_logs
         WHERE (LOWER(campaign_key) = LOWER($1) OR LOWER(campaign_key) = LOWER($2))
         GROUP BY TO_CHAR(created_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD')
         ORDER BY scan_date ASC`,
        [scanKey, campaign]
      ),
      marieDB.query(
        `SELECT TO_CHAR(created_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS scan_date,
                COUNT(*)::int AS pv,
                COUNT(*) FILTER (WHERE is_unique = TRUE)::int AS uv
         FROM campaign_visit_logs
         WHERE LOWER(campaign_key) = 'business_card'
         GROUP BY TO_CHAR(created_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD')
         ORDER BY scan_date ASC`
      ),
    ]);

    const daily_sends = dailyResult.rows.map((r) => ({
      date: typeof r.send_date === 'string' ? r.send_date : (r.send_date instanceof Date ? r.send_date.toISOString().slice(0, 10) : String(r.send_date)),
      total_sent: Number(r.total_sent),
    }));

    const daily_no_junk = pendingDailyResult.rows.map((r) => ({
      date: typeof r.day === 'string' ? r.day : (r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day)),
      no_junk_sent: Number(r.daily_no_junk),
    }));

    const sent_count = daily_sends.reduce((sum, d) => sum + d.total_sent, 0);
    const pending_count = pendingDailyResult.rows.reduce((sum: number, r: { daily_pending: unknown }) => sum + Number(r.daily_pending), 0);
    const no_junk_mail_count = daily_no_junk.reduce((sum, d) => sum + d.no_junk_sent, 0);

    const statusMap: Record<string, number> = {};
    for (const row of statusResult.rows as { status: string; count: unknown }[]) {
      statusMap[row.status] = Number(row.count);
    }

    const daily_scans = scanResult.rows.map((r) => ({
      date: typeof r.scan_date === 'string' ? r.scan_date : (r.scan_date instanceof Date ? r.scan_date.toISOString().slice(0, 10) : String(r.scan_date)),
      pv: Number(r.pv),
      uv: Number(r.uv),
    }));

    const biz_daily_scans = bizScanResult.rows.map((r) => ({
      date: typeof r.scan_date === 'string' ? r.scan_date : (r.scan_date instanceof Date ? r.scan_date.toISOString().slice(0, 10) : String(r.scan_date)),
      pv: Number(r.pv),
      uv: Number(r.uv),
    }));

    const total_scans_pv = daily_scans.reduce((sum, d) => sum + d.pv, 0);
    const total_scans_uv = daily_scans.reduce((sum, d) => sum + d.uv, 0);
    const total_biz_pv = biz_daily_scans.reduce((sum, d) => sum + d.pv, 0);
    const total_biz_uv = biz_daily_scans.reduce((sum, d) => sum + d.uv, 0);

    const allDates = new Set([...daily_sends.map(d => d.date), ...daily_no_junk.map(d => d.date)]);
    const merged_daily = [...allDates].sort().map(date => ({
      date,
      total_sent: daily_sends.find(d => d.date === date)?.total_sent ?? 0,
      no_junk_sent: daily_no_junk.find(d => d.date === date)?.no_junk_sent ?? 0,
    }));

    const responseData = {
      campaign,
      summary: {
        pending_count,
        sent_count,
        interacted_count: statusMap['interacted'] || 0,
        converted_count: statusMap['converted'] || 0,
        no_junk_mail_count,
        total_scans_pv,
        total_scans_uv,
      },
      daily_sends: merged_daily,
      daily_scans,
      business_card_summary: { pv: total_biz_pv, uv: total_biz_uv },
      business_card_daily_scans: biz_daily_scans,
    };

    setCache(cacheKey, responseData, 300_000);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign stats' }, { status: 500 });
  }
}
