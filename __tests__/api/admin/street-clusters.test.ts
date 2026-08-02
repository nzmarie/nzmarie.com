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

function addr(street: string, property_address: string, lat?: number, lng?: number) {
  return { street, property_address, house_number: null, lat: lat ?? null, lng: lng ?? null };
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

  it('orders streets by nearest distance and returns runs', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '3 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '5 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '7 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '9 Alpha Street', -36.6958, 174.7453),
          addr('Beta Street', '2 Beta Street', -36.6959, 174.7454),
          addr('Beta Street', '4 Beta Street', -36.6959, 174.7454),
          addr('Beta Street', '6 Beta Street', -36.6959, 174.7454),
          addr('NoCoord Street', '1 NoCoord Street'),
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&radius=500&budget=20')
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.suburb).toBe('Torbay');
    expect(body.radius).toBe(500);
    expect(body.budget).toBe(20);
    expect(body.manualOrder).toBe(false);

    // Alpha (house 1) is the start street, then the nearest street Beta,
    // then the no-coordinate street appended at the end.
    const runStreets = body.runs[0].groups.flatMap((g: any) => g.streets.map((s: any) => s.street));
    expect(runStreets).toEqual(['Alpha Street', 'Beta Street', 'NoCoord Street']);

    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].streets).toHaveLength(3);
    expect(body.groups[0].totalPending).toBe(9);

    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].totalPending).toBe(9);
    expect(body.runs[0].streetCount).toBe(3);
    expect(body.runs[0].runId).toBe(1);

    const alpha = body.runs[0].groups
      .flatMap((g: any) => g.streets)
      .find((s: any) => s.street === 'Alpha Street');
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

  it('applies a saved manual order when one exists', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
          addr('Beta Street', '2 Beta Street', -36.6959, 174.7454),
          addr('Gamma Street', '3 Gamma Street', -36.6957, 174.7452),
          addr('NoCoord Street', '1 NoCoord Street'),
          addr('NoCoord Street', '2 NoCoord Street'),
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ setting_value: JSON.stringify(['Gamma Street', 'Alpha Street']) }],
      } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&radius=500&budget=20')
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.manualOrder).toBe(true);
    expect(body.manualOrderCount).toBe(2);

    const runStreets = body.runs[0].groups.flatMap((g: any) => g.streets.map((s: any) => s.street));
    // Saved order first (Gamma, Alpha), then remaining streets alphabetically (Beta),
    // then the no-coordinate street appended at the end.
    expect(runStreets).toEqual(['Gamma Street', 'Alpha Street', 'Beta Street', 'NoCoord Street']);
  });

  it('returns manualOrder false when no saved order exists', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay')
    );
    const body = await response.json();
    expect(body.manualOrder).toBe(false);
  });

  it('starts the route from the requested start_street and reports it back', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '3 Alpha Street', -36.6958, 174.7453),
          addr('Beta Street', '2 Beta Street', -36.6959, 174.7454),
          addr('Beta Street', '4 Beta Street', -36.6959, 174.7454),
          addr('Gamma Street', '5 Gamma Street', -36.7, 174.74),
          addr('NoCoord Street', '1 NoCoord Street'),
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&start_street=Beta%20Street&budget=20')
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.startStreet).toBe('Beta Street');
    expect(body.allStreets).toEqual([
      { street: 'Alpha Street', count: 2 },
      { street: 'Beta Street', count: 2 },
      { street: 'Gamma Street', count: 1 },
      { street: 'NoCoord Street', count: 1 },
    ]);

    // Beta is first (requested start), Alpha is nearest, then Gamma, then no-coord.
    const runStreets = body.runs[0].groups.flatMap((g: any) => g.streets.map((s: any) => s.street));
    expect(runStreets).toEqual(['Beta Street', 'Alpha Street', 'Gamma Street', 'NoCoord Street']);
  });

  it('falls back to the default start when start_street is unknown', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
          addr('Beta Street', '2 Beta Street', -36.6959, 174.7454),
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&start_street=Missing%20Street')
    );
    const body = await response.json();
    // Default start is the smallest house number street.
    expect(body.startStreet).toBe('Alpha Street');
    const runStreets = body.runs[0].groups.flatMap((g: any) => g.streets.map((s: any) => s.street));
    expect(runStreets).toEqual(['Alpha Street', 'Beta Street']);
  });
});
