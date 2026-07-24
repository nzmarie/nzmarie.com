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
    // 1. Check current logs
    const logsBefore = await pool.query(
      'SELECT id, campaign_key, visitor_hash, created_at FROM campaign_visit_logs ORDER BY created_at DESC LIMIT 10'
    );
    console.log('campaign_visit_logs (latest 10):');
    logsBefore.rows.forEach(r => console.log(`  ${r.created_at} | ${r.campaign_key} | ${r.visitor_hash?.substring(0,12)}... | ${r.id}`));

    const pvBefore = await pool.query('SELECT campaign_key, total_pv, total_uv FROM campaign_analytics ORDER BY total_pv DESC');
    console.log('\ncampaign_analytics before:');
    pvBefore.rows.forEach(r => console.log(`  ${r.campaign_key}: pv=${r.total_pv} uv=${r.total_uv}`));

    // 2. Delete the fake business_card entry we created earlier (no matching logs)
    await pool.query("DELETE FROM campaign_analytics WHERE campaign_key = 'business_card'");
    console.log('\nDeleted fake business_card entry from campaign_analytics');

    // 3. Update the most recent campaign_visit_logs that are from the business card scan
    //    The user says the latest records (25/07/2026) are actually from the business card.
    //    These records have campaign_key='oteha' because the business card QR code wasn't
    //    properly set up. Move the 3 most recent oteha visitor records to business_card.
    const updateResult = await pool.query(`
      WITH latest_oteha AS (
        SELECT id FROM campaign_visit_logs
        WHERE campaign_key = 'oteha'
        ORDER BY created_at DESC
        LIMIT 3
      )
      UPDATE campaign_visit_logs
      SET campaign_key = 'business_card'
      WHERE id IN (SELECT id FROM latest_oteha)
      RETURNING id, campaign_key, created_at
    `);
    console.log(`\nUpdated ${updateResult.rowCount} records from oteha → business_card:`);
    updateResult.rows.forEach(r => console.log(`  ${r.created_at} | ${r.campaign_key} | ${r.id}`));

    // 4. Recalculate campaign_analytics from campaign_visit_logs
    await pool.query(`
      INSERT INTO campaign_analytics (campaign_key, campaign_name, total_pv, total_uv, last_visited_at)
      SELECT
        cvl.campaign_key,
        CASE
          WHEN cvl.campaign_key = 'business_card' THEN 'Business Card'
          WHEN cvl.campaign_key = 'oteha' THEN 'Oteha Campaign'
          ELSE cvl.campaign_key
        END,
        COUNT(*) AS total_pv,
        COUNT(DISTINCT visitor_hash) AS total_uv,
        MAX(created_at) AS last_visited_at
      FROM campaign_visit_logs cvl
      WHERE cvl.campaign_key IN ('oteha', 'business_card')
      GROUP BY cvl.campaign_key
      ON CONFLICT (campaign_key)
      DO UPDATE SET
        total_pv = EXCLUDED.total_pv,
        total_uv = EXCLUDED.total_uv,
        last_visited_at = EXCLUDED.last_visited_at,
        updated_at = NOW(),
        campaign_name = EXCLUDED.campaign_name
    `);
    console.log('\nRecalculated campaign_analytics from actual visit logs');

    // 5. Verify
    const logsAfter = await pool.query(
      'SELECT id, campaign_key, visitor_hash, created_at FROM campaign_visit_logs ORDER BY created_at DESC LIMIT 10'
    );
    console.log('\ncampaign_visit_logs after:');
    logsAfter.rows.forEach(r => console.log(`  ${r.created_at} | ${r.campaign_key} | ${r.visitor_hash?.substring(0,12)}...`));

    const pvAfter = await pool.query('SELECT campaign_key, campaign_name, total_pv, total_uv FROM campaign_analytics ORDER BY total_pv DESC');
    console.log('\ncampaign_analytics after:');
    pvAfter.rows.forEach(r => console.log(`  ${r.campaign_key} (${r.campaign_name}): pv=${r.total_pv} uv=${r.total_uv}`));

    await pool.end();
    console.log('\nDone.');
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}

main();
