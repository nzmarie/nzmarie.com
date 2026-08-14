export interface OutreachFilterOptions {
  suburb: string;
  status: string;
  sentStatus: 'all' | 'unsent' | 'sent';
  reportQuarter?: string | null;
}

export interface OutreachFilter {
  sql: string;
  params: unknown[];
}

export function buildOutreachFilter(opts: OutreachFilterOptions): OutreachFilter {
  const params: unknown[] = [opts.suburb];
  let idx = 2;
  let sql = `op.suburb = $1
    AND op.street IS NOT NULL AND TRIM(op.street) <> ''`;

  if (opts.status === 'pending') {
    if (opts.sentStatus === 'all') {
      sql += ` AND op.status IN ('pending', 'sent')`;
    } else if (opts.sentStatus === 'sent') {
      sql += ` AND (op.status = 'sent' OR op.status = 'pending')`;
    } else {
      sql += ` AND op.status = 'pending'`;
    }
  } else if (opts.status) {
    sql += ` AND op.status = $${idx}`;
    params.push(opts.status);
    idx++;
  }

  if (opts.sentStatus === 'unsent' || opts.sentStatus === 'sent') {
    const exists = opts.sentStatus === 'sent' ? 'EXISTS' : 'NOT EXISTS';
    let sub = `SELECT 1 FROM outreach_send_logs sl3
      LEFT JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id
      WHERE sl3.outreach_property_id = op.id
        AND (sl3.suburb = $${idx} OR sr3.suburb = $${idx} OR sl3.suburb IS NULL)`;
    params.push(opts.suburb);
    idx++;
    if (opts.reportQuarter) {
      const parts = opts.reportQuarter.split('-');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const q = parts[1];
        const qAlt = opts.reportQuarter.replace('-', '_');
        sub += ` AND ((sr3.quarter = $${idx} AND sr3.year = $${idx + 1}) OR sl3.campaign_key = $${idx + 2} OR sl3.campaign_key = $${idx + 3} OR op.last_campaign = $${idx + 2} OR op.last_campaign = $${idx + 3})`;
        params.push(q, isNaN(y) ? 0 : y, opts.reportQuarter, qAlt);
        idx += 4;
      }
    }
    if (opts.sentStatus === 'sent') {
      sql += ` AND (${exists} (${sub}) OR op.status = 'sent' OR COALESCE(op.total_send_count, 0) > 0 OR op.last_sent_at IS NOT NULL OR op.sent_at IS NOT NULL)`;
    } else {
      sql += ` AND (${exists} (${sub}) AND COALESCE(op.total_send_count, 0) = 0 AND op.last_sent_at IS NULL AND op.sent_at IS NULL)`;
      sql += ` AND NOT EXISTS (
        SELECT 1
        FROM properties p2
        WHERE REPLACE(op.property_id::text, '-', '') = p2.id
          AND p2.no_junk_mail = true
      )`;
    }
  }
  return { sql, params };
}
