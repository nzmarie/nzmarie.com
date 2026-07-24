import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    }
  }
}

loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('Inserting Business Card into campaign_analytics...');
    await pool.query(`
      INSERT INTO campaign_analytics (campaign_key, campaign_name, total_pv, total_uv, last_visited_at)
      VALUES ('business_card', 'Business Card', 3, 2, NOW())
      ON CONFLICT (campaign_key)
      DO UPDATE SET
        campaign_name = 'Business Card',
        last_visited_at = NOW(),
        updated_at = NOW()
    `);
    console.log('OK');

    const r = await pool.query('SELECT * FROM campaign_analytics ORDER BY last_visited_at DESC');
    console.log('campaign_analytics:', JSON.stringify(r.rows, null, 2));

    await pool.end();
    console.log('\nDone.');
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}

main();
