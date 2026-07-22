import { query, marieDB } from './db';
import crypto from 'crypto';

export interface CampaignVisitOptions {
  campaignKey: string;
  campaignName?: string;
  ip?: string;
  userAgent?: string;
  referrer?: string;
  deviceType?: string;
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
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_visit_logs_campaign_time ON campaign_visit_logs(campaign_key, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_visit_logs_hash_time ON campaign_visit_logs(visitor_hash, created_at DESC);
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

export function generateVisitorHash(ip: string = '', userAgent: string = ''): string {
  return crypto.createHash('sha256').update(`${ip}-${userAgent}`).digest('hex');
}

export async function recordCampaignVisit(options: CampaignVisitOptions): Promise<void> {
  const {
    campaignKey,
    campaignName = `${campaignKey.toUpperCase()} Campaign`,
    ip = '127.0.0.1',
    userAgent = '',
    referrer = '',
    deviceType = 'mobile',
  } = options;

  await ensureCampaignTablesExist();

  const visitorHash = generateVisitorHash(ip, userAgent);
  const anonymizedIp = anonymizeIP(ip);

  const existing = await query<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM campaign_visit_logs 
     WHERE campaign_key = $1 AND visitor_hash = $2 AND created_at > NOW() - INTERVAL '24 hours'`,
    [campaignKey, visitorHash]
  );

  const isUnique = parseInt(existing.rows[0]?.count || '0', 10) === 0;

  await query(
    `INSERT INTO campaign_visit_logs (campaign_key, visitor_hash, ip_address, user_agent, device_type, referrer, is_unique)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [campaignKey, visitorHash, anonymizedIp, userAgent, deviceType, referrer, isUnique]
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
