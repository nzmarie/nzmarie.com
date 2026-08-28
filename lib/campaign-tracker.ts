import { query, marieDB } from './db';
import crypto from 'crypto';

export interface CampaignVisitOptions {
  campaignKey: string;
  campaignName?: string;
  ip?: string;
  userAgent?: string;
  referrer?: string;
  visitorId?: string;
}

export interface CampaignStats {
  campaign_key: string;
  campaign_name: string;
  total_pv: number;
  total_uv: number;
  last_visited_at: string | null;
}

let tablesEnsured = false;

export async function ensureCampaignTablesExist(): Promise<void> {
  if (tablesEnsured) return;
  try {
    // Step 1: ensure tables exist
    await marieDB.query(`
      CREATE TABLE IF NOT EXISTS campaign_analytics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_key VARCHAR(50) UNIQUE NOT NULL,
          campaign_name VARCHAR(100) NOT NULL,
          total_pv BIGINT DEFAULT 0,
          total_uv BIGINT DEFAULT 0,
          last_visited_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_campaign_key ON campaign_analytics(campaign_key);

      CREATE TABLE IF NOT EXISTS campaign_visit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_key VARCHAR(50) NOT NULL,
          visitor_hash VARCHAR(64) NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          device_type VARCHAR(20),
          referrer TEXT,
          is_unique BOOLEAN DEFAULT TRUE,
          visit_count INT NOT NULL DEFAULT 1,
          first_scanned_at TIMESTAMPTZ,
          last_scanned_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Step 2: add missing columns (separate queries so ALTER commits before indexes reference them)
    await marieDB.query(`ALTER TABLE campaign_visit_logs ADD COLUMN IF NOT EXISTS visit_count INT NOT NULL DEFAULT 1`);
    await marieDB.query(`ALTER TABLE campaign_visit_logs ADD COLUMN IF NOT EXISTS first_scanned_at TIMESTAMPTZ`);
    await marieDB.query(`ALTER TABLE campaign_visit_logs ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ`);
    await marieDB.query(`ALTER TABLE campaign_visit_logs ADD COLUMN IF NOT EXISTS is_new_device BOOLEAN DEFAULT TRUE`);

    // Step 3: create indexes (after columns exist)
    await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_campaign_time ON campaign_visit_logs(campaign_key, created_at DESC)`);
    await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_hash_time ON campaign_visit_logs(visitor_hash, created_at DESC)`);
    await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_campaign_visitor ON campaign_visit_logs(campaign_key, visitor_hash)`);
    await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_new_device ON campaign_visit_logs(is_new_device)`);

    // Backfill: correct rows that were stored with is_new_device=true due to
    // the old ip+ua fingerprint (which changed with each mobile IP rotation).
    // Rule: only the very first occurrence of a user_agent across all rows
    // may be marked is_new_device=true; every later occurrence must be false.
    await marieDB.query(`
      UPDATE campaign_visit_logs AS t
      SET is_new_device = FALSE
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_agent ORDER BY created_at ASC) AS rn
        FROM campaign_visit_logs
        WHERE is_new_device = TRUE
      ) ranked
      WHERE t.id = ranked.id
        AND ranked.rn > 1
    `);

    tablesEnsured = true;
  } catch (err) {
    console.error('Failed to ensure campaign tables exist:', err);
  }
}

export function anonymizeIP(ip: string = ''): string {
  if (!ip) return '0.0.0.xxx';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 2) {
      return `${parts.slice(0, 3).join(':')}::xxx`;
    }
  }
  return ip;
}

export function generateVisitorHash(ip: string = '', userAgent: string = '', visitorId?: string): string {
  if (visitorId) return crypto.createHash('sha256').update(`device:${visitorId}`).digest('hex');
  return crypto.createHash('sha256').update(`${ip}-${userAgent}`).digest('hex');
}

export function generateUAHash(userAgent: string = ''): string {
  return crypto.createHash('sha256').update(`ua:${userAgent}`).digest('hex');
}

export function parseDeviceType(userAgent: string = ''): string {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/android/.test(ua)) return 'Android';
  if (/macintosh|mac os x/.test(ua)) return 'Desktop';
  if (/windows/.test(ua)) return 'Desktop';
  if (/linux/.test(ua)) return 'Desktop';
  return 'Other';
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export async function recordCampaignVisit(options: CampaignVisitOptions): Promise<void> {
  const {
    campaignKey,
    campaignName = `${campaignKey.toUpperCase()} Campaign`,
    ip = '127.0.0.1',
    userAgent = '',
    referrer = '',
    visitorId,
  } = options;

  await ensureCampaignTablesExist();

  const deviceType = parseDeviceType(userAgent);
  const storedIp = anonymizeIP(ip);

  // When a visitorId (e.g. from FingerprintJS) is provided, use it as the
  // stable device key.  Otherwise fall back to a UA-only hash so that the
  // same physical device is recognised even when its mobile IP changes
  // between scans (very common on IPv6 LTE/5G networks).
  const uaHash = generateUAHash(userAgent);
  const ipUAHash = generateVisitorHash(ip, userAgent);
  let visitorHash: string;
  let hashFilter: string;
  let hashParams: unknown[];

  if (visitorId) {
    const vidHash = generateVisitorHash(ip, userAgent, visitorId);
    visitorHash = vidHash;
    const filters = [vidHash, ipUAHash, uaHash].filter((v, i, a) => a.indexOf(v) === i);
    hashFilter = filters.length === 1 ? `visitor_hash = $2` : `visitor_hash = ANY($2::text[])`;
    hashParams = filters.length === 1 ? [campaignKey, filters[0]] : [campaignKey, filters];
  } else {
    // No fingerprintjs – use the UA-only hash as the stable device identifier.
    // We also store the ip+ua variant as a secondary lookup so historical rows
    // (recorded before this fix) are still matched.
    visitorHash = uaHash;
    const allHashes = [uaHash, ipUAHash].filter((v, i, a) => a.indexOf(v) === i);
    hashFilter = allHashes.length === 1 ? `visitor_hash = $2` : `visitor_hash = ANY($2::text[])`;
    hashParams = allHashes.length === 1 ? [campaignKey, allHashes[0]] : [campaignKey, allHashes];
  }

  const prev = await query<{ cnt: string | number; global_cnt: string | number; first_scanned_at: string | Date | null }>(
    `SELECT
       COUNT(*) FILTER (WHERE campaign_key = $1 AND ${hashFilter})::int AS cnt,
       COUNT(*)::int AS global_cnt,
       MIN(created_at) FILTER (WHERE campaign_key = $1 AND ${hashFilter}) AS first_scanned_at
     FROM campaign_visit_logs
     WHERE ${hashFilter.replace('campaign_key = $1 AND ', '')}`,
    hashParams
  );

  const prevRow = prev.rows[0];
  const prevCount = Number(prevRow?.cnt ?? 0);
  const isUnique = prevCount === 0;

  const isNewDevice = Number(prevRow?.global_cnt ?? 0) === 0;
  const visitCount = prevCount + 1;
  const firstScannedAt = prevRow?.first_scanned_at ?? null;

  await query(
    `INSERT INTO campaign_visit_logs (campaign_key, visitor_hash, ip_address, user_agent, device_type, referrer, is_unique, is_new_device, visit_count, first_scanned_at, last_scanned_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()), NOW())`,
    [campaignKey, visitorHash, storedIp, userAgent, deviceType, referrer, isUnique, isNewDevice, visitCount, firstScannedAt]
  );

  await query(
    `INSERT INTO campaign_analytics (campaign_key, campaign_name, total_pv, total_uv, last_visited_at)
     VALUES ($1, $2, 1, $3, NOW())
     ON CONFLICT (campaign_key)
     DO UPDATE SET
        total_pv = campaign_analytics.total_pv + 1,
        total_uv = campaign_analytics.total_uv + (CASE WHEN $4::boolean THEN 1 ELSE 0 END),
        last_visited_at = NOW(),
        updated_at = NOW()`,
    [campaignKey, campaignName, isUnique ? 1 : 0, isUnique]
  );
}

export async function getCampaignStats(campaignKey: string): Promise<CampaignStats | null> {
  await ensureCampaignTablesExist();
  const res = await query<CampaignStats>(
    `SELECT campaign_key, campaign_name, total_pv, total_uv, last_visited_at
     FROM campaign_analytics
     WHERE campaign_key = $1`,
    [campaignKey]
  );
  return res.rows[0] || null;
}
