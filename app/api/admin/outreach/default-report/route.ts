import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

const KEY = 'default_outreach_report';

function parseStored(value: string | null): { suburb: string; label: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      typeof parsed?.suburb === 'string' &&
      parsed.suburb &&
      typeof parsed?.label === 'string' &&
      parsed.label
    ) {
      return { suburb: parsed.suburb, label: parsed.label };
    }
  } catch {
    // fall through
  }
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const result = await marieDB.query(
      `SELECT setting_value FROM admin_settings WHERE setting_key = $1 LIMIT 1`,
      [KEY]
    );
    const value = result?.rows?.[0]?.setting_value ?? null;
    return NextResponse.json({ success: true, defaultReport: parseStored(value) });
  } catch (error) {
    console.error('Error reading default report:', error);
    return NextResponse.json({ success: true, defaultReport: null });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let suburb = '';
  let label = '';
  try {
    const body = await request.json();
    suburb = typeof body?.suburb === 'string' ? body.suburb.trim() : '';
    label = typeof body?.label === 'string' ? body.label.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!suburb || !label) {
    return NextResponse.json({ error: 'suburb and label are required' }, { status: 400 });
  }

  const value = JSON.stringify({ suburb, label });

  try {
    await marieDB.ensureOutreachTablesExist?.();
    await marieDB.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_at = NOW(), updated_by = $3`,
      [KEY, value, session.user.email]
    );
    return NextResponse.json({ success: true, defaultReport: { suburb, label } });
  } catch (error) {
    console.error('Error saving default report:', error);
    return NextResponse.json({ error: 'Failed to save default report' }, { status: 500 });
  }
}
