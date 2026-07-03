import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

/**
 * PATCH /api/admin/outreach/:id
 * Update a single outreach property
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const body = await request.json();
    const { id } = await params;

    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const allowedFields = [
      'status',
      'sent_at',
      'interacted_at',
      'converted_at',
      'owner_name',
      'property_type',
      'notes',
      'campaign',
    ];

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(body[field]);
      }
    });

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE outreach_properties
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await marieDB.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating outreach property:', error);
    return NextResponse.json(
      { error: 'Failed to update property' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/outreach/:id
 * Delete a single outreach property
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const result = await marieDB.query(
      `DELETE FROM outreach_properties WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting outreach property:', error);
    return NextResponse.json(
      { error: 'Failed to delete property' },
      { status: 500 }
    );
  }
}
