import { query } from './db';

export interface QuarterlyComparison {
  period: string;
  year: number;
  quarter: number;
  suburbMedian: number | null;
  suburbSales: number;
  suburbDays: number | null;
  cityMedian: number | null;
  citySales: number;
  cityDays: number | null;
}

export interface MonthlyDataPoint {
  period: string;           // "2025-01"
  periodRaw: string;         // "2025-01-01"
  suburbMedian: number | null;
  suburbSales: number;
  suburbDays: number | null;
  cityMedian: number | null;
  citySales: number;
  cityDays: number | null;
}

export interface ChartDataResponse {
  suburb: string;
  district: string;
  timeRange: { from: string; to: string };
  chartData: QuarterlyComparison[];
  monthlyData: MonthlyDataPoint[];
}

interface RawMonthly {
  region_name: string;
  period_month: string;
  median_price: number | null;
  sales_count: number;
  days_to_sell: number | null;
}

function quarterFromMonth(m: number): number {
  return Math.ceil(m / 3);
}

function aggregateMonthsToQuarters(
  rows: RawMonthly[],
  suburbName: string,
  districtName: string
): QuarterlyComparison[] {
  const suburbRows = rows.filter(r => r.region_name === suburbName);
  const districtRows = rows.filter(r => r.region_name === districtName);
  const map = new Map<string, { suburb: RawMonthly[]; district: RawMonthly[] }>();

  for (const r of suburbRows) {
    const d = new Date(r.period_month);
    const key = `${d.getFullYear()}-Q${quarterFromMonth(d.getMonth() + 1)}`;
    if (!map.has(key)) map.set(key, { suburb: [], district: [] });
    map.get(key)!.suburb.push(r);
  }
  for (const r of districtRows) {
    const d = new Date(r.period_month);
    const key = `${d.getFullYear()}-Q${quarterFromMonth(d.getMonth() + 1)}`;
    if (!map.has(key)) map.set(key, { suburb: [], district: [] });
    map.get(key)!.district.push(r);
  }

  const result: QuarterlyComparison[] = [];
  for (const [key, groups] of map) {
    const [y, qs] = key.split('-Q');
    const year = parseInt(y);
    const quarter = parseInt(qs);
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

    const sMedians = groups.suburb.map(r => r.median_price).filter((v): v is number => v !== null);
    const dMedians = groups.district.map(r => r.median_price).filter((v): v is number => v !== null);
    const sDays = groups.suburb.map(r => r.days_to_sell).filter((v): v is number => v !== null);
    const dDays = groups.district.map(r => r.days_to_sell).filter((v): v is number => v !== null);

    result.push({
      period: key,
      year,
      quarter,
      suburbMedian: avg(sMedians),
      suburbSales: sum(groups.suburb.map(r => r.sales_count)),
      suburbDays: avg(sDays),
      cityMedian: avg(dMedians),
      citySales: sum(groups.district.map(r => r.sales_count)),
      cityDays: avg(dDays),
    });
  }

  return result.sort((a, b) => a.year - b.year || a.quarter - b.quarter);
}

export async function getMonthlyData(
  suburbName: string,
  districtName: string,
  startDate: string,
  endDate: string
): Promise<MonthlyDataPoint[]> {
  try {
    const result = await query<{
      region_name: string;
      period_month: string;
      median_price: number | null;
      sales_count: number;
      days_to_sell: number | null;
    }>(
      `SELECT region_name, period_month::text, median_price, sales_count, days_to_sell
       FROM market_monthly_snapshots
       WHERE region_name IN ($1, $2)
         AND period_month BETWEEN $3::date AND $4::date
       ORDER BY period_month, region_name`,
      [suburbName, districtName, startDate, endDate]
    );

    const rows = result.rows;
    if (rows.length === 0) return [];

    const suburbRows = rows.filter(r => r.region_name === suburbName);
    const districtRows = rows.filter(r => r.region_name === districtName);

    // Build map by month-key
    const keys = new Set<string>();
    for (const r of rows) {
      keys.add(r.period_month.slice(0, 7)); // "2025-01"
    }

    const merged: MonthlyDataPoint[] = [];
    for (const key of keys) {
      const s = suburbRows.find(r => r.period_month.startsWith(key));
      const d = districtRows.find(r => r.period_month.startsWith(key));
      merged.push({
        period: key,
        periodRaw: s?.period_month ?? d?.period_month ?? key + '-01',
        suburbMedian: s?.median_price ?? null,
        suburbSales: s?.sales_count ?? 0,
        suburbDays: s?.days_to_sell ?? null,
        cityMedian: d?.median_price ?? null,
        citySales: d?.sales_count ?? 0,
        cityDays: d?.days_to_sell ?? null,
      });
    }

    return merged.sort((a, b) => a.period.localeCompare(b.period));
  } catch (err) {
    console.error('Error fetching monthly data:', err);
    return [];
  }
}

export async function getQuarterlyComparison(
  suburbName: string,
  districtName: string,
  startDate: string,
  endDate: string
): Promise<QuarterlyComparison[]> {
  // Try SQL-level aggregation first (ordinal GROUP BY for CockroachDB compat)
  try {
    const result = await query<{
      region_name: string;
      year: number;
      quarter: number;
      median: number | null;
      sales: number;
      days: number | null;
    }>(
      `SELECT
        region_name,
        EXTRACT(YEAR FROM period_month)::int AS year,
        CEIL(EXTRACT(MONTH FROM period_month) / 3.0)::int AS quarter,
        ROUND(AVG(median_price)) AS median,
        SUM(sales_count) AS sales,
        ROUND(AVG(days_to_sell)) AS days
      FROM market_monthly_snapshots
      WHERE region_name IN ($1, $2)
        AND period_month BETWEEN $3::date AND $4::date
      GROUP BY region_name, 2, 3
      ORDER BY year, quarter, region_name`,
      [suburbName, districtName, startDate, endDate]
    );

    const rows = result.rows;
    if (rows.length > 0) {
      const suburbData = rows.filter(r => r.region_name === suburbName);
      const districtData = rows.filter(r => r.region_name === districtName);

      const merged: QuarterlyComparison[] = [];
      const allKeys = new Set<string>();
      for (const r of rows) {
        allKeys.add(`${r.year}-Q${r.quarter}`);
      }

      for (const key of allKeys) {
        const [y, q] = key.split('-Q').map(Number);
        const suburb = suburbData.find(s => s.year === y && s.quarter === q);
        const district = districtData.find(d => d.year === y && d.quarter === q);
        merged.push({
          period: key,
          year: y,
          quarter: q,
          suburbMedian: suburb?.median ?? null,
          suburbSales: suburb?.sales ?? 0,
          suburbDays: suburb?.days ?? null,
          cityMedian: district?.median ?? null,
          citySales: district?.sales ?? 0,
          cityDays: district?.days ?? null,
        });
      }

      return merged.sort((a, b) => a.year - b.year || a.quarter - b.quarter);
    }
  } catch (sqlErr) {
    console.warn('SQL quarterly aggregation failed, falling back to JS aggregation:', sqlErr);
  }

  // Fallback: fetch raw monthly data and aggregate in JS (works on any DB)
  try {
    const raw = await query<RawMonthly>(
      `SELECT region_name, period_month::text, median_price, sales_count, days_to_sell
       FROM market_monthly_snapshots
       WHERE region_name IN ($1, $2)
         AND period_month BETWEEN $3::date AND $4::date
       ORDER BY period_month`,
      [suburbName, districtName, startDate, endDate]
    );
    if (raw.rows.length > 0) {
      return aggregateMonthsToQuarters(raw.rows, suburbName, districtName);
    }
  } catch (fallbackErr) {
    console.error('JS fallback aggregation also failed:', fallbackErr);
  }

  return [];
}
