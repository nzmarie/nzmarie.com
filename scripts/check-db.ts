import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        process.env[trimmed.substring(0, index).trim()] = trimmed.substring(index + 1).trim();
      }
    }
  }
}

async function main() {
  loadEnv();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });

  const leads = await pool.query('SELECT id, client_name, property_address, email, timeline, created_at FROM appraisal_leads ORDER BY created_at DESC LIMIT 5');
  console.log('--- RECENT APPRAISAL LEADS ---');
  console.log(JSON.stringify(leads.rows, null, 2));

  const downloads = await pool.query('SELECT id, email, first_name, suburb, status, created_at FROM report_download_events ORDER BY created_at DESC LIMIT 5');
  console.log('\n--- RECENT REPORT DOWNLOADS ---');
  console.log(JSON.stringify(downloads.rows, null, 2));

  const reports = await pool.query('SELECT id, suburb, version, title, r2_key, is_active FROM market_reports ORDER BY created_at DESC LIMIT 5');
  console.log('\n--- MARKET REPORTS ---');
  console.log(JSON.stringify(reports.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
