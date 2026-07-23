const { Pool } = require('pg');
const pool = new Pool({
  host: 'baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud',
  port: 26257,
  database: 'defaultdb',
  user: 'nzmarie',
  password: 'HHa_pWigbE_OcEX83FNRPg',
  ssl: { rejectUnauthorized: false },
});
(async () => {
  try {
    const r = await pool.query(
      `UPDATE leads SET property_id = $1 WHERE property_address ILIKE '%Sartors%' RETURNING id, property_address, property_id`,
      ['229d0b7ab7b1646da2d1b475a175214f']
    );
    console.log('Updated:', JSON.stringify(r.rows[0], null, 2));
  } catch (e) { console.error(e.message); }
  await pool.end();
})();
