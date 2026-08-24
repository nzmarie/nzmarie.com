import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { generateChartImageUrl } from '@/lib/report-charts';
import { getMonthlyData, type MonthlyDataPoint } from '@/lib/market-data-aggregator';
import { aggregateToQuarterly } from '@/lib/quarterly-aggregator';
import { extractDaysToSellDescription, filterOutDaysToSellFromIntro } from './intro-utils';

interface TrendRow {
  region_name: string;
  region_type: string;
  period_month: string;
  median_price: number | null;
  sales_count: number | null;
  days_to_sell: number | null;
  median_price_1yr_prior: number | null;
  price_diff_1yr_pct: number | null;
  median_valuation: number | null;
  median_list_price: number | null;
  total_volume: number | null;
}

interface LastSoldRow {
  total: number;
  no_data: number;
  bucket_0_3: number;
  bucket_3_5: number;
  bucket_5_10: number;
  bucket_10_15: number;
  bucket_15_plus: number;
}

interface CampaignRow {
  mailed: number;
  downloads: number;
  appraisals: number;
  conversions: number;
}

const fmtM = (v: number | null | undefined): string => {
  if (v == null) return '-';
  return `$${(v / 1000000).toFixed(1)}M`;
};

function toLocalDateStr(d: unknown): string {
  if (typeof d === 'string') return d;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  return String(d);
}

function getYearMonth(d: unknown): string {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const s = String(d);
  return s.slice(0, 7);
}

function quarterToRange(quarter: string): { start: string; end: string } | null {
  const [yearStr, qStr] = quarter.split('-Q');
  if (!yearStr || !qStr) return null;
  const year = parseInt(yearStr);
  const qNum = parseInt(qStr);
  const startMonth = (qNum - 1) * 3 + 1;
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endMonth = startMonth + 3;
  const endYear = endMonth > 12 ? year + 1 : year;
  const endMonthAdjusted = endMonth > 12 ? endMonth - 12 : endMonth;
  const endDate = `${endYear}-${String(endMonthAdjusted).padStart(2, '0')}-01`;
  return { start: startDate, end: endDate };
}

async function fetchMarketTrends(suburbName: string, startQuarter: string, endQuarter?: string): Promise<TrendRow[] | null> {
  const start = quarterToRange(startQuarter);
  if (!start) return null;
  const startDate = start.start;
  const endDate = endQuarter && endQuarter !== startQuarter
    ? (quarterToRange(endQuarter)?.end ?? start.end)
    : start.end;

  const result = await marieQuery<TrendRow>(
    `SELECT region_name, region_type, period_month, median_price, sales_count, days_to_sell,
          median_price_1yr_prior, price_diff_1yr_pct, median_valuation, median_list_price, total_volume
     FROM market_monthly_snapshots
     WHERE (region_name = $1 OR region_name = 'North Shore City')
       AND period_month >= $2::date AND period_month < $3::date
     ORDER BY region_name, period_month ASC`,
     [suburbName, startDate, endDate]
  );
  return result.rows;
}



async function fetchLastSoldData(suburbName: string): Promise<LastSoldRow | null> {
  const result = await marieQuery<LastSoldRow>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NULL) AS no_data,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date >= NOW() - INTERVAL '3 years') AS bucket_0_3,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date >= NOW() - INTERVAL '5 years' AND p.last_sold_date < NOW() - INTERVAL '3 years') AS bucket_3_5,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date >= NOW() - INTERVAL '10 years' AND p.last_sold_date < NOW() - INTERVAL '5 years') AS bucket_5_10,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date >= NOW() - INTERVAL '15 years' AND p.last_sold_date < NOW() - INTERVAL '10 years') AS bucket_10_15,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date < NOW() - INTERVAL '15 years') AS bucket_15_plus
     FROM real_estate re
     LEFT JOIN properties p ON re.address = p.address AND re.suburb = p.suburb
     WHERE re.suburb = $1 AND re.city = 'North Shore City' AND re.status IN ('for sale', 'under offer')`,
    [suburbName]
  );
  return result.rows[0];
}

async function fetchCampaignStats(suburbName: string): Promise<CampaignRow | null> {
  const result = await marieQuery<CampaignRow>(
    `SELECT
       COUNT(DISTINCT da.id) AS mailed,
       COUNT(DISTINCT da.id) FILTER (WHERE da.has_downloaded = TRUE) AS downloads,
       COUNT(DISTINCT da.id) FILTER (WHERE da.has_requested_appraisal = TRUE) AS appraisals,
       COUNT(DISTINCT da.id) FILTER (WHERE da.is_converted = TRUE) AS conversions
     FROM direct_mail_addresses da
     JOIN direct_mail_campaigns dc ON da.campaign_id = dc.id
     WHERE da.suburb = $1`,
    [suburbName]
  );
  return result.rows[0];
}

async function fetchSuburbIntroduction(suburbId: string): Promise<unknown[] | null> {
  const result = await marieQuery<{ content: unknown | null }>(
    `SELECT content
     FROM report_documents
     WHERE suburb_id = $1
       AND doc_type = 'suburb_intro'
       AND status != 'archived'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [suburbId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const raw = result.rows[0].content;
  if (!raw) {
    return null;
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function agg(arr: (number | null)[]): number | null {
  const vals = arr.filter((v): v is number => v != null).map(v => Number(v));
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function sum(arr: (number | null)[]): number {
  return arr.filter((v): v is number => v != null).map(v => Number(v)).reduce((a, b) => a + b, 0);
}

function formatQuarterLabel(quarter: string): string {
  return quarter.replace(/-Q/, ' Q');
}

function previousQuarter(quarter: string): string | null {
  const [yearStr, qStr] = quarter.split('-Q');
  if (!yearStr || !qStr) return null;
  const year = Number(yearStr);
  const q = Number(qStr);
  if (Number.isNaN(year) || Number.isNaN(q) || q < 1 || q > 4) return null;
  if (q === 1) {
    return `${year - 1}-Q4`;
  }
  return `${year}-Q${q - 1}`;
}

function quarterMonthRange(quarter: string): { startYM: string; endYM: string } | null {
  const [yearStr, qStr] = quarter.split('-Q');
  const year = Number(yearStr);
  const q = Number(qStr);
  if (!yearStr || !qStr || Number.isNaN(year) || Number.isNaN(q) || q < 1 || q > 4) return null;
  const firstMonth = (q - 1) * 3 + 1;
  const lastMonth = firstMonth + 2;
  return {
    startYM: `${year}-${String(firstMonth).padStart(2, '0')}`,
    endYM: `${year + (lastMonth > 12 ? 1 : 0)}-${String(lastMonth > 12 ? lastMonth - 12 : lastMonth).padStart(2, '0')}`,
  };
}

function medianForQuarter(rows: TrendRow[], quarter: string): number | null {
  const range = quarterMonthRange(quarter);
  if (!range) return null;
  const inRange = rows.filter(r => {
    const ym = getYearMonth(r.period_month);
    return ym >= range.startYM && ym <= range.endYM;
  });
  return agg(inRange.map(r => r.median_price));
}

// Quarter-over-quarter median price change, computed from monthly rows.
function qoqPctFromRows(rows: TrendRow[], quarter: string): number | null {
  const prevQuarterKey = previousQuarter(quarter);
  if (!prevQuarterKey) return null;
  const cur = medianForQuarter(rows, quarter);
  const prev = medianForQuarter(rows, prevQuarterKey);
  if (cur == null || prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 10000) / 100;
}

function buildBlocks(
  suburbName: string,
  quarter: string,
  marketTrends: TrendRow[] | null,
  quarterAggs: MonthlyDataPoint[],
  lastSold: LastSoldRow | null,
  campaign: CampaignRow | null,
  chartImageUrl: string | null,
  suburbIntroContent: unknown[] | null,
  endQuarter?: string
): unknown[] {
  const blocks: unknown[] = [];
  const displayName = suburbName === 'North Shore City' ? 'North Shore' : suburbName;
  const displayQuarter = endQuarter && endQuarter !== quarter
    ? `${formatQuarterLabel(quarter)} – ${formatQuarterLabel(endQuarter)}`
    : formatQuarterLabel(quarter);

  // Extract Days to Sell description from introduction content
  const daysToSellFromIntro = extractDaysToSellDescription(suburbIntroContent);

  // Page 1: Cover
  blocks.push({ type: 'heading', props: { level: 1, textAlignment: 'center' }, content: [`${displayName}`] });
  blocks.push({ type: 'heading', props: { level: 2, textAlignment: 'center' }, content: [`${displayQuarter} Market Report`] });
  // Add introduction content, stripping any Days to Sell heading/paragraph (handled by KPI card instead)
  const filteredIntroContent = filterOutDaysToSellFromIntro(suburbIntroContent);
  if (filteredIntroContent && filteredIntroContent.length > 0) {
    blocks.push(...filteredIntroContent);
  }

  // Page 2: Quarterly Data — custom card block
  blocks.push({ type: 'heading', props: { level: 2 }, content: [`${displayName} Quarterly Data`] });

  if (marketTrends && marketTrends.length > 0) {
    // Prefer quarter-level aggregates computed in SQL when available
    let kpiTotalVolume: number | null = null;
    let kpiSales: number = 0;
    let kpiDays: number | null = null;
    let pricePct: number | null = null;
    let salesDiff: number | null = null;
    let salesUp = false;
    let salesChange = '\u2014';
    let compareDaysChange = '\u2014';
    let compareDaysUp = false;
    let compareLabel = 'Compared to Previous Period';

    const qParts = (quarter || '').split('-Q');
    const qYear = qParts.length === 2 ? Number(qParts[0]) : NaN;
    const qNum = qParts.length === 2 ? Number(qParts[1]) : NaN;

    const subData = marketTrends.filter((r) => r.region_name === suburbName);

    const periodKey = !isNaN(qYear) && !isNaN(qNum) ? `${qYear}-Q${qNum}` : null;

    // Use analytics-compatible quarterly aggregates when available
    if (quarterAggs.length > 0 && periodKey) {
      const qData = quarterAggs.find(d => d.period === periodKey);
      const sd = qData?.suburbs[suburbName];
      if (sd) {
        kpiTotalVolume = sd.totalVolume ?? null;
        kpiSales = sd.sales ?? 0;
        kpiDays = sd.days ?? null;
        // The card compares against the previous quarter, so the median price
        // delta must be quarter-over-quarter (not the REINZ 1-year figure).
        pricePct = sd.priceDiffMomPct ?? null;
      }
    }
    // Fallback: compute directly from monthly rows
    if (kpiSales === 0) {
      const vols = subData.map(r => r.total_volume).filter((v): v is number => v != null).map(Number);
      kpiTotalVolume = vols.length ? vols.reduce((a, b) => a + b, 0) : null;
      kpiSales = sum(subData.map(r => r.sales_count));
      kpiDays = agg(subData.map(r => r.days_to_sell));
      pricePct = qoqPctFromRows(subData, quarter);
    }

    const prevQuarter = previousQuarter(quarter);
    if (prevQuarter && periodKey) {
      let prevSales = 0;
      let prevDays: number | null = null;

      const prevData = quarterAggs.find(d => d.period === prevQuarter);
      const prevSd = prevData?.suburbs[suburbName];
      if (prevSd) {
        prevSales = prevSd.sales ?? 0;
        prevDays = prevSd.days ?? null;
      } else {
        const [pYearStr, pQStr] = prevQuarter.split('-Q');
        const pYear = Number(pYearStr);
        const pNum = Number(pQStr);
        const prevStartYM = `${pYear}-${String((pNum - 1) * 3 + 1).padStart(2, '0')}`;
        const prevEndYM = `${pYear + (pNum === 4 ? 1 : 0)}-${String((pNum * 3) > 12 ? (pNum * 3 - 12) : (pNum * 3)).padStart(2, '0')}`;
        const prevRows = subData.filter(r => {
          const ym = getYearMonth(r.period_month);
          return ym >= prevStartYM && ym <= prevEndYM;
        });
        prevSales = sum(prevRows.map(r => r.sales_count));
        prevDays = agg(prevRows.map(r => r.days_to_sell));
      }

      if (prevSales > 0 && kpiSales > 0) {
        const salesDiffVal = ((kpiSales - prevSales) / prevSales) * 100;
        const salesUpVal = salesDiffVal >= 0;
        salesDiff = salesDiffVal;
        salesUp = salesUpVal;
        salesChange = `${salesUpVal ? '+' : ''}${salesDiffVal.toFixed(1)}%`;
      }

      if (prevDays != null && kpiDays != null) {
        const daysDiffVal = kpiDays - prevDays;
        compareDaysUp = daysDiffVal > 0;
        compareDaysChange = `${daysDiffVal > 0 ? '+' : ''}${daysDiffVal}`;
      }
      compareLabel = 'Compared to Previous Quarter';
    }

    const priceUp = (pricePct ?? 0) >= 0;
    const priceChange = pricePct != null && !Number.isNaN(pricePct) ? `${priceUp ? '+' : ''}${pricePct.toFixed(1)}%` : '\u2014';

    const hasCompare = pricePct != null || salesDiff != null;
    let insightText = daysToSellFromIntro || '';
    if (insightText && kpiDays != null) {
      insightText = insightText.replace(/The average Days to Sell of \d+ days/i, `The average Days to Sell of ${kpiDays} days`);
    } else if (!insightText && kpiDays != null) {
      insightText = `The average Days to Sell of ${kpiDays} days during ${displayQuarter} reflects current market liquidity. Family homes in premium school zones trade quickly, while properties with development potential require longer negotiation periods.`;
    }

    blocks.push({
      type: 'quarterlyData',
      props: {
suburbName: displayName,
        // keep the human-readable formatted value for existing consumers
        totalVolume: fmtM(kpiTotalVolume),
        // also include raw numeric values to avoid downstream formatting ambiguities
        totalVolumeNumeric: kpiTotalVolume,
        totalSales: String(kpiSales),
        totalSalesNumeric: kpiSales,
        avgDaysToSell: kpiDays != null ? String(kpiDays) : '',
        periodText: displayQuarter,
        compareLabel: hasCompare ? compareLabel : '',
        comparePriceChange: priceChange,
        comparePriceUp: String(priceUp),
        compareSalesChange: salesChange,
        compareSalesUp: String(salesUp),
        compareDaysChange,
        compareDaysUp: String(compareDaysUp),
        insightText,
      },
    });
  } else {
    blocks.push({ type: 'paragraph', content: ['Quarterly data is not yet available for this suburb.'] });
  }

  // Page 3: REINZ Market Trends
  blocks.push({ type: 'heading', props: { level: 2 }, content: ['REINZ Market Trends'] });
  blocks.push({ type: 'paragraph', content: [`Quarterly market data for ${displayName} compared with North Shore.`] });

  if (chartImageUrl) {
    blocks.push({ type: 'image', props: { url: chartImageUrl, caption: '', name: 'Median price trend chart', showPreview: true, previewWidth: 700, textAlignment: 'left', backgroundColor: 'default' } });
    blocks.push({ type: 'paragraph', content: ['Chart: Median price trend — quarterly comparison.'] });
  }

  if (marketTrends && marketTrends.length > 0) {
    const suburbData = marketTrends.filter((r) => r.region_name === suburbName);
    const districtData = marketTrends.filter((r) => r.region_name === 'North Shore City' && r.region_name !== suburbName);

    const [qYear, qStr] = (quarter || '').split('-Q');
    const qNum = parseInt(qStr);
    const firstMonth = !isNaN(qNum) ? ((qNum - 1) * 3 + 1) : 1;
    const qStartYM = `${qYear}-${String(firstMonth).padStart(2, '0')}`;
    const lastMonth = firstMonth + 2;
    const qEndYM = `${Number(qYear) + (lastMonth > 12 ? 1 : 0)}-${String(lastMonth > 12 ? lastMonth - 12 : lastMonth).padStart(2, '0')}`;
    const summaryData = suburbData.filter(r => {
      const ym = getYearMonth(r.period_month);
      return ym >= qStartYM && ym <= qEndYM;
    });
    const summaryDist = districtData.filter(r => {
      const ym = getYearMonth(r.period_month);
      return ym >= qStartYM && ym <= qEndYM;
    });

    const subMedian = agg(summaryData.map(r => r.median_price));
    const subSales = sum(summaryData.map(r => r.sales_count));
    const subDays = agg(summaryData.map(r => r.days_to_sell));
    const distMedian = agg(summaryDist.map(r => r.median_price));
    const distSales = sum(summaryDist.map(r => r.sales_count));
    const distDays = agg(summaryDist.map(r => r.days_to_sell));

    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Quarterly Summary'] });
    const qRows = [
      { cells: [
        ['Metric'],
        [displayName],
        ['North Shore'],
      ]},
      { cells: [
        ['Median Price'],
        [fmtM(subMedian)],
        [fmtM(distMedian)],
      ]},
      { cells: [
        ['Sales Count'],
        [String(subSales)],
        [String(distSales)],
      ]},
    ];
    if (subDays != null) {
      qRows.push({ cells: [
        ['Avg Days to Sell'],
        [String(subDays)],
        [distDays != null ? String(distDays) : '-'],
      ]});
    }
    blocks.push({ type: 'table', props: { width: 1 }, content: { type: 'tableContent', rows: qRows, headerRows: 1, columnWidths: [] } });

    const monthStr = (d: unknown) => toLocalDateStr(d);
    const months = [...new Set(marketTrends.map((r) => monthStr(r.period_month)))].sort();
    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Monthly Breakdown'] });

    const mRows = [
      { cells: [
        ['Month'],
        [`${displayName} Median`],
        [`${displayName} Sales`],
        ['District Median'],
      ]},
    ];

    for (const month of months) {
      const sub = suburbData.find((r) => monthStr(r.period_month) === month);
      const dist = districtData.find((r) => monthStr(r.period_month) === month);
      const dsp = (d: string) => new Date(d).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
      mRows.push({
        cells: [
          [dsp(month)],
          [fmtM(sub?.median_price)],
          [sub ? String(sub.sales_count ?? 0) : '-'],
          [fmtM(dist?.median_price)],
        ]
      });
    }
    blocks.push({ type: 'table', props: { width: 1 }, content: { type: 'tableContent', rows: mRows, headerRows: 1, columnWidths: [] } });

    const lastSub = suburbData[suburbData.length - 1];
    if (lastSub && lastSub.price_diff_1yr_pct != null) {
      blocks.push({ type: 'paragraph', content: [`${displayName} median price is ${lastSub.price_diff_1yr_pct >= 0 ? 'up' : 'down'} ${Math.abs(lastSub.price_diff_1yr_pct).toFixed(1)}% year-on-year, with a median of ${fmtM(subMedian)}.`] });
      if (lastSub.days_to_sell != null) {
        blocks.push({ type: 'paragraph', content: [`Average days to sell: ${lastSub.days_to_sell} days.`] });
      }
    }
  } else {
    blocks.push({ type: 'paragraph', content: ['Market trend data is not yet available for this suburb. Upload REINZ data via the Analytics page to populate this section.'] });
  }

  // Page 3: Sales Analysis
  blocks.push({ type: 'heading', props: { level: 2 }, content: ['Sales Analysis'] });

  if (lastSold) {
    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Last Sold Data For Sale'] });
    blocks.push({ type: 'paragraph', content: [`Active listings in ${displayName}: ${lastSold.total} properties`] });
    const lsRows = [
      { cells: [
        ['Period'],
        ['Count'],
        ['%'],
      ]},
      { cells: [
        ['0-3 years'],
        [String(lastSold.bucket_0_3 ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_0_3 ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['3-5 years'],
        [String(lastSold.bucket_3_5 ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_3_5 ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['5-10 years'],
        [String(lastSold.bucket_5_10 ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_5_10 ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['10-15 years'],
        [String(lastSold.bucket_10_15 ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_10_15 ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['15+ years'],
        [String(lastSold.bucket_15_plus ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_15_plus ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['No data'],
        [String(lastSold.no_data ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.no_data ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
    ];
    blocks.push({ type: 'table', props: { width: 1 }, content: { type: 'tableContent', rows: lsRows, headerRows: 1, columnWidths: [] } });
  } else {
    blocks.push({ type: 'paragraph', content: ['Last sold data is not yet available for this suburb.'] });
  }

  if (campaign) {
    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Direct Mail Campaign Stats'] });
    blocks.push({ type: 'paragraph', content: [`Properties mailed: ${campaign.mailed ?? 0}`] });
    blocks.push({ type: 'paragraph', content: [`Downloads: ${campaign.downloads ?? 0} | Appraisals: ${campaign.appraisals ?? 0} | Conversions: ${campaign.conversions ?? 0}`] });
  }

  return blocks;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { suburb_id, quarter, start_quarter, end_quarter } = body;

    const reportQuarter = quarter; // label displayed on report cover
    const dataStart = start_quarter || quarter; // data query range start
    const dataEnd = end_quarter || quarter; // data query range end

    if (!suburb_id || !reportQuarter) {
      return NextResponse.json({ success: false, error: 'suburb_id and quarter are required' }, { status: 400 });
    }

    const suburbResult = await marieQuery<{ id: string; name: string }>(
      `SELECT id, name FROM report_suburbs WHERE id = $1`,
      [suburb_id]
    );
    if (suburbResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Suburb not found' }, { status: 404 });
    }
    let suburb = suburbResult.rows[0];
    // North Shore data is stored as 'North Shore City' in market_monthly_snapshots
    if (suburb.name === 'North Shore') {
      suburb = { ...suburb, name: 'North Shore City' };
    }
    const displayName = suburb.name === 'North Shore City' ? 'North Shore' : suburb.name;

    const adminResult = await marieQuery<{ id: string }>(
      `SELECT id FROM admin_users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    );
    const userId = adminResult.rows[0].id;

    // Cover both report quarter(s) and previous quarter in one unified data fetch (same as Analytics)
    const prevQuarter = previousQuarter(reportQuarter);
    const monthlyRangeStart = quarterToRange(prevQuarter || dataStart)?.start ?? '2025-01-01';
    const monthlyRangeEnd = quarterToRange(dataEnd || dataStart)?.end ?? '2026-12-31';

    const [monthlyRaw, marketTrends, lastSold, campaign, chartImageUrl, suburbIntroContent] = await Promise.all([
      getMonthlyData([suburb.name], 'North Shore City', monthlyRangeStart, monthlyRangeEnd),
      fetchMarketTrends(suburb.name, dataStart, dataEnd),
      fetchLastSoldData(suburb.name),
      fetchCampaignStats(suburb.name),
      generateChartImageUrl(suburb.name, reportQuarter, dataStart, dataEnd).catch(() => null),
      fetchSuburbIntroduction(suburb_id),
    ]);

    const quarterAggs = aggregateToQuarterly(monthlyRaw);

    const title = `${displayName} ${formatQuarterLabel(reportQuarter)} Market Report`;
    const content = buildBlocks(suburb.name, reportQuarter, marketTrends, quarterAggs, lastSold, campaign, chartImageUrl, suburbIntroContent);

    const result = await marieQuery<{ id: string }>(
      `INSERT INTO report_documents (user_id, doc_type, suburb_id, quarter, title, content)
       VALUES ($1, 'report', $2, $3, $4, $5) RETURNING id`,
      [userId, suburb_id, reportQuarter, title, JSON.stringify(content)]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
