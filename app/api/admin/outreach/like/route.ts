import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const { searchParams } = new URL(request.url);
    const propertyIds = searchParams.get('property_ids')?.split(',').filter(Boolean);

    if (!propertyIds || propertyIds.length === 0) {
      return NextResponse.json({ liked_ids: [] });
    }

    const result = await marieDB.query(
      `SELECT property_id FROM outreach_properties WHERE REPLACE(property_id::text, '-', '') = ANY($1::text[]) AND status = 'liked'`,
      [propertyIds]
    );
    const likedIds = result.rows.map(r => r.property_id.replace(/-/g, ''));

    return NextResponse.json({ liked_ids: likedIds });
  } catch (error) {
    console.error('Error fetching liked properties:', error);
    return NextResponse.json({ error: 'Failed to fetch liked properties' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const body = await request.json() as {
      property_id: string;
      property_address: string;
      suburb: string;
      city: string;
      region: string;
      street?: string;
    };

    const { property_id, property_address, suburb, city, region, street } = body;

    if (!property_id || !property_address || !suburb || !city || !region) {
      return NextResponse.json(
        { error: 'property_id, property_address, suburb, city, and region are required' },
        { status: 400 }
      );
    }

    const existing = await marieDB.query(
      `SELECT id, status FROM outreach_properties WHERE property_id = $1 LIMIT 1`,
      [property_id]
    );

    if (existing.rows.length > 0) {
      const current = existing.rows[0];
      if (current.status === 'liked') {
        await marieDB.query(`DELETE FROM outreach_properties WHERE id = $1`, [current.id]);
        return NextResponse.json({ liked: false });
      }
      return NextResponse.json({ liked: false, message: 'Property already exists in outreach with different status' });
    }

    await marieDB.query(
      `INSERT INTO outreach_properties (property_id, property_address, suburb, city, region, street, campaign, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'favorites', 'liked')`,
      [property_id, property_address.trim(), suburb.trim(), city.trim(), region.trim(), street?.trim() || null]
    );

    return NextResponse.json({ liked: true });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}
