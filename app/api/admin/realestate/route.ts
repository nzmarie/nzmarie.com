import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const minBedrooms = searchParams.get('min_bedrooms');
  const maxBedrooms = searchParams.get('max_bedrooms');
  const minBathrooms = searchParams.get('min_bathrooms');
  const maxBathrooms = searchParams.get('max_bathrooms');
  const propertyType = searchParams.get('property_type');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '18');
  const offset = (page - 1) * limit;

  let query = `
    SELECT
      r.id,
      r.address,
      r.status,
      r.data,
      r.listing_date,
      r.listing_date_raw,
      r.price_display,
      r.agent_name,
      r.bedroom_count,
      r.bathroom_count,
      r.land_area,
      r.floor_area,
      r.property_url,
      r.original_link,
      r.region,
      r.latitude,
      r.longitude,
      r.cover_image_url,
      r.images,
      r.normalized_lead_address,
      r.address_fingerprint,
      r.property_type,
      r.description,
      r.listing_number,
      r.listing_date_parsed
    FROM real_estate r
    WHERE 1=1
  `;

  const params: unknown[] = [];
  let paramIndex = 1;

  if (search) {
    query += ` AND r.address ILIKE $${paramIndex}`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (region) {
    query += ` AND LOWER(r.region) LIKE LOWER($${paramIndex})`;
    params.push(`%${region}%`);
    paramIndex++;
  }

  if (city) {
    query += ` AND r.address ILIKE $${paramIndex}`;
    params.push(`%${city}%`);
    paramIndex++;
  }

  if (suburb) {
    query += ` AND r.address ILIKE $${paramIndex}`;
    params.push(`%${suburb}%`);
    paramIndex++;
  }

  if (minBedrooms) {
    const val = parseInt(minBedrooms);
    if (!isNaN(val)) {
      query += ` AND r.bedroom_count >= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (maxBedrooms) {
    const val = parseInt(maxBedrooms);
    if (!isNaN(val)) {
      query += ` AND r.bedroom_count <= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (minBathrooms) {
    const val = parseInt(minBathrooms);
    if (!isNaN(val)) {
      query += ` AND r.bathroom_count >= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (maxBathrooms) {
    const val = parseInt(maxBathrooms);
    if (!isNaN(val)) {
      query += ` AND r.bathroom_count <= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (propertyType) {
    query += ` AND LOWER(r.property_type) = LOWER($${paramIndex})`;
    params.push(propertyType);
    paramIndex++;
  }

  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
  const countResult = await marieQuery<{ total: string }>(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || '0');

  query += ` ORDER BY r.listing_date DESC NULLS LAST, r.address ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const result = await marieQuery<{
      id: string;
      address: string;
      status: string | null;
      data: string | null;
      listing_date: string | null;
      listing_date_raw: string | null;
      price_display: string | null;
      agent_name: string | null;
      bedroom_count: string | null;
      bathroom_count: string | null;
      land_area: string | null;
      floor_area: string | null;
      property_url: string | null;
      original_link: string | null;
      region: string | null;
      latitude: string | null;
      longitude: string | null;
      cover_image_url: string | null;
      images: string | null;
      normalized_lead_address: string | null;
      address_fingerprint: string | null;
      property_type: string | null;
      description: string | null;
      listing_number: string | null;
      listing_date_parsed: string | null;
    }>(query, params);

    const listings = result.rows.map(row => ({
      id: row.id,
      address: row.address,
      status: row.status ?? null,
      data: row.data ?? null,
      listing_date: row.listing_date ?? null,
      listing_date_raw: row.listing_date_raw ?? null,
      price_display: row.price_display ?? null,
      agent_name: row.agent_name ?? null,
      bedroom_count: row.bedroom_count !== null ? Number(row.bedroom_count) : null,
      bathroom_count: row.bathroom_count !== null ? Number(row.bathroom_count) : null,
      land_area: row.land_area !== null ? Number(row.land_area) : null,
      floor_area: row.floor_area !== null ? Number(row.floor_area) : null,
      property_url: row.property_url ?? null,
      original_link: row.original_link ?? null,
      region: row.region ?? null,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      cover_image_url: row.cover_image_url ?? null,
      images: row.images ?? null,
      normalized_lead_address: row.normalized_lead_address ?? null,
      address_fingerprint: row.address_fingerprint ?? null,
      property_type: row.property_type ?? null,
      description: row.description ?? null,
      listing_number: row.listing_number ?? null,
      listing_date_parsed: row.listing_date_parsed ?? null,
    }));

    return NextResponse.json({
      success: true,
      listings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching realestate listings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}
