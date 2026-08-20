import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { getCachedOrFetch } from '@/lib/redis';
import { db } from '@/lib/drizzle';
import { ensureCampaignTablesExist } from '@/lib/campaign-tracker';
import { sql } from 'drizzle-orm';

interface SuburbCountRow {
  suburb?: string;
  sent_count?: string | number;
}

interface OutreachSuburbRow {
  suburb?: string;
  pending_count?: string | number;
  sent_count?: string | number;
  total_count?: string | number;
  last_sent_at?: string | Date | null;
}

interface SentSummaryItem {
  suburb: string;
  sent_count: number;
}

interface ScanCampaignItem {
  campaign_key: string;
  campaign_name: string;
  total_pv: number;
  total_uv: number;
}

interface ScanCampaignRow {
  campaign_key?: string;
  campaign_name?: string | null;
  total_pv?: string | number;
  total_uv?: string | number;
}

interface SuburbDownloadRow {
  suburb?: string;
  download_count?: string | number;
}

interface TrendRow {
  suburb?: string;
  bucket?: string;
  sent?: string | number;
  junk?: string | number;
}

interface SuburbDispatchRow {
  suburb?: string;
  sent_count?: string | number;
  junk_count?: string | number;
  total_count?: string | number;
  unsent_count?: string | number;
  first_sent_at?: string | Date | null;
  last_sent_at?: string | Date | null;
}

interface TrendBucket {
  bucket: string;
  sent: number;
  junk: number;
}

interface BuiltTrend {
  all: TrendBucket[];
  bySuburb: Record<string, TrendBucket[]>;
}

function buildTrend(sentRows: TrendRow[], junkRows: TrendRow[]): BuiltTrend {
  const bySuburb: Record<string, Map<string, TrendBucket>> = {};
  const allMap = new Map<string, TrendBucket>();
  const ensure = (suburb: string, bucket: string): TrendBucket => {
    if (!bySuburb[suburb]) bySuburb[suburb] = new Map();
    let b = bySuburb[suburb].get(bucket);
    if (!b) {
      b = { bucket, sent: 0, junk: 0 };
      bySuburb[suburb].set(bucket, b);
    }
    return b;
  };
  for (const r of sentRows) {
    if (!r.suburb || !r.bucket) continue;
    ensure(r.suburb, r.bucket).sent += Number(r.sent) || 0;
  }
  for (const r of junkRows) {
    if (!r.suburb || !r.bucket) continue;
    ensure(r.suburb, r.bucket).junk += Number(r.junk) || 0;
  }
  const sortArr = (arr: TrendBucket[]) => arr.sort((a, b) => a.bucket.localeCompare(b.bucket));
  const perSuburb: Record<string, TrendBucket[]> = {};
  for (const [suburb, map] of Object.entries(bySuburb)) {
    const buckets = sortArr([...map.values()]);
    perSuburb[suburb] = buckets;
    for (const b of buckets) {
      const cur = allMap.get(b.bucket) ?? { bucket: b.bucket, sent: 0, junk: 0 };
      cur.sent += b.sent;
      cur.junk += b.junk;
      allMap.set(b.bucket, cur);
    }
  }
  return { all: sortArr([...allMap.values()]), bySuburb: perSuburb };
}

function toTrendRows(value: unknown): TrendRow[] {
  return Array.isArray(value) ? value as TrendRow[] : [];
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');

  try {
    await ensureCampaignTablesExist();

    const cacheKey = `dashboard:stats:${suburb || 'all'}`;

    const result = await getCachedOrFetch(
      cacheKey,
      async () => {
        const suburbFilter = suburb && suburb !== 'all';
        const suburbCondition = suburbFilter ? sql`AND suburb = ${suburb}` : sql``;

        const dbResult = await db.execute(sql`
          WITH
            new_leads_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)
              ${suburbCondition}
            ),
            high_priority_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE priority = 'high'
              ${suburbCondition}
            ),
            pending_outreach_cte AS (
              SELECT COUNT(*) as count FROM outreach_properties
              WHERE LOWER(status) = 'pending'
              ${suburbCondition}
            ),
            sent_outreach_cte AS (
              SELECT COUNT(*) as count FROM outreach_properties
              WHERE LOWER(status) = 'sent'
              ${suburbCondition}
            ),
            today_followups_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE follow_up_at::date = CURRENT_DATE
              AND contact_status NOT IN ('converted', 'lost')
              ${suburbCondition}
            ),
            overdue_followups_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE follow_up_at::date < CURRENT_DATE
              AND contact_status NOT IN ('converted', 'lost')
              ${suburbCondition}
            ),
            today_downloads_cte AS (
              SELECT COUNT(*) as count FROM report_downloads
              WHERE downloaded_at::date = CURRENT_DATE
            ),
            total_downloads_cte AS (
              SELECT COUNT(*) as count FROM report_downloads
            ),
            month_downloads_cte AS (
              SELECT COUNT(*) as count FROM report_downloads
              WHERE downloaded_at >= date_trunc('month', CURRENT_TIMESTAMP)
            ),
            total_bookings_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
            ),
            month_bookings_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)
            ),
            qr_codes_cte AS (
              SELECT COUNT(*) as count FROM suburb_qr_codes
            ),
            pdf_reports_cte AS (
              SELECT COUNT(*) as count FROM suburb_reports
              WHERE status = 'active'
            ),
            outreach_by_suburb_full_cte AS MATERIALIZED (
              SELECT
                op.suburb,
                COUNT(*) FILTER (WHERE LOWER(op.status) IN ('pending', 'sent')) as pending_count,
                COUNT(*) FILTER (WHERE LOWER(op.status) = 'sent') as sent_count,
                COUNT(*) as total_count,
                MAX(sl.sent_at) AS last_sent_at
              FROM outreach_properties op
              LEFT JOIN outreach_send_logs sl ON sl.outreach_property_id = op.id
              WHERE op.suburb IS NOT NULL
              GROUP BY op.suburb
            ),
            outreach_by_suburb_cte AS (
              SELECT * FROM outreach_by_suburb_full_cte
              ORDER BY last_sent_at DESC NULLS LAST, total_count DESC
              LIMIT 20
            ),
            sent_summary_cte AS (
              SELECT
                suburb,
                sent_count
              FROM outreach_by_suburb_full_cte
              WHERE sent_count > 0
              ORDER BY sent_count DESC, suburb ASC
            ),
            scans_summary_cte AS (
              SELECT
                COALESCE(SUM(total_pv), 0) as total_pv,
                COALESCE(SUM(total_uv), 0) as total_uv
              FROM campaign_analytics
            ),
            scans_by_campaign_cte AS (
              SELECT
                campaign_key,
                campaign_name,
                total_pv,
                total_uv
              FROM campaign_analytics
              ORDER BY total_pv DESC
            ),
            downloads_by_suburb_cte AS (
              SELECT
                suburb,
                COUNT(*) as download_count
              FROM report_downloads
              GROUP BY suburb
              ORDER BY download_count DESC
              LIMIT 20
            ),
            recent_downloads_cte AS (
              SELECT
                id, email, name, suburb,
                downloaded_at, source, tracking_code
              FROM report_downloads
              ORDER BY downloaded_at DESC
              LIMIT 5
            ),
            sent_logs_buckets AS MATERIALIZED (
              SELECT
                sl.suburb,
                date_trunc('day', sl.sent_at AT TIME ZONE 'Pacific/Auckland') AS day_bucket,
                date_trunc('week', sl.sent_at AT TIME ZONE 'Pacific/Auckland') AS week_bucket,
                date_trunc('month', sl.sent_at AT TIME ZONE 'Pacific/Auckland') AS month_bucket,
                date_trunc('quarter', sl.sent_at AT TIME ZONE 'Pacific/Auckland') AS quarter_bucket,
                sl.outreach_property_id
              FROM outreach_send_logs sl
              WHERE sl.sent_at IS NOT NULL
            ),
            dispatched_ids_cte AS MATERIALIZED (
              SELECT DISTINCT outreach_property_id AS id
              FROM outreach_send_logs
            ),
            junk_props_buckets AS MATERIALIZED (
              SELECT
                op.suburb,
                date_trunc('day', (CASE WHEN p.no_junk_mail = TRUE AND p.no_junk_mail_updated_at IS NOT NULL
                                        THEN p.no_junk_mail_updated_at
                                        ELSE op.created_at
                                   END) AT TIME ZONE 'Pacific/Auckland') AS day_bucket,
                date_trunc('week', (CASE WHEN p.no_junk_mail = TRUE AND p.no_junk_mail_updated_at IS NOT NULL
                                         THEN p.no_junk_mail_updated_at
                                         ELSE op.created_at
                                    END) AT TIME ZONE 'Pacific/Auckland') AS week_bucket,
                date_trunc('month', (CASE WHEN p.no_junk_mail = TRUE AND p.no_junk_mail_updated_at IS NOT NULL
                                          THEN p.no_junk_mail_updated_at
                                          ELSE op.created_at
                                     END) AT TIME ZONE 'Pacific/Auckland') AS month_bucket,
                date_trunc('quarter', (CASE WHEN p.no_junk_mail = TRUE AND p.no_junk_mail_updated_at IS NOT NULL
                                            THEN p.no_junk_mail_updated_at
                                            ELSE op.created_at
                                       END) AT TIME ZONE 'Pacific/Auckland') AS quarter_bucket,
                op.id AS property_id
              FROM outreach_properties op
              JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
              LEFT JOIN dispatched_ids_cte d ON d.id = op.id
              WHERE p.no_junk_mail = TRUE
                AND LOWER(op.status) = 'pending'
                AND d.id IS NULL
            ),
            junk_by_suburb_cte AS (
              SELECT
                suburb,
                COUNT(DISTINCT property_id)::int AS junk_count
              FROM junk_props_buckets
              GROUP BY suburb
            ),
            dispatch_by_suburb_cte AS (
              SELECT
                op.suburb,
                COUNT(DISTINCT op.id) FILTER (WHERE sl.id IS NOT NULL OR LOWER(op.status) = 'sent') AS sent_count,
                COUNT(DISTINCT op.id) FILTER (WHERE LOWER(op.status) IN ('pending', 'sent')) AS total_count,
                MIN(sl.sent_at) AS first_sent_at,
                MAX(sl.sent_at) AS last_sent_at
              FROM outreach_properties op
              LEFT JOIN outreach_send_logs sl ON sl.outreach_property_id = op.id
              WHERE op.suburb IS NOT NULL
              GROUP BY op.suburb
            )
          SELECT
            (SELECT count FROM new_leads_cte) as new_leads,
            (SELECT count FROM high_priority_cte) as high_priority_leads,
            (SELECT count FROM pending_outreach_cte) as pending_outreach,
            (SELECT count FROM sent_outreach_cte) as sent_outreach,
            (SELECT count FROM today_followups_cte) as today_followups,
            (SELECT count FROM overdue_followups_cte) as overdue_followups,
            (SELECT count FROM today_downloads_cte) as today_downloads,
            (SELECT count FROM total_downloads_cte) as total_downloads,
            (SELECT count FROM month_downloads_cte) as month_downloads,
            (SELECT count FROM total_bookings_cte) as total_bookings,
            (SELECT count FROM month_bookings_cte) as month_bookings,
            (SELECT count FROM qr_codes_cte) as qr_codes_total,
            (SELECT count FROM pdf_reports_cte) as pdf_reports_total,
            (SELECT json_agg(row_to_json(s)) FROM outreach_by_suburb_cte s) as outreach_by_suburb,
            (SELECT json_agg(row_to_json(s)) FROM sent_summary_cte s) as sent_summary_suburbs,
            (SELECT COUNT(*) FROM sent_summary_cte) as sent_summary_suburb_count,
            (SELECT COALESCE(SUM(sent_count), 0) FROM sent_summary_cte) as sent_summary_total_sent,
            (SELECT total_pv FROM scans_summary_cte) as total_scans,
            (SELECT total_uv FROM scans_summary_cte) as total_unique_scans,
            (SELECT json_agg(row_to_json(s)) FROM scans_by_campaign_cte s) as scan_campaigns,
            (SELECT json_agg(row_to_json(s)) FROM downloads_by_suburb_cte s) as downloads_by_suburb,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, TO_CHAR(day_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT outreach_property_id)::int AS sent FROM sent_logs_buckets GROUP BY suburb, day_bucket ORDER BY day_bucket) s) as sent_daily,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, TO_CHAR(week_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT outreach_property_id)::int AS sent FROM sent_logs_buckets GROUP BY suburb, week_bucket ORDER BY week_bucket) s) as sent_weekly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, TO_CHAR(month_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT outreach_property_id)::int AS sent FROM sent_logs_buckets GROUP BY suburb, month_bucket ORDER BY month_bucket) s) as sent_monthly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, TO_CHAR(quarter_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT outreach_property_id)::int AS sent FROM sent_logs_buckets GROUP BY suburb, quarter_bucket ORDER BY quarter_bucket) s) as sent_quarterly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, TO_CHAR(day_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, day_bucket ORDER BY day_bucket) s) as junk_daily,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, TO_CHAR(week_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, week_bucket ORDER BY week_bucket) s) as junk_weekly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, TO_CHAR(month_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, month_bucket ORDER BY month_bucket) s) as junk_monthly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, TO_CHAR(quarter_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, quarter_bucket ORDER BY quarter_bucket) s) as junk_quarterly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (
              SELECT d.suburb, d.sent_count, COALESCE(j.junk_count, 0) AS junk_count,
                     GREATEST(0, d.total_count - d.sent_count - COALESCE(j.junk_count, 0)) AS unsent_count,
                     d.total_count, d.first_sent_at, d.last_sent_at
              FROM dispatch_by_suburb_cte d
              LEFT JOIN junk_by_suburb_cte j ON j.suburb = d.suburb
            ) s) as dispatch_by_suburb,
            (SELECT json_agg(row_to_json(r)) FROM recent_downloads_cte r) as recent_downloads
        `);

        const row = dbResult.rows[0] as Record<string, unknown>;
        const outreachBySuburb: Array<{ suburb: string; pending_count: number; sent_count: number; total_count: number; last_sent_at: string | null }> =
          (Array.isArray(row.outreach_by_suburb) ? row.outreach_by_suburb as OutreachSuburbRow[] : [])
            .map((item) => ({
              suburb: item?.suburb || 'Unknown',
              pending_count: Number(item?.pending_count) || 0,
              sent_count: Number(item?.sent_count) || 0,
              total_count: Number(item?.total_count) || 0,
              last_sent_at: item?.last_sent_at ? new Date(item.last_sent_at).toISOString() : null,
            }));
        const sentSummarySuburbs: SuburbCountRow[] = Array.isArray(row.sent_summary_suburbs) && (row.sent_summary_suburbs as SuburbCountRow[]).length > 0
          ? row.sent_summary_suburbs as SuburbCountRow[]
          : outreachBySuburb.filter((item) => Number(item?.sent_count) > 1);

        const sentSummary: SentSummaryItem[] = sentSummarySuburbs.map((item) => ({
          suburb: item?.suburb || 'Unknown',
          sent_count: Number(item?.sent_count) || 0,
        }));

        const scanCampaigns: ScanCampaignItem[] = Array.isArray(row.scan_campaigns) ? (row.scan_campaigns as ScanCampaignRow[]).map((item) => ({
          campaign_key: item?.campaign_key || '',
          campaign_name: (item?.campaign_name || item?.campaign_key || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          total_pv: Number(item?.total_pv) || 0,
          total_uv: Number(item?.total_uv) || 0,
        })) : [];

        const filterRows = (rows: TrendRow[]): TrendRow[] =>
          suburbFilter ? rows.filter((r) => r.suburb === suburb) : rows;

        const builtDaily = buildTrend(filterRows(toTrendRows(row.sent_daily)), filterRows(toTrendRows(row.junk_daily)));
        const builtWeekly = buildTrend(filterRows(toTrendRows(row.sent_weekly)), filterRows(toTrendRows(row.junk_weekly)));
        const builtMonthly = buildTrend(filterRows(toTrendRows(row.sent_monthly)), filterRows(toTrendRows(row.junk_monthly)));
        const builtQuarterly = buildTrend(filterRows(toTrendRows(row.sent_quarterly)), filterRows(toTrendRows(row.junk_quarterly)));

        const dispatchBySuburb: Array<{ suburb: string; sent_count: number; junk_count: number; unsent_count: number; total_count: number; first_sent_at: string | null; last_sent_at: string | null }> =
          (Array.isArray(row.dispatch_by_suburb) ? row.dispatch_by_suburb as SuburbDispatchRow[] : [])
            .filter((item) => item?.suburb && (!suburbFilter || item.suburb === suburb))
            .map((item) => {
              const sent = Number(item.sent_count) || 0;
              const junk = Number(item.junk_count) || 0;
              const total = Number(item.total_count) || 0;
              const unsent = Number.isFinite(Number(item.unsent_count)) ? Number(item.unsent_count) : Math.max(0, total - sent - junk);
              return {
                suburb: item.suburb as string,
                sent_count: sent,
                junk_count: junk,
                unsent_count: unsent,
                total_count: total,
                first_sent_at: item.first_sent_at ? new Date(item.first_sent_at).toISOString() : null,
                last_sent_at: item.last_sent_at ? new Date(item.last_sent_at).toISOString() : null,
              };
            })
            // Most recently sent suburbs first; suburbs with no send activity last.
            .sort((a, b) => {
              const ta = a.last_sent_at ? new Date(a.last_sent_at).getTime() : Number.NEGATIVE_INFINITY;
              const tb = b.last_sent_at ? new Date(b.last_sent_at).getTime() : Number.NEGATIVE_INFINITY;
              return tb - ta;
            });

        return {
          newLeads: Number(row.new_leads) || 0,
          highPriorityLeads: Number(row.high_priority_leads) || 0,
          pendingOutreach: Number(row.pending_outreach) || 0,
          sentOutreach: Number(row.sent_outreach) || 0,
          todayFollowups: Number(row.today_followups) || 0,
          overdueFollowups: Number(row.overdue_followups) || 0,
          todayDownloads: Number(row.today_downloads) || 0,
          totalDownloads: Number(row.total_downloads) || 0,
          monthDownloads: Number(row.month_downloads) || 0,
          totalBookings: Number(row.total_bookings) || 0,
          monthBookings: Number(row.month_bookings) || 0,
          qrCodesTotal: Number(row.qr_codes_total) || 0,
          pdfReportsTotal: Number(row.pdf_reports_total) || 0,
          outreachBySuburb,
          sentSummary: {
            total_sent: Number(row.sent_summary_total_sent) || sentSummary.reduce((sum: number, item) => sum + Number(item.sent_count || 0), 0),
            suburb_count: Number(row.sent_summary_suburb_count) || sentSummary.length,
            suburbs: sentSummary,
          },
          scanStats: {
            total_scans: Number(row.total_scans) || 0,
            total_unique: Number(row.total_unique_scans) || 0,
            campaigns: scanCampaigns,
          },
          downloadsBySuburb: Array.isArray(row.downloads_by_suburb) ? (row.downloads_by_suburb as SuburbDownloadRow[]).map((item) => ({
            suburb: item?.suburb || 'Unknown',
            download_count: Number(item?.download_count) || 0,
          })) : [],
          recentDownloads: row.recent_downloads || [],
          dispatchTrend: {
            daily: builtDaily.all,
            weekly: builtWeekly.all,
            monthly: builtMonthly.all,
            quarterly: builtQuarterly.all,
            seriesBySuburb: {
              daily: builtDaily.bySuburb,
              weekly: builtWeekly.bySuburb,
              monthly: builtMonthly.bySuburb,
              quarterly: builtQuarterly.bySuburb,
            },
            bySuburb: dispatchBySuburb,
          },
        };
      },
      600
    );

    return NextResponse.json({
      success: true,
      stats: result,
      suburb: suburb || 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
