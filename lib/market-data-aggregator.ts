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

export interface ChartDataResponse {
  suburb: string;
  district: string;
  timeRange: { from: string; to: string };
  chartData: QuarterlyComparison[];
}

export async function getQuarterlyComparison(
  suburbName: string,
  districtName: string,
  startDate: string,
  endDate: string
): Promise<QuarterlyComparison[]> {
  const result = await query<{
    region_name: string;
    year: number;
    quarter: number;
    median: number | null;
    sales: number;
    days: number | null;
  }>(
    `WITH quarterly_data AS (
      SELECT
        region_name,
        EXTRACT(YEAR FROM period_month)::int AS year,
        CEIL(EXTRACT(MONTH FROM period_month) / 3.0)::int AS quarter,
        ROUND(AVG(median_price)) AS median,
        SUM(sales_count) AS sales,
        ROUND(AVG(days_to_sell)) AS days
      FROM market_monthly_snapshots
      WHERE region_name IN ($1, $2)
        AND period_month BETWEEN $3::date AND $4::date
      GROUP BY region_name, year, quarter
    )
    SELECT * FROM quarterly_data
    ORDER BY year, quarter, region_name`,
    [suburbName, districtName, startDate, endDate]
  );

  const rows = result.rows;
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
