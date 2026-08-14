import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const body = await request.json() as {
      property_ids?: string[];
      suburb_report_id?: string;
      report_title?: string;
      campaign_key?: string;
      notes?: string;
    };

    const {
      property_ids,
      suburb_report_id,
      report_title = 'Quarterly Market Report',
      campaign_key = '2026_Q2',
      notes,
    } = body;

    if (!property_ids || !Array.isArray(property_ids) || property_ids.length === 0) {
      return NextResponse.json(
        { error: 'property_ids array is required' },
        { status: 400 }
      );
    }

    const propertiesResult = await marieDB.query(
      `SELECT id, suburb FROM outreach_properties WHERE id = ANY($1::uuid[])`,
      [property_ids]
    );

    if (propertiesResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No matching properties found' },
        { status: 404 }
      );
    }

    const sendUser = session.user.email;
    const insertedLogs = [];
    const affectedSuburbs = new Set<string>();

    for (const prop of propertiesResult.rows) {
      if (prop.suburb) {
        affectedSuburbs.add(prop.suburb);
      }
      const logRes = await marieDB.query(
        `INSERT INTO outreach_send_logs (
          outreach_property_id,
          suburb_report_id,
          report_title,
          campaign_key,
          suburb,
          sent_at,
          sent_by,
          notes
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        RETURNING *`,
        [
          prop.id,
          suburb_report_id || null,
          report_title,
          campaign_key,
          prop.suburb,
          sendUser,
          notes || null,
        ]
      );

      await marieDB.query(
        `UPDATE outreach_properties
         SET status = CASE WHEN status = 'pending' THEN 'sent' ELSE status END,
             total_send_count = COALESCE(total_send_count, 0) + 1,
             last_sent_at = NOW(),
             last_campaign = $1,
             sent_at = NOW(),
             sent_by = $2
         WHERE id = $3`,
        [campaign_key, sendUser, prop.id]
      );

      insertedLogs.push(logRes.rows[0]);
    }

    // Invalidate street-clusters cache for all affected suburbs
    for (const suburb of affectedSuburbs) {
      invalidateStreetClustersForSuburb(suburb).catch(() => { });
    }

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }

    return NextResponse.json({
      success: true,
      message: `Successfully logged sending for ${insertedLogs.length} properties`,
      count: insertedLogs.length,
      logs: insertedLogs,
    });
  } catch (error) {
    console.error('Error logging outreach send:', error);
    return NextResponse.json(
      { error: 'Failed to record send log' },
      { status: 500 }
    );
  }
}
