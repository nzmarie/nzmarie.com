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

  it('compares median price quarter-over-quarter (not YoY) in the Quarterly Data card', async () => {
    vi.mocked(marieQuery).mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO report_documents')) {
        return { rows: [{ id: 'report-1' }] } as any;
      }
      if (sql.includes('report_suburbs')) {
        return { rows: [{ id: 'tor-1', name: 'Torbay' }] } as any;
      }
      if (sql.includes('admin_users')) {
        return { rows: [{ id: 'admin-1' }] } as any;
      }
      if (sql.includes('market_monthly_snapshots')) {
        return {
          rows: [
            { region_name: 'Torbay', region_type: 'suburb', period_month: '2026-04-01', median_price: 1050000, sales_count: 18, days_to_sell: 42, median_price_1yr_prior: null, price_diff_1yr_pct: 18.0, median_valuation: null, median_list_price: null, total_volume: 1500000 },
            { region_name: 'Torbay', region_type: 'suburb', period_month: '2026-05-01', median_price: 1100000, sales_count: 20, days_to_sell: 41, median_price_1yr_prior: null, price_diff_1yr_pct: 20.0, median_valuation: null, median_list_price: null, total_volume: 1600000 },
            { region_name: 'Torbay', region_type: 'suburb', period_month: '2026-06-01', median_price: 1150000, sales_count: 22, days_to_sell: 40, median_price_1yr_prior: null, price_diff_1yr_pct: 22.0, median_valuation: null, median_list_price: null, total_volume: 1700000 },
          ],
        } as any;
      }
      if (sql.includes('real_estate')) {
        return {
          rows: [{ total: 0, no_data: 0, bucket_0_3: 0, bucket_3_5: 0, bucket_5_10: 0, bucket_10_15: 0, bucket_15_plus: 0 }],
        } as any;
      }
      if (sql.includes('direct_mail')) {
        return { rows: [{ mailed: 0, downloads: 0, appraisals: 0, conversions: 0 }] } as any;
      }
      return { rows: [] } as any;
    });

    // Quarterly aggregates: Q2 median is +10% vs Q1, while the REINZ YoY figure is ~20%.
    vi.mocked(aggregateToQuarterly).mockReturnValue([
      {
        period: '2026-Q1',
        periodRaw: '2026-Q1',
        cityMedian: null,
        citySales: 0,
        cityDays: null,
        cityDetail: null,
        suburbs: { Torbay: { median: 1000000, sales: 50, days: 40 } },
      },
      {
        period: '2026-Q2',
        periodRaw: '2026-Q2',
        cityMedian: null,
        citySales: 0,
        cityDays: null,
        cityDetail: null,
        suburbs: { Torbay: { median: 1100000, sales: 60, days: 41, priceDiffMomPct: 10, priceDiff1yrPct: 21.3, totalVolume: 4800000 } },
      },
    ] as any);

    const response = await POST(
      new Request('http://localhost:3000/api/admin/reports/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb_id: 'tor-1', quarter: '2026-Q2' }),
      })
    );

    expect(response.status).toBe(200);

    const insertCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('INSERT INTO report_documents'));
    const content = insertCall![1]![4] as string;

    // The card label says "Compared to Previous Quarter", so the price delta
    // must be the QoQ figure (+10.0%), not the YoY average (+20.0%).
    expect(content).toContain('"compareLabel":"Compared to Previous Quarter"');
    expect(content).toContain('"comparePriceChange":"+10.0%"');
    expect(content).not.toContain('"comparePriceChange":"+20.0%"');
    expect(content).toContain('"compareSalesChange":"+20.0%"');
  });

  it('generates +4.7% QoQ for a fresh Oteha 2026-Q2 report (end-to-end with the real aggregator)', async () => {
    // Delegate to the REAL aggregateToQuarterly so this test proves the full
    // pipeline: monthly rows → quarterly medians → QoQ on the report card.
    const actual = await vi.importActual<typeof import('@/lib/quarterly-aggregator')>('@/lib/quarterly-aggregator');
    vi.mocked(aggregateToQuarterly).mockImplementation((monthly) => actual.aggregateToQuarterly(monthly));

    const mk = (period: string, median: number, sales: number, days: number) => ({
      period,
      periodRaw: `${period}-01`,
      cityMedian: null,
      citySales: 0,
      cityDays: null,
      cityDetail: null,
      suburbs: {
        Oteha: {
          median,
          sales,
          days,
          priceDiffMomPct: 0.4,
          priceDiff1yrPct: 36.0, // REINZ YoY field — must NOT appear on the card
        },
      },
    });

    // Q1 median avg = 1,083,760; Q2 median avg = 1,134,667 → QoQ = +4.7%
    vi.mocked(getMonthlyData).mockResolvedValue([
      mk('2026-01', 1080000, 20, 45),
      mk('2026-02', 1085000, 22, 44),
      mk('2026-03', 1086280, 24, 43),
      mk('2026-04', 1130000, 26, 42),
      mk('2026-05', 1135000, 28, 41),
      mk('2026-06', 1139000, 30, 41),
    ] as any);

    const trendRow = (month: string, median: number, sales: number, days: number) => ({
      region_name: 'Oteha',
      region_type: 'suburb',
      period_month: `${month}-01`,
      median_price: median,
      sales_count: sales,
      days_to_sell: days,
      median_price_1yr_prior: null,
      price_diff_1yr_pct: 36.0,
      median_valuation: null,
      median_list_price: null,
      total_volume: 1500000,
    });

    vi.mocked(marieQuery).mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO report_documents')) {
        return { rows: [{ id: 'report-1' }] } as any;
      }
      if (sql.includes('report_suburbs')) {
        return { rows: [{ id: 'oteha-1', name: 'Oteha' }] } as any;
      }
      if (sql.includes('admin_users')) {
        return { rows: [{ id: 'admin-1' }] } as any;
      }
      if (sql.includes('market_monthly_snapshots')) {
        return {
          rows: [
            trendRow('2026-01', 1080000, 20, 45),
            trendRow('2026-02', 1085000, 22, 44),
            trendRow('2026-03', 1086280, 24, 43),
            trendRow('2026-04', 1130000, 26, 42),
            trendRow('2026-05', 1135000, 28, 41),
            trendRow('2026-06', 1139000, 30, 41),
          ],
        } as any;
      }
      if (sql.includes('real_estate')) {
        return {
          rows: [{ total: 0, no_data: 0, bucket_0_3: 0, bucket_3_5: 0, bucket_5_10: 0, bucket_10_15: 0, bucket_15_plus: 0 }],
        } as any;
      }
      if (sql.includes('direct_mail')) {
        return { rows: [{ mailed: 0, downloads: 0, appraisals: 0, conversions: 0 }] } as any;
      }
      return { rows: [] } as any;
    });

    const response = await POST(
      new Request('http://localhost:3000/api/admin/reports/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb_id: 'oteha-1', quarter: '2026-Q2' }),
      })
    );

    expect(response.status).toBe(200);

    const insertCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('INSERT INTO report_documents'));
    const content = insertCall![1]![4] as string;

    // A freshly generated report must show the QoQ figure (+4.7%), matching
    // the Analytics page — never the REINZ YoY field (+36.0%).
    expect(content).toContain('"compareLabel":"Compared to Previous Quarter"');
    expect(content).toContain('"comparePriceChange":"+4.7%"');
    expect(content).not.toContain('+36.0%');
  });
});