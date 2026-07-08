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
  const suburbsParam = searchParams.get('suburbs');
  const suburb = searchParams.get('suburb');
  const lastSoldYears = searchParams.get('last_sold_years');
  const minBedrooms = searchParams.get('min_bedrooms');
  const maxBedrooms = searchParams.get('max_bedrooms');
  const minBathrooms = searchParams.get('min_bathrooms');
  const maxBathrooms = searchParams.get('max_bathrooms');
  const minCarSpaces = searchParams.get('min_car_spaces');
  const maxCarSpaces = searchParams.get('max_car_spaces');
  const city = searchParams.get('city');
  const region = searchParams.get('region');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '9');
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      p.id,
      RTRIM(REGEXP_REPLACE(p.address, '\\d{7,}$', '')) as address,
      p.suburb,
      p.city,
      p.region,
      p.bedrooms,
      p.bathrooms,
      p.car_spaces as garages,
      p.capital_value as rv,
      p.last_sold_price,
      p.last_sold_date,
      p.year_built as build_year,
      COALESCE(NULLIF(p.land_area_numeric::text, ''), NULLIF(p.land_area, '-')) as land_area,
      NULLIF(p.floor_size, '-') as floor_area,
      COALESCE(
        NULLIF(p.cover_image_url, ''),
        'https://via.placeholder.com/400x300/e2e8f0/64748b?text=No+Image'
      ) as image_url,
      p.property_url,
      COALESCE(re.original_link, rer.original_link, re.property_url, rer.property_url) as realestate_url
    FROM properties p
    LEFT JOIN real_estate re ON p.address_fingerprint = re.address_fingerprint
    LEFT JOIN real_estate_rent rer ON p.address_fingerprint = rer.address_fingerprint
    WHERE 1=1
  `;

  const params: unknown[] = [];
  let paramIndex = 1;

  if (!search) {
    if (suburbsParam) {
      const suburbs = suburbsParam.split(',').map(s => s.trim()).filter(Boolean);
      if (suburbs.length > 0) {
        const suburbPlaceholders = suburbs.map((_, i) => `$${paramIndex + i}`).join(', ');
        query += ` AND LOWER(p.suburb) IN (${suburbPlaceholders})`;
        suburbs.forEach(suburb => params.push(suburb.toLowerCase()));
        paramIndex += suburbs.length;
      }
    }

    if (suburb) {
      query += ` AND LOWER(p.suburb) = LOWER($${paramIndex})`;
      params.push(suburb);
      paramIndex++;
    }

    const CITY_TO_DB: Record<string, string> = {
      'Auckland': 'Auckland - City',
      'Auckland City': 'Auckland - City',
    };

    if (city) {
      const dbCity = CITY_TO_DB[city] || city;
      query += ` AND p.city = $${paramIndex}`;
      params.push(dbCity);
      paramIndex++;
    }

    if (region) {
      query += ` AND LOWER(p.region) LIKE LOWER($${paramIndex})`;
      params.push(`%${region}%`);
      paramIndex++;
    }
  }

  if (search) {
    const cleanSearch = search.split(',')[0].trim();
    query += ` AND (p.address ILIKE $${paramIndex} OR p.suburb ILIKE $${paramIndex})`;
    params.push(`%${cleanSearch}%`);
    paramIndex++;
  }

  if (lastSoldYears) {
    const years = parseInt(lastSoldYears);
    query += ` AND p.last_sold_date >= NOW() - INTERVAL '${years} years'`;
  }

  if (minBedrooms) {
    query += ` AND p.bedrooms >= $${paramIndex}`;
    params.push(parseInt(minBedrooms));
    paramIndex++;
  }

  if (maxBedrooms) {
    query += ` AND p.bedrooms <= $${paramIndex}`;
    params.push(parseInt(maxBedrooms));
    paramIndex++;
  }

  if (minBathrooms) {
    query += ` AND p.bathrooms >= $${paramIndex}`;
    params.push(parseInt(minBathrooms));
    paramIndex++;
  }

  if (maxBathrooms) {
    query += ` AND p.bathrooms <= $${paramIndex}`;
    params.push(parseInt(maxBathrooms));
    paramIndex++;
  }

  if (minCarSpaces) {
    query += ` AND p.car_spaces >= $${paramIndex}`;
    params.push(parseInt(minCarSpaces));
    paramIndex++;
  }

  if (maxCarSpaces) {
    query += ` AND p.car_spaces <= $${paramIndex}`;
    params.push(parseInt(maxCarSpaces));
    paramIndex++;
  }

  // Get total count
  const countQuery = query.replace(/SELECT[\s\S]*FROM/, 'SELECT COUNT(*) as total FROM');
  const countResult = await marieQuery<{ total: string }>(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || '0');

  // Add smart sorting: by suburb, then by street name, then by house number (numeric)
  // For addresses like "1/2 Barker Rise", we extract the first number (1) for sorting
  query += ` 
    ORDER BY 
      p.suburb ASC,
      REGEXP_REPLACE(p.address, '^[0-9/A-Za-z]+\\s+', '') ASC,  -- Street name
      CASE 
        WHEN p.address ~ '^[0-9]+/' THEN CAST(REGEXP_REPLACE(p.address, '^([0-9]+)/.*', '\\1') AS INTEGER)
        WHEN p.address ~ '^[0-9]+[A-Za-z]?' THEN CAST(REGEXP_REPLACE(p.address, '^([0-9]+).*', '\\1') AS INTEGER)
        ELSE 999999
      END ASC,  -- Primary house number
      p.address ASC  -- Fallback for exact ordering
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);

  try {
    const result = await marieQuery<{
      id: string;
      address: string;
      suburb: string;
      city: string;
      region: string;
      bedrooms: string | null;
      bathrooms: string | null;
      garages: string | null;
      rv: string | null;
      last_sold_price: string | null;
      last_sold_date: string | null;
      build_year: string | null;
      land_area: string | null;
      floor_area: string | null;
      image_url: string;
      property_url: string;
      realestate_url: string | null;
    }>(query, params);

    const properties = result.rows.map(row => ({
      id: row.id,
      address: row.address,
      suburb: row.suburb,
      city: row.city,
      region: row.region,
      bedrooms: row.bedrooms !== null && row.bedrooms !== undefined ? Number(row.bedrooms) : null,
      bathrooms: row.bathrooms !== null && row.bathrooms !== undefined ? Number(row.bathrooms) : null,
      garages: row.garages !== null && row.garages !== undefined ? Number(row.garages) : null,
      rv: row.rv !== null && row.rv !== undefined ? Number(row.rv) : null,
      last_sold_price: row.last_sold_price !== null && row.last_sold_price !== undefined ? Number(row.last_sold_price) : null,
      last_sold_date: row.last_sold_date ?? "",
      build_year: row.build_year ? Number(row.build_year) : null,
      land_area: row.land_area !== null && row.land_area !== undefined && row.land_area !== '-' ? row.land_area : null,
      floor_area: row.floor_area ?? null,
      image_url: row.image_url,
      property_url: row.property_url,
      realestate_url: row.realestate_url,
    }));

    return NextResponse.json({
      success: true,
      properties,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching properties:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}
