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
  const params: unknown[] = [opts.suburb, opts.status];
  let idx = 3;
  let sql = `op.suburb = $1 AND op.status = $2
    AND op.street IS NOT NULL AND TRIM(op.street) <> ''`;
  if (opts.sentStatus === 'unsent' || opts.sentStatus === 'sent') {
    const exists = opts.sentStatus === 'sent' ? 'EXISTS' : 'NOT EXISTS';
    let sub = `SELECT 1 FROM outreach_send_logs sl3
      JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id
      WHERE sl3.outreach_property_id = op.id
        AND sr3.suburb = $${idx}`;
    params.push(opts.suburb);
    idx++;
    if (opts.reportQuarter) {
      const parts = opts.reportQuarter.split('-');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        sub += ` AND sr3.quarter = $${idx} AND sr3.year = $${idx + 1}`;
        params.push(parts[1], isNaN(y) ? 0 : y);
        idx += 2;
      }
    }
    sql += ` AND ${exists} (${sub})`;
    if (opts.sentStatus === 'unsent') {
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
