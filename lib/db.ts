import { Pool, QueryResult, QueryResultRow } from 'pg';

// Marie DB (Singapore) - Admin system data (read/write)
const mariePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

// Louis DB (Jakarta) - Property data (read-only)
const louisPool = new Pool({
  connectionString: process.env.LOUIS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

// Helper function for Marie DB (read/write)
export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return mariePool.query<T>(text, params);
}

// Helper function for Louis DB (read-only)
export async function queryLouis<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return louisPool.query<T>(text, params);
}

// Export pools for direct access
export interface MarieDBPool extends Pool {
  ensureOutreachTablesExist?: () => Promise<void>;
}

export const marieDB: MarieDBPool = mariePool as MarieDBPool;
export const louisDB = louisPool;

// Legacy export for backward compatibility
export const pool = mariePool;

let _outreachTableEnsured = false;

export async function ensureOutreachTablesExist(): Promise<void> {
  if (_outreachTableEnsured) return;
  try {
    // Create outreach_properties and outreach_qr_tokens if they don't exist.
    const sql = `
    CREATE TABLE IF NOT EXISTS outreach_properties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      louis_property_id VARCHAR(100),
      property_address TEXT NOT NULL,
      suburb VARCHAR(100) NOT NULL,
      city VARCHAR(100) NOT NULL,
      region VARCHAR(100) NOT NULL,
      street VARCHAR(200),
      owner_name VARCHAR(200),
      property_type VARCHAR(50),
      campaign VARCHAR(100) NOT NULL DEFAULT '2026_Q3_Report',
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      sent_at TIMESTAMP,
      interacted_at TIMESTAMP,
      converted_at TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      selected_by VARCHAR(255),
      selected_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_properties(status);
    CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_properties(suburb);
    CREATE INDEX IF NOT EXISTS idx_outreach_campaign ON outreach_properties(campaign);

    CREATE TABLE IF NOT EXISTS outreach_qr_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token VARCHAR(100) UNIQUE NOT NULL,
      outreach_property_id UUID REFERENCES outreach_properties(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      scanned_at TIMESTAMP,
      scan_count INT DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_qr_token ON outreach_qr_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_qr_property ON outreach_qr_tokens(outreach_property_id);
    `;

    await mariePool.query(sql);
    _outreachTableEnsured = true;
  } catch (err) {
    console.error('Failed to ensure outreach tables exist:', err);
    throw err;
  }
}

// Attach helper to the exported pool object for backwards-compatible runtime access
// so tests that partially mock `marieDB` won't require a named export.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
mariePool.ensureOutreachTablesExist = ensureOutreachTablesExist;
