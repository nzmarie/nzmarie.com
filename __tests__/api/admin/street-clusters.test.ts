import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/outreach/street-clusters/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    ensureOutreachTablesExist: vi.fn(),
  },
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

function mockAuth() {
  vi.mocked(auth).mockResolvedValueOnce({
    user: { email: 'nzlouis.com@gmail.com' },
  } as any);
}

describe('GET /api/admin/outreach/street-clusters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay')
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when suburb is missing', async () => {
    mockAuth();
    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters')
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing suburb parameter');
  });

  it('returns clusters with runs and unclustered streets', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      // single addresses+coords JOIN query
      .mockResolvedValueOnce({
        rows: [
          { street: 'Alpha Street', property_address: '1 Alpha Street', lat: '-36.6958', lng: '174.7453' },
          { street: 'Alpha Street', property_address: '3 Alpha Street', lat: '-36.6958', lng: '174.7453' },
          { street: 'Alpha Street', property_address: '5 Alpha Street', lat: '-36.6958', lng: '174.7453' },
          { street: 'Alpha Street', property_address: '7 Alpha Street', lat: '-36.6958', lng: '174.7453' },
          { street: 'Alpha Street', property_address: '9 Alpha Street', lat: '-36.6958', lng: '174.7453' },
          { street: 'Beta Street', property_address: '2 Beta Street', lat: '-36.6959', lng: '174.7454' },
          { street: 'Beta Street', property_address: '4 Beta Street', lat: '-36.6959', lng: '174.7454' },
          { street: 'Beta Street', property_address: '6 Beta Street', lat: '-36.6959', lng: '174.7454' },
        ],
      } as any)
      // no-coords query
      .mockResolvedValueOnce({
        rows: [{ street: 'NoCoord Street' }],
      } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&radius=500&budget=20')
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.suburb).toBe('Torbay');
    expect(body.radius).toBe(500);
    expect(body.budget).toBe(20);

    // Both streets are close (<500m) so one group.
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].streets).toHaveLength(2);
    expect(body.groups[0].totalPending).toBe(8);

    // Runs derived from the group.
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].totalPending).toBe(8);
    expect(body.runs[0].streetCount).toBe(2);
    expect(body.runs[0].runId).toBe(1);

    // Addresses attached per street in run detail.
    const runStreets = body.runs[0].groups.flatMap((g: any) => g.streets);
    const alpha = runStreets.find((s: any) => s.street === 'Alpha Street');
    expect(alpha.addresses).toEqual([
      '1 Alpha Street', '3 Alpha Street', '5 Alpha Street', '7 Alpha Street', '9 Alpha Street',
    ]);

    expect(body.unclusteredStreets).toEqual([{ street: 'NoCoord Street', has_coords: false }]);
  });

  it('clamps radius and budget to allowed ranges', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockResolvedValue({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&radius=99999&budget=99999')
    );
    const body = await response.json();
    expect(body.radius).toBe(2000);
    expect(body.budget).toBe(100);
  });

  it('returns 500 when the DB query throws', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockRejectedValueOnce(new Error('boom'));

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay')
    );
    expect(response.status).toBe(500);
  });
});
