import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET() {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [
      newLeadsResult,
      highPriorityResult,
      pendingOutreachResult,
      todayFollowupsResult,
      overdueFollowupsResult,
      activeReportsResult,
    ] = await Promise.all([
      marieDB.query(
        `SELECT COUNT(*) as count FROM appraisal_leads 
         WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)`
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM appraisal_leads 
         WHERE priority = 'high'`
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM outreach_selected_properties 
         WHERE status = 'PENDING'`
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM appraisal_leads 
         WHERE follow_up_at::date = CURRENT_DATE 
         AND contact_status NOT IN ('converted', 'lost')`
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM appraisal_leads 
         WHERE follow_up_at::date < CURRENT_DATE 
         AND contact_status NOT IN ('converted', 'lost')`
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM report_downloads 
         WHERE downloaded_at >= CURRENT_DATE`
      ),
    ]);

    const stats = {
      newLeads: parseInt(newLeadsResult.rows[0]?.count || '0'),
      highPriorityLeads: parseInt(highPriorityResult.rows[0]?.count || '0'),
      pendingOutreach: parseInt(pendingOutreachResult.rows[0]?.count || '0'),
      todayFollowups: parseInt(todayFollowupsResult.rows[0]?.count || '0'),
      overdueFollowups: parseInt(overdueFollowupsResult.rows[0]?.count || '0'),
      todayDownloads: parseInt(activeReportsResult.rows[0]?.count || '0'),
    };

    return NextResponse.json({
      success: true,
      stats,
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
