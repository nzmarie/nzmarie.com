import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const e = path.join(process.cwd(), '.env');
  if (fs.existsSync(e)) {
    fs.readFileSync(e, 'utf8').split('\n').forEach(l => {
      const t = l.trim();
      if (!t || t.startsWith('#')) return;
      const i = t.indexOf('=');
      if (i === -1) return;
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    });
  }
}
loadEnv();

async function main() {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });

  console.log('=== has_rental_history counts ===');
  const c = await pool.query(`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE has_rental_history = true)::int as rented, COUNT(*) FILTER (WHERE has_rental_history = false)::int as not_rented, COUNT(*) FILTER (WHERE has_rental_history IS NULL)::int as null_rental FROM properties`);
  console.log('Total:', c.rows[0].total, '| rented:', c.rows[0].rented, '| not_rented:', c.rows[0].not_rented, '| null:', c.rows[0].null_rental);

  console.log('\n=== Sample with has_rental_history = true ===');
  const s = await pool.query(`SELECT id, address, suburb, has_rental_history, is_currently_rented FROM properties WHERE has_rental_history = true LIMIT 5`);
  s.rows.forEach(r => console.log(JSON.stringify(r)));

  console.log('\n=== Check column type ===');
  const t = await pool.query(`SELECT data_type, column_name FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'has_rental_history'`);
  console.log('has_rental_history type:', JSON.stringify(t.rows[0]));

  console.log('\n=== Run actual API query with Rented filter ===');
  const q = await pool.query(`SELECT p.id, p.address, p.suburb, p.has_rental_history FROM properties p WHERE 1=1 AND p.has_rental_history = true ORDER BY p.suburb ASC LIMIT 18`);
  console.log('Results:', q.rows.length);
  q.rows.forEach(r => console.log(r.address, '-', r.suburb, '- rented:', r.has_rental_history));

  console.log('\n=== Check if API fails due to other filters ===');
  const q2 = await pool.query(`SELECT COUNT(*)::int as cnt FROM properties p WHERE 1=1 AND p.has_rental_history = true`);
  console.log('Total rented:', q2.rows[0].cnt);

  console.log('\n=== Check data type of has_rental_history in result ===');
  const q3 = await pool.query(`SELECT has_rental_history, pg_typeof(has_rental_history) as col_type FROM properties WHERE has_rental_history = true LIMIT 1`);
  console.log('Type:', JSON.stringify(q3.rows[0]));

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });