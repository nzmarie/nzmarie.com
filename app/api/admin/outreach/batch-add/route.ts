import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

interface PropertyInput {
  louis_property_id: string;
  property_address: string;
  suburb: string;
  street?: string;
  city?: string;
  bedrooms?: number;
  bathrooms?: number;
  rv_value?: number;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { properties } = await request.json() as { properties: PropertyInput[] };

    if (!properties || properties.length === 0) {
      return NextResponse.json({ error: 'No properties provided' }, { status: 400 });
    }

    const insertPromises = properties.map((property: PropertyInput) => {
      const trackingCode = `DM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return marieDB.query(
        `INSERT INTO outreach_selected_properties
         (louis_property_id, property_address, suburb, street, city,
          bedrooms, bathrooms, rv_value, selected_by, tracking_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (louis_property_id, selected_by) DO NOTHING
         RETURNING id`,
        [
          property.louis_property_id,
          property.property_address,
          property.suburb,
          property.street ?? null,
          property.city ?? null,
          property.bedrooms ?? null,
          property.bathrooms ?? null,
          property.rv_value ?? null,
          session.user.email,
          trackingCode,
        ]
      );
    });

    const results = await Promise.all(insertPromises);
    const successCount = results.filter(r => r.rows.length > 0).length;

    return NextResponse.json({
      success: true,
      added: successCount,
      skipped: properties.length - successCount,
      message: `Added ${successCount} properties to outreach queue${
        successCount < properties.length
          ? ` (${properties.length - successCount} already existed)`
          : ''
      }`,
    });
  } catch (error) {
    console.error('Error adding properties to outreach:', error);
    return NextResponse.json({ error: 'Failed to add properties to outreach' }, { status: 500 });
  }
}
