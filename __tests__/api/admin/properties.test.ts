import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  query: mockQuery,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'admin@example.com' } }),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

import { GET } from '../../../app/api/admin/properties/route';

function makeDefaultRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-1',
    address: '15 Marine Parade',
    suburb: 'Takapuna',
    city: 'North Shore City',
    region: 'Auckland',
    bedrooms: '4',
    bathrooms: '2',
    garages: '2',
    rv: '1200000',
    last_sold_price: '1150000',
    last_sold_date: '2023-01-15',
    build_year: '1990',
    land_area: '801',
    floor_area: '220',
    image_url: 'https://example.com/img.jpg',
    property_url: 'https://example.com/p1',
    description: 'Nice home',
    realestate_url: null,
    postcode: '0632',
    land_value: '1075000',
    improvement_value: '200000',
    has_rental_history: null,
    is_currently_rented: null,
    status: null,
    property_history: null,
    normalized_address: null,
    address_fingerprint: null,
    land_area_numeric: null,
    property_type: 'Residential',
    sale_status: null,
    sale_status_source: null,
    sale_status_updated_at: null,
    estimated_value_low: null,
    estimated_value_high: null,
    suburb_median_price: null,
    suburb_median_rent: null,
    suburb_days_on_market: null,
    images: null,
    latitude: '-36.7061',
    longitude: '174.7297',
    created_at: null,
    on_market_sale: false,
    sale_listing_status: null,
    sale_price: null,
    sale_agent: null,
    on_market_rent: false,
    rent_listing_status: null,
    rent_price: null,
    ...overrides,
  };
}

describe('GET /api/admin/properties — market status JOIN', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns on_market_sale=true when real_estate JOIN matches', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        makeDefaultRow({
          on_market_sale: true,
          sale_listing_status: 'Under Offer',
          sale_price: '$1,150,000',
          sale_agent: 'Mike Pero',
        }),
      ],
      rowCount: 1,
    });

    const req = new Request('http://localhost/api/admin/properties');
    const res = await GET(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.properties[0].on_market_sale).toBe(true);
    expect(json.properties[0].sale_listing_status).toBe('Under Offer');
    expect(json.properties[0].sale_price).toBe('$1,150,000');
    expect(json.properties[0].sale_agent).toBe('Mike Pero');
  });

  it('returns on_market_rent=true when real_estate_rent JOIN matches', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        makeDefaultRow({
          on_market_rent: true,
          rent_listing_status: 'To Rent',
          rent_price: '$650/week',
        }),
      ],
      rowCount: 1,
    });

    const req = new Request('http://localhost/api/admin/properties');
    const res = await GET(req);
    const json = await res.json();

    expect(json.properties[0].on_market_rent).toBe(true);
    expect(json.properties[0].rent_listing_status).toBe('To Rent');
    expect(json.properties[0].rent_price).toBe('$650/week');
  });

  it('filters for_sale via SQL AND re.id IS NOT NULL', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [makeDefaultRow({ on_market_sale: true })] });

    const req = new Request('http://localhost/api/admin/properties?market_status=for_sale');
    const res = await GET(req);
    await res.json();

    const sqlCalls = mockQuery.mock.calls as Array<[string, unknown[]]>;
    const queries = sqlCalls.map(c => c[0]);
    const hasReIdFilter = queries.some(q => q.includes('AND re.id IS NOT NULL'));
    expect(hasReIdFilter).toBe(true);
  });

  it('filters for_rent via SQL AND rer.id IS NOT NULL', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [makeDefaultRow({ on_market_rent: true })] });

    const req = new Request('http://localhost/api/admin/properties?market_status=for_rent');
    const res = await GET(req);
    await res.json();

    const sqlCalls = mockQuery.mock.calls as Array<[string, unknown[]]>;
    const queries = sqlCalls.map(c => c[0]);
    const hasRerIdFilter = queries.some(q => q.includes('AND rer.id IS NOT NULL'));
    expect(hasRerIdFilter).toBe(true);
  });

  it('filters not_listed via SQL AND re.id IS NULL AND rer.id IS NULL', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [makeDefaultRow()] });

    const req = new Request('http://localhost/api/admin/properties?market_status=not_listed');
    const res = await GET(req);
    await res.json();

    const sqlCalls = mockQuery.mock.calls as Array<[string, unknown[]]>;
    const queries = sqlCalls.map(c => c[0]);
    const hasNotListedFilter = queries.some(q => q.includes('AND re.id IS NULL AND rer.id IS NULL'));
    expect(hasNotListedFilter).toBe(true);
  });

  it('filters rented via SQL AND p.has_rental_history = true', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [makeDefaultRow({ has_rental_history: 't' })] });

    const req = new Request('http://localhost/api/admin/properties?market_status=rented');
    const res = await GET(req);
    await res.json();

    const sqlCalls = mockQuery.mock.calls as Array<[string, unknown[]]>;
    const queries = sqlCalls.map(c => c[0]);
    const hasRentedFilter = queries.some(q => q.includes('AND p.has_rental_history = true'));
    expect(hasRentedFilter).toBe(true);
  });

  it('uses address+suburb JOIN instead of address_fingerprint', async () => {
    mockQuery.mockResolvedValue({
      rows: [makeDefaultRow()],
      rowCount: 1,
    });

    const req = new Request('http://localhost/api/admin/properties');
    await GET(req);

    const sqlCalls = mockQuery.mock.calls as Array<[string, unknown[]]>;
    const mainQuery = sqlCalls.find(c => c[0].includes('FROM properties'));
    expect(mainQuery).toBeDefined();
    const sql = mainQuery![0];
    expect(sql).toContain('SPLIT_PART(re.address');
    expect(sql).toContain('SPLIT_PART(rer.address');
    expect(sql).not.toContain('address_fingerprint = re.address_fingerprint');
  });

  it('sets on_market_sale=false when no real_estate match', async () => {
    mockQuery.mockResolvedValue({
      rows: [makeDefaultRow({ on_market_sale: false, on_market_rent: false })],
      rowCount: 1,
    });

    const req = new Request('http://localhost/api/admin/properties');
    const res = await GET(req);
    const json = await res.json();

    expect(json.properties[0].on_market_sale).toBe(false);
    expect(json.properties[0].on_market_rent).toBe(false);
    expect(json.properties[0].sale_listing_status).toBeNull();
    expect(json.properties[0].rent_listing_status).toBeNull();
  });
});
