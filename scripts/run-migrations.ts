/**
 * Database Migration Runner
 * 
 * Executes all SQL migration files in order against Marie DB
 * 
 * Usage:
 *   npx tsx scripts/run-migrations.ts
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

// Load environment variables
function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const marieDB = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  try {
    // Use safe migration file
    const migrationPath = join(process.cwd(), 'database', 'migrate-admin-system.sql');
    console.log(`📂 Migration file: ${migrationPath}\n`);

    if (!existsSync(migrationPath)) {
      console.error('❌ migrate-admin-system.sql file not found!');
      process.exit(1);
    }

    // Test database connection
    console.log('🔌 Testing database connection...');
    await marieDB.query('SELECT NOW()');
    console.log('✅ Database connection successful!\n');

    // Run migration
    console.log('⚙️  Executing admin system migration...\n');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    try {
      const result = await marieDB.query(sql);
      console.log('✅ Migration executed successfully\n');
    } catch (error: any) {
      // Show detailed error
      console.error('❌ Migration failed:', error.message);
      console.error('Details:', error.detail || '');
      console.error('Hint:', error.hint || '');
      throw error;
    }

    // Verify migrations
    console.log('🔍 Verifying migrations...\n');

    const tablesResult = await marieDB.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'admin_users',
        'appraisal_leads',
        'report_downloads',
        'direct_mail_campaigns',
        'direct_mail_addresses',
        'outreach_tasks',
        'suburb_reports'
      )
      ORDER BY table_name
    `);

    console.log('📊 Tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    console.log('');

    const triggersResult = await marieDB.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY trigger_name
    `);

    console.log('⚡ Triggers created:');
    triggersResult.rows.forEach(row => {
      console.log(`   ✓ ${row.trigger_name} (on ${row.event_object_table})`);
    });
    console.log('');

    const usersResult = await marieDB.query(`
      SELECT email, role, name FROM admin_users ORDER BY role DESC
    `);

    console.log('👥 Admin users:');
    usersResult.rows.forEach(row => {
      console.log(`   ✓ ${row.name} (${row.email}) - ${row.role}`);
    });
    console.log('');

    console.log('🎉 All migrations completed successfully!\n');

  } catch (error: any) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    await marieDB.end();
  }
}

// Run migrations
runMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
