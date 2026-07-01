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
export const marieDB = mariePool;
export const louisDB = louisPool;

// Legacy export for backward compatibility
export const pool = mariePool;
