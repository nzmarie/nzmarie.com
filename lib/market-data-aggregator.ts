import { query } from './db';

export interface MonthlyDataPoint {
  period: string;           // "2025-01"
  periodRaw: string;        // "2025-01-01"
  cityMedian: number | null;
  citySales: number;
  cityDays: number | null;
  suburbs: Record<string, { median: number | null; sales: number; days: number | null }>;
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

export async function getMonthlyData(
  suburbNames: string[],
  districtName: string,
  startDate: string,
  endDate: string
): Promise<MonthlyDataPoint[]> {
  try {
    const params = [suburbNames, districtName, startDate, endDate];
    const result = await query<RawMonthly>(
      `SELECT region_name, period_month::text, median_price, sales_count, days_to_sell
       FROM market_monthly_snapshots
       WHERE (region_name = ANY($1::text[]) OR region_name = $2)
         AND period_month BETWEEN $3::date AND $4::date
       ORDER BY period_month, region_name`,
      params
    );

    const rows = result.rows;
    if (rows.length === 0) return [];

    const districtRows = rows.filter(r => r.region_name === districtName);

    const keys = new Set<string>();
    for (const r of rows) {
      keys.add(r.period_month.slice(0, 7));
    }

    const merged: MonthlyDataPoint[] = [];
    for (const key of keys) {
      const d = districtRows.find(r => r.period_month.startsWith(key));
      const suburbs: MonthlyDataPoint['suburbs'] = {};
      for (const sn of suburbNames) {
        const sr = rows.find(r => r.region_name === sn && r.period_month.startsWith(key));
        if (sr) {
          suburbs[sn] = {
            median: sr.median_price,
            sales: sr.sales_count,
            days: sr.days_to_sell,
          };
        }
      }
      merged.push({
        period: key,
        periodRaw: d?.period_month ?? key + '-01',
        cityMedian: d?.median_price ?? null,
        citySales: d?.sales_count ?? 0,
        cityDays: d?.days_to_sell ?? null,
        suburbs,
      });
    }

    return merged.sort((a, b) => a.period.localeCompare(b.period));
  } catch (err) {
    console.error('Error fetching monthly data:', err);
    return [];
  }
}

export async function getQuarterlyComparison(
  suburbNames: string[],
  districtName: string,
  startDate: string,
  endDate: string
): Promise<MonthlyDataPoint[]> {
  // Try SQL-level aggregation first
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
      WHERE (region_name = ANY($1::text[]) OR region_name = $2)
        AND period_month BETWEEN $3::date AND $4::date
      GROUP BY region_name, 2, 3
      ORDER BY year, quarter, region_name`,
      [suburbNames, districtName, startDate, endDate]
    );

    const rows = result.rows.map(r => ({
      region_name: r.region_name,
      year: Number(r.year),
      quarter: Number(r.quarter),
      median: r.median !== null ? Number(r.median) : null,
      sales: Number(r.sales),
      days: r.days !== null ? Number(r.days) : null,
    }));
    if (rows.length > 0) {
      return aggregateQuarterlyRows(rows, suburbNames, districtName);
    }
  } catch (sqlErr) {
    console.warn('SQL quarterly aggregation failed, falling back to JS aggregation:', sqlErr);
  }

  // Fallback: fetch raw monthly and aggregate in JS
  try {
    const raw = await query<RawMonthly>(
      `SELECT region_name, period_month::text, median_price, sales_count, days_to_sell
       FROM market_monthly_snapshots
       WHERE (region_name = ANY($1::text[]) OR region_name = $2)
         AND period_month BETWEEN $3::date AND $4::date
       ORDER BY period_month`,
      [suburbNames, districtName, startDate, endDate]
    );
    if (raw.rows.length > 0) {
      return aggregateRawToQuarterly(raw.rows, suburbNames, districtName);
    }
  } catch (fallbackErr) {
    console.error('JS fallback aggregation also failed:', fallbackErr);
  }

  return [];
}

function aggregateQuarterlyRows(
  rows: { region_name: string; year: number; quarter: number; median: number | null; sales: number; days: number | null }[],
  suburbNames: string[],
  districtName: string
): MonthlyDataPoint[] {
  const districtData = rows.filter(r => r.region_name === districtName);

  const allKeys = new Set<string>();
  for (const r of rows) {
    allKeys.add(`${r.year}-Q${r.quarter}`);
  }

  const result: MonthlyDataPoint[] = [];
  for (const key of allKeys) {
    const [y, q] = key.split('-Q').map(Number);
    const d = districtData.find(r => r.year === y && r.quarter === q);
    const suburbs: MonthlyDataPoint['suburbs'] = {};
    for (const sn of suburbNames) {
      const sr = rows.find(r => r.region_name === sn && r.year === y && r.quarter === q);
      if (sr) {
        suburbs[sn] = { median: sr.median, sales: sr.sales, days: sr.days };
      }
    }
    if (Object.keys(suburbs).length > 0 || d) {
      result.push({
        period: key,
        periodRaw: key,
        cityMedian: d?.median ?? null,
        citySales: d?.sales ?? 0,
        cityDays: d?.days ?? null,
        suburbs,
      });
    }
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}

function aggregateRawToQuarterly(
  rows: RawMonthly[],
  suburbNames: string[],
  districtName: string
): MonthlyDataPoint[] {
  const map = new Map<string, { district: RawMonthly[]; suburbs: Map<string, RawMonthly[]> }>();
  for (const r of rows) {
    const d = new Date(r.period_month);
    const key = `${d.getFullYear()}-Q${quarterFromMonth(d.getMonth() + 1)}`;
    if (!map.has(key)) map.set(key, { district: [], suburbs: new Map() });
    const entry = map.get(key)!;
    if (r.region_name === districtName) {
      entry.district.push(r);
    } else if (suburbNames.includes(r.region_name)) {
      if (!entry.suburbs.has(r.region_name)) entry.suburbs.set(r.region_name, []);
      entry.suburbs.get(r.region_name)!.push(r);
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  const result: MonthlyDataPoint[] = [];
  for (const [key, groups] of map) {
    const suburbs: MonthlyDataPoint['suburbs'] = {};
    for (const [sn, sRows] of groups.suburbs) {
      suburbs[sn] = {
        median: avg(sRows.map(r => r.median_price).filter((v): v is number => v !== null)),
        sales: sum(sRows.map(r => r.sales_count)),
        days: avg(sRows.map(r => r.days_to_sell).filter((v): v is number => v !== null)),
      };
    }
    const dMedians = groups.district.map(r => r.median_price).filter((v): v is number => v !== null);
    const dDays = groups.district.map(r => r.days_to_sell).filter((v): v is number => v !== null);
    result.push({
      period: key,
      periodRaw: key,
      cityMedian: avg(dMedians),
      citySales: sum(groups.district.map(r => r.sales_count)),
      cityDays: avg(dDays),
      suburbs,
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}
