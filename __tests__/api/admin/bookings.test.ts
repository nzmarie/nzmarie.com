import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    query: mockQuery,
  })),
}));

vi.mock('../../../lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'admin@example.com' } }),
}));

vi.mock('../../../lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

import { GET } from '../../../app/api/admin/bookings/route';

describe('GET /api/admin/bookings', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('information_schema.columns')) {
        return Promise.resolve({ rows: [{ column_name: 'region' }, { column_name: 'city' }] });
      }

      if (sql.includes('SELECT * FROM appraisal_leads')) {
        return Promise.resolve({
          rows: [{
            id: '1',
            client_name: 'Test User',
            email: 'test@example.com',
            phone: '0210000000',
            property_address: '5 Cottam Grove',
            region: null,
            city: null,
            suburb: 'Northcross',
            contact_status: 'new',
            priority: 'high',
            created_at: '2026-07-02T00:00:00.000Z',
          }],
        });
      }

      if (sql.includes('SELECT COUNT(*) FROM appraisal_leads')) {
        return Promise.resolve({ rows: [{ count: '1' }] });
      }

      if (sql.includes('GROUP BY region, city, suburb')) {
        return Promise.resolve({
          rows: [{ region: 'Unknown', city: 'Unknown', suburb: 'Northcross', count: '1' }],
        });
      }

      return Promise.resolve({ rows: [] });
    });
  });

  it('derives region and city from suburb for location stats when the database fields are empty', async () => {
    const req = new Request('http://localhost/api/admin/bookings');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data[0].region).toBe('Auckland');
    expect(json.data[0].city).toBe('North Shore City');
    expect(json.locationStats).toEqual([
      { region: 'Auckland', city: 'North Shore City', suburb: 'Northcross', count: 1 },
    ]);
  });
});
