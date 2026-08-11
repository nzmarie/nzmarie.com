import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/admin/outreach/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn(),
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

describe('Outreach MV GET /api/admin/outreach', () => {
  const OLD_ENV = process.env.USE_OUTREACH_MV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  afterAll(() => {
    process.env.USE_OUTREACH_MV = OLD_ENV;
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach'));
    expect(response.status).toBe(401);
  });

  it('returns property list with pagination via MV', async () => {
    mockAuth();

    const mockRows = [
      { id: '1', property_address: '1 Test St', suburb: 'Oteha', city: 'Auckland', region: 'Auckland', total_count: '2' },
      { id: '2', property_address: '2 Test St', suburb: 'Oteha', city: 'Auckland', region: 'Auckland', total_count: '2' },
    ];

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: mockRows } as any)
      .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?limit=10&page=1'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
  });

  it('returns card view fields when view=card', async () => {
    mockAuth();

    const mockRows = [
      { id: '1', property_address: '1 Test St', suburb: 'Oteha', total_count: '1' },
    ];

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: mockRows } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?view=card&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('cover_image_url, bedrooms, bathrooms, car_spaces');
  });

  it('filters by sentStatus and suburb with reportQuarter', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?sent_status=sent&suburb=Oteha&report_quarter=2026-Q2&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(queryCall).toContain('outreach_send_logs');
    expect(params).toContain('Oteha');
    expect(params).toContain('Q2');
  });

  it('filters by sentStatus=unsent without suburb', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?sent_status=unsent&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3');
    expect(queryCall).toContain('(no_junk_mail IS NULL OR no_junk_mail = false)');
  });

  it('filters by market_status', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?market_status=for_sale&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('on_market_sale = true');
  });

  it('filters by no_junk_mail', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?no_junk_mail=true&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('no_junk_mail = true');
  });

  it('filters sent properties by sent_dates', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=sent&sent_dates=2026-07-01,2026-07-02&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(queryCall).toContain("(sl6.sent_at AT TIME ZONE 'Pacific/Auckland')::date IN");
    expect(params).toContain('2026-07-01');
    expect(params).toContain('2026-07-02');
  });

  it('filters sent properties by sent_dates in legacy mode', async () => {
    mockAuth();
    process.env.USE_OUTREACH_MV = 'false';

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=sent&sent_dates=2026-07-03&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(queryCall).toContain('outreach_send_logs sl6 WHERE sl6.outreach_property_id = op.id');
    expect(queryCall).toContain("(sl6.sent_at AT TIME ZONE 'Pacific/Auckland')::date IN");
    expect(params).toContain('2026-07-03');
  });
});

describe('Outreach MV POST /api/admin/outreach (add property)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach', {
      method: 'POST',
      body: JSON.stringify({ property_address: '1 Test St', suburb: 'Oteha', city: 'Auckland', region: 'Auckland' }),
    }));
    expect(response.status).toBe(401);
  });

  it('triggers MV REFRESH after insert', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'new-id', status: 'pending' }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_address: '1 Test St',
        suburb: 'Oteha',
        city: 'Auckland',
        region: 'Auckland',
      }),
    }));

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('does not trigger MV REFRESH when MV is disabled', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'new-id', status: 'pending' }] } as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_address: '2 Test Ave',
        suburb: 'Oteha',
        city: 'Auckland',
        region: 'Auckland',
      }),
    }));

    expect(response.status).toBe(200);
    const refreshCalls = vi.mocked(marieDB.query).mock.calls.filter(
      c => c[0] === 'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(refreshCalls).toHaveLength(0);
  });
});
