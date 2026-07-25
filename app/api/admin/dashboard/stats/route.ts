import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { getCachedOrFetch } from '@/lib/redis';
import { db } from '@/lib/drizzle';
import { sql } from 'drizzle-orm';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');

  try {
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
              SELECT COUNT(*) as count FROM outreach_selected_properties
              WHERE status = 'PENDING'
              ${suburbCondition}
            ),
            sent_outreach_cte AS (
              SELECT COUNT(*) as count FROM outreach_selected_properties
              WHERE status = 'SENT'
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
            outreach_by_suburb_cte AS (
              SELECT
                suburb,
                COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
                COUNT(*) FILTER (WHERE status = 'SENT') as sent_count,
                COUNT(*) as total_count
              FROM outreach_selected_properties
              GROUP BY suburb
              ORDER BY total_count DESC
              LIMIT 20
            ),
            recent_downloads_cte AS (
              SELECT
                id, email, name, suburb,
                downloaded_at, source, tracking_code
              FROM report_downloads
              ORDER BY downloaded_at DESC
              LIMIT 5
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
            (SELECT json_agg(row_to_json(r)) FROM recent_downloads_cte r) as recent_downloads
        `);

        const row = dbResult.rows[0] as Record<string, unknown>;

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
          outreachBySuburb: row.outreach_by_suburb || [],
          recentDownloads: row.recent_downloads || [],
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
