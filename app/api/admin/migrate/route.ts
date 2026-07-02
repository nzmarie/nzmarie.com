import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';

/**
 * POST /api/admin/migrate
 * Run pending database migrations.
 * Super admin only.
 */
export async function POST() {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const results: { migration: string; status: string; message: string }[] = [];

  try {
    // --- Migration 011: Add region and city to appraisal_leads ---
    try {
      await marieDB.query(`
        ALTER TABLE appraisal_leads 
        ADD COLUMN IF NOT EXISTS region VARCHAR(100)
      `);
      await marieDB.query(`
        ALTER TABLE appraisal_leads 
        ADD COLUMN IF NOT EXISTS city VARCHAR(100)
      `);
      await marieDB.query(`
        CREATE INDEX IF NOT EXISTS idx_appraisal_leads_region ON appraisal_leads(region)
      `);
      await marieDB.query(`
        CREATE INDEX IF NOT EXISTS idx_appraisal_leads_city ON appraisal_leads(city)
      `);
      results.push({
        migration: '011_add_region_city_to_appraisal_leads',
        status: 'success',
        message: 'Added region and city columns to appraisal_leads',
      });
    } catch (err) {
      results.push({
        migration: '011_add_region_city_to_appraisal_leads',
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Migration failed', detail: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate
 * Check migration status — which columns exist on appraisal_leads.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await marieDB.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'appraisal_leads'
      ORDER BY ordinal_position
    `);

    const columns = result.rows.map(r => r.column_name);
    const hasRegion = columns.includes('region');
    const hasCity = columns.includes('city');

    return NextResponse.json({
      columns,
      migrations: {
        '011_add_region_city': hasRegion && hasCity ? 'applied' : 'pending',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
