import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

/**
 * POST /api/admin/outreach/check-duplicate
 * Check if an address already exists in the outreach system
 * Returns detailed information if duplicate found
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await (marieDB as any).ensureOutreachTablesExist?.();
    const body = await request.json();
    const { address, campaign, louis_property_id } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    // Prefer matching by louis_property_id when available (more reliable)
    let result;
    if (louis_property_id) {
      result = await marieDB.query(
        `SELECT id, property_address, suburb, city, region, campaign, status, sent_at, interacted_at, converted_at, created_at
         FROM outreach_properties WHERE louis_property_id = $1 LIMIT 1`,
        [louis_property_id.trim()]
      );
    } else {
      // Check for existing address in the specified campaign (or all campaigns if not specified)
      let query = `
        SELECT 
          id,
          property_address,
          suburb,
          city,
          region,
          campaign,
          status,
          sent_at,
          interacted_at,
          converted_at,
          created_at
        FROM outreach_properties
        WHERE property_address ILIKE $1
      `;
      const params: unknown[] = [address.trim()];

      if (campaign) {
        query += ` AND campaign = $2`;
        params.push(campaign);
      }

      query += ` ORDER BY created_at DESC LIMIT 1`;

      result = await marieDB.query(query, params);
    }

    if (result.rows.length > 0) {
      const existing = result.rows[0];
      return NextResponse.json({
        exists: true,
        duplicate: {
          id: existing.id,
          address: existing.property_address,
          suburb: existing.suburb,
          city: existing.city,
          region: existing.region,
          campaign: existing.campaign,
          status: existing.status,
          sent_at: existing.sent_at,
          interacted_at: existing.interacted_at,
          converted_at: existing.converted_at,
          created_at: existing.created_at,
        },
      });
    }

    return NextResponse.json({
      exists: false,
      message: 'Address is available',
    });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return NextResponse.json(
      { error: 'Failed to check duplicate' },
      { status: 500 }
    );
  }
}
