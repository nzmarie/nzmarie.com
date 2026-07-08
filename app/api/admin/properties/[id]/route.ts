import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const allowedColumns = [
    'address', 'suburb', 'city', 'region', 'postcode',
    'bedrooms', 'bathrooms', 'car_spaces',
    'year_built', 'floor_size', 'land_area', 'land_area_numeric',
    'last_sold_price', 'last_sold_date',
    'capital_value', 'land_value', 'improvement_value',
    'property_url', 'cover_image_url',
    'description', 'property_type',
    'status', 'sale_status',
    'has_rental_history', 'is_currently_rented',
    'estimated_value_low', 'estimated_value_high',
    'property_history',
    'suburb_median_price', 'suburb_median_rent', 'suburb_days_on_market',
  ];

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const col of allowedColumns) {
    if (body[col] !== undefined) {
      updates.push(`${col} = $${idx}`);
      values.push(body[col] === '' ? null : body[col]);
      idx++;
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
  }

  values.push(id);
  const sql = `UPDATE properties SET ${updates.join(', ')} WHERE id = $${idx}`;

  try {
    await marieQuery(sql, values);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error updating property:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update property' },
      { status: 500 }
    );
  }
}
