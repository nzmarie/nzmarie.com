import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/reports/templates/generate/route';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { getMonthlyData } from '@/lib/market-data-aggregator';
import { aggregateToQuarterly } from '@/lib/quarterly-aggregator';
import { generateChartImageUrl } from '@/lib/report-charts';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/market-data-aggregator', () => ({
  getMonthlyData: vi.fn(),
}));

vi.mock('@/lib/quarterly-aggregator', () => ({
  aggregateToQuarterly: vi.fn(),
}));

vi.mock('@/lib/report-charts', () => ({
  generateChartImageUrl: vi.fn(),
}));

function mockDbForSuburb(suburbName: string, suburbId: string) {
  vi.mocked(marieQuery).mockImplementation(async (sql: string) => {
    if (sql.includes('INSERT INTO report_documents')) {
      return { rows: [{ id: 'report-1' }] } as any;
    }
    if (sql.includes('report_suburbs')) {
      return { rows: [{ id: suburbId, name: suburbName }] } as any;
    }
    if (sql.includes('admin_users')) {
      return { rows: [{ id: 'admin-1' }] } as any;
    }
    if (sql.includes('market_monthly_snapshots')) {
      return { rows: [] } as any;
    }
    if (sql.includes('real_estate')) {
      return {
        rows: [{ total: 0, no_data: 0, bucket_0_3: 0, bucket_3_5: 0, bucket_5_10: 0, bucket_10_15: 0, bucket_15_plus: 0 }],
      } as any;
    }
    if (sql.includes('direct_mail')) {
      return { rows: [{ mailed: 0, downloads: 0, appraisals: 0, conversions: 0 }] } as any;
    }
    if (sql.includes('report_documents')) {
      return { rows: [] } as any;
    }
    return { rows: [] } as any;
  });
}

describe('report generate API North Shore naming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(getMonthlyData).mockResolvedValue([]);
    vi.mocked(aggregateToQuarterly).mockReturnValue([]);
    vi.mocked(generateChartImageUrl).mockResolvedValue('https://r2.example.com/chart.svg');
  });

  it('titles the North Shore district report with North Shore while querying data as North Shore City', async () => {
    mockDbForSuburb('North Shore', 'ns-1');

    const response = await POST(
      new Request('http://localhost:3000/api/admin/reports/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb_id: 'ns-1', quarter: '2026-Q2' }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    const insertCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('INSERT INTO report_documents'));
    expect(insertCall).toBeTruthy();
    const params = insertCall![1] as unknown[];

    expect(params[3]).toContain('North Shore 2026 Q2 Market Report');

    const content = params[4] as string;
    expect(content).toContain('North Shore');
    expect(content).not.toContain('North Shore City');

    expect(getMonthlyData).toHaveBeenCalledWith(
      ['North Shore City'],
      'North Shore City',
      expect.any(String),
      expect.any(String)
    );

    expect(generateChartImageUrl).toHaveBeenCalledWith('North Shore City', '2026-Q2', '2026-Q2', '2026-Q2');

    const trendCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('market_monthly_snapshots'));
    expect(trendCall).toBeTruthy();
    const trendParams = trendCall![1] as unknown[];
    expect(trendParams[0]).toBe('North Shore City');
  });

  it('uses North Shore as the district label for a regular suburb report', async () => {
    mockDbForSuburb('Torbay', 'tor-1');

    const response = await POST(
      new Request('http://localhost:3000/api/admin/reports/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb_id: 'tor-1', quarter: '2026-Q2' }),
      })
    );

    expect(response.status).toBe(200);

    const insertCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('INSERT INTO report_documents'));
    const params = insertCall![1] as unknown[];

    expect(params[3]).toContain('Torbay 2026 Q2 Market Report');

    const content = params[4] as string;
    expect(content).toContain('Torbay');
    expect(content).toContain('North Shore');
    expect(content).not.toContain('North Shore City');

    expect(getMonthlyData).toHaveBeenCalledWith(
      ['Torbay'],
      'North Shore City',
      expect.any(String),
      expect.any(String)
    );

    expect(generateChartImageUrl).toHaveBeenCalledWith('Torbay', '2026-Q2', '2026-Q2', '2026-Q2');
  });
});