import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB, louisDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { generateTrackingCode } from '@/lib/tracking';

export async function POST(request: Request) {
  const session = await auth();
  
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { property_ids, campaign_id } = await request.json();

    if (!property_ids || property_ids.length === 0) {
      return NextResponse.json(
        { error: 'No properties selected' },
        { status: 400 }
      );
    }

    // Fetch property details from Louis DB
    const propertiesResult = await louisDB.query(
      `SELECT id, address, suburb, street 
       FROM properties 
       WHERE id = ANY($1)`,
      [property_ids]
    );

    const properties = propertiesResult.rows;

    if (properties.length === 0) {
      return NextResponse.json(
        { error: 'No valid properties found' },
        { status: 404 }
      );
    }

    // Prepare batch insert values
    const values: unknown[] = [];
    const placeholders: string[] = [];
    
    properties.forEach((prop, index) => {
      const baseIndex = index * 8;
      placeholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`
      );
      
      values.push(
        campaign_id || null,
        prop.id,
        prop.address,
        prop.street,
        prop.suburb,
        generateTrackingCode(),
        'PENDING',
        session.user.email
      );
    });

    // Batch insert into outreach_tasks
    const insertQuery = `
      INSERT INTO outreach_tasks 
      (campaign_id, property_id, property_address, street, suburb, tracking_code, status, added_by)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (property_address, suburb) 
      WHERE status != 'RETURNED'
      DO NOTHING
      RETURNING *
    `;

    const result = await marieDB.query(insertQuery, values);

    return NextResponse.json({
      success: true,
      added: result.rows.length,
      skipped: properties.length - result.rows.length,
      message: `Added ${result.rows.length} properties to outreach queue`,
      tasks: result.rows,
    });
  } catch (error) {
    console.error('Error adding properties to outreach:', error);
    return NextResponse.json(
      { error: 'Failed to add properties to outreach' },
      { status: 500 }
    );
  }
}
