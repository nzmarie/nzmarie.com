import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');

  try {
    const suburbFilter = suburb && suburb !== 'all' ? suburb : null;
    const suburbCondition = suburbFilter 
      ? 'AND COALESCE(suburb, \'\') = $1' 
      : '';
    const suburbParams = suburbFilter ? [suburbFilter] : [];

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
         WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)
         ${suburbCondition}`,
        suburbParams
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM appraisal_leads 
         WHERE priority = 'high'
         ${suburbCondition}`,
        suburbParams
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM outreach_selected_properties 
         WHERE status = 'PENDING'
         ${suburbCondition}`,
        suburbParams
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM appraisal_leads 
         WHERE follow_up_at >= CURRENT_DATE 
         AND follow_up_at < CURRENT_DATE + INTERVAL '1 day'
         AND contact_status NOT IN ('converted', 'lost')
         ${suburbCondition}`,
        suburbParams
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM appraisal_leads 
         WHERE follow_up_at < CURRENT_DATE 
         AND contact_status NOT IN ('converted', 'lost')
         ${suburbCondition}`,
        suburbParams
      ),
      marieDB.query(
        `SELECT COUNT(*) as count FROM report_downloads 
         WHERE downloaded_at >= CURRENT_DATE
         ${suburbCondition}`,
        suburbParams
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
      suburb: suburbFilter || 'all',
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
