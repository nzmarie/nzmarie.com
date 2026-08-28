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
    const typeFilter = searchParams.get('type');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10) || 20;
    const limit = Math.min(Math.max(1, limitRaw), 500);
    const offset = (page - 1) * limit;
    const cacheKey = `scans_${selectedCampaign ?? 'all'}_${typeFilter ?? 'all'}_p${page}_l${limit}`;

    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const typeCond =
      typeFilter === 'new_device' ? 'is_new_device = true'
      : typeFilter === 'repeat' ? 'is_new_device = false'
      : '';

    const columns = 'id, campaign_key, visitor_hash, ip_address, user_agent, device_type, referrer, is_unique, is_new_device, visit_count, first_scanned_at, last_scanned_at, created_at';

    const buildWhere = (withCampaign: boolean) => {
      if (withCampaign && typeCond) return `WHERE campaign_key = $1 AND ${typeCond}`;
      if (withCampaign) return 'WHERE campaign_key = $1';
      if (typeCond) return `WHERE ${typeCond}`;
      return '';
    };

    // Run all 3 queries in parallel instead of sequentially
    // Build logs query with pagination
    const logsQuery = selectedCampaign
      ? `SELECT ${columns}
         FROM campaign_visit_logs
         ${buildWhere(true)}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`
      : `SELECT ${columns}
         FROM campaign_visit_logs
         ${buildWhere(false)}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`;

    // Count query for total logs (with optional campaign filter)
    const countQuery = selectedCampaign
      ? `SELECT COUNT(*)::int as total FROM campaign_visit_logs ${buildWhere(true)}`
      : `SELECT COUNT(*)::int as total FROM campaign_visit_logs ${buildWhere(false)}`;

    const summaryPromise = marieDB.query(`
      SELECT
        COALESCE(SUM(total_pv), 0) as total_pv,
        COALESCE(SUM(total_uv), 0) as total_uv,
        (SELECT COUNT(*)::int FROM campaign_visit_logs WHERE is_new_device = true) as total_new_devices
      FROM campaign_analytics
    `);
    const campaignsPromise = marieDB.query(`
      SELECT
        ca.campaign_key,
        ca.campaign_name,
        ca.total_pv,
        ca.total_uv,
        ca.last_visited_at,
        COALESCE(vl.new_devices, 0)::int as new_devices
      FROM campaign_analytics ca
      LEFT JOIN (
        SELECT campaign_key, COUNT(*)::int as new_devices
        FROM campaign_visit_logs
        WHERE is_new_device = true
        GROUP BY campaign_key
      ) vl ON vl.campaign_key = ca.campaign_key
      ORDER BY ca.total_pv DESC
    `);

    // If no pagination params were provided, keep previous behaviour: return latest 100 logs
    const providedPage = searchParams.has('page') || searchParams.has('limit');
    if (!providedPage) {
      const logsQueryNoLimit = selectedCampaign
        ? `SELECT ${columns}
           FROM campaign_visit_logs
           ${buildWhere(true)}
           ORDER BY created_at DESC LIMIT 100`
        : `SELECT ${columns}
           FROM campaign_visit_logs
           ${buildWhere(false)}
           ORDER BY created_at DESC LIMIT 100`;

      const [summaryResult, campaignsResult, logsResult] = await Promise.all([
        summaryPromise,
        campaignsPromise,
        marieDB.query(logsQueryNoLimit, selectedCampaign ? [selectedCampaign] : []),
      ]);

      const capitalize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const response = {
        success: true,
        total_scans: parseInt(summaryResult.rows[0]?.total_pv || '0', 10),
        total_unique: parseInt(summaryResult.rows[0]?.total_uv || '0', 10),
        total_new_devices: parseInt(summaryResult.rows[0]?.total_new_devices || '0', 10),
        campaigns: campaignsResult.rows.map(row => ({
          campaign_key: row.campaign_key,
          campaign_name: capitalize(row.campaign_name || row.campaign_key),
          total_pv: parseInt(row.total_pv || '0', 10),
          total_uv: parseInt(row.total_uv || '0', 10),
          new_devices: parseInt(row.new_devices || '0', 10),
          last_visited_at: row.last_visited_at,
        })),
        logs: logsResult.rows,
      };

      setCache(cacheKey, response, 30_000);
      return NextResponse.json(response);
    }

    // Execute logs and count with proper params for paginated requests
    const logsPromise = selectedCampaign
      ? marieDB.query(logsQuery, [selectedCampaign, limit, offset])
      : marieDB.query(logsQuery, [limit, offset]);
    const countPromise = selectedCampaign
      ? marieDB.query(countQuery, [selectedCampaign])
      : marieDB.query(countQuery);

    const [summaryResult, campaignsResult, logsResult, countResult] = await Promise.all([
      summaryPromise,
      campaignsPromise,
      logsPromise,
      countPromise,
    ]);

    const capitalize = (s: string) =>
      s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const response = {
      success: true,
      total_scans: parseInt(summaryResult.rows[0]?.total_pv || '0', 10),
      total_unique: parseInt(summaryResult.rows[0]?.total_uv || '0', 10),
      total_new_devices: parseInt(summaryResult.rows[0]?.total_new_devices || '0', 10),
      campaigns: campaignsResult.rows.map(row => ({
        campaign_key: row.campaign_key,
        campaign_name: capitalize(row.campaign_name || row.campaign_key),
        total_pv: parseInt(row.total_pv || '0', 10),
        total_uv: parseInt(row.total_uv || '0', 10),
        new_devices: parseInt(row.new_devices || '0', 10),
        last_visited_at: row.last_visited_at,
      })),
      logs: logsResult.rows,
      total_logs: countResult.rows[0]?.total ?? 0,
      page,
      limit,
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
