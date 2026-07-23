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
    const leads = await pool.query("SELECT id, property_address, property_id FROM leads WHERE property_address ILIKE '%Sartors%'");
    console.log('Lead:', JSON.stringify(leads.rows[0], null, 2));
    const props = await pool.query("SELECT id, address FROM properties WHERE address ILIKE '%Sartors%'");
    console.log('Properties:', JSON.stringify(props.rows, null, 2));
    const ops = await pool.query("SELECT id, property_address, property_id FROM outreach_properties WHERE property_address ILIKE '%Sartors%'");
    console.log('Outreach:', JSON.stringify(ops.rows, null, 2));
  } catch (e) { console.error(e.message); }
  await pool.end();
})();
