import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { generateChartImageUrl } from '@/lib/report-charts';

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

async function fetchMarketTrends(suburbName: string, quarter: string): Promise<TrendRow[] | null> {
  const [yearStr, qStr] = quarter.split('-Q');
  if (!yearStr || !qStr) return null;
  const year = parseInt(yearStr);
  const qNum = parseInt(qStr);
  const startMonth = (qNum - 1) * 3 + 1;
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endMonth = startMonth + 3;
  const endDate = `${endMonth > 12 ? year + 1 : year}-${String(endMonth > 12 ? endMonth - 12 : endMonth).padStart(2, '0')}-01`;

  const result = await marieQuery<TrendRow>(
    `SELECT region_name, region_type, period_month, median_price, sales_count, days_to_sell,
            median_price_1yr_prior, price_diff_1yr_pct, median_valuation, median_list_price
     FROM market_monthly_snapshots
     WHERE region_name IN ($1, 'North Shore City')
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

function agg(arr: (number | null)[]): number | null {
  const vals = arr.filter((v): v is number => v != null).map(v => Number(v));
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function sum(arr: (number | null)[]): number {
  return arr.filter((v): v is number => v != null).map(v => Number(v)).reduce((a, b) => a + b, 0);
}

function buildBlocks(
  suburbName: string,
  quarter: string,
  marketTrends: TrendRow[] | null,
  lastSold: LastSoldRow | null,
  campaign: CampaignRow | null,
  chartImageUrl: string | null
): unknown[] {
  const blocks: unknown[] = [];

  // Page 1: Cover
  blocks.push({ type: 'heading', props: { level: 1, textAlignment: 'center' }, content: [`${suburbName}`] });
  blocks.push({ type: 'heading', props: { level: 2, textAlignment: 'center' }, content: [`${quarter} Market Report`] });
  blocks.push({ type: 'paragraph', props: { textAlignment: 'center' }, content: [`Prepared by Marie Nian — nzmarie.co.nz`] });
  blocks.push({ type: 'paragraph', props: { textAlignment: 'center' }, content: [`Date: ${new Date().toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' })}`] });
  blocks.push({ type: 'divider' });

  // Page 2: REINZ Market Trends
  blocks.push({ type: 'heading', props: { level: 2 }, content: ['REINZ Market Trends'] });
  blocks.push({ type: 'paragraph', content: [`Quarterly market data for ${suburbName} compared with North Shore City.`] });

  if (chartImageUrl) {
    blocks.push({ type: 'image', props: { url: chartImageUrl, caption: '', name: 'Median price trend chart', showPreview: true, previewWidth: 700, textAlignment: 'left', backgroundColor: 'default' } });
    blocks.push({ type: 'paragraph', content: ['Chart: Median price trend — quarterly comparison.'] });
  }

  if (marketTrends && marketTrends.length > 0) {
    const suburbData = marketTrends.filter((r) => r.region_type === 'suburb');
    const districtData = marketTrends.filter((r) => r.region_type !== 'suburb');

    // Quarterly aggregation matching analytics SQL:
    // AVG(median_price) as median, SUM(sales_count) as sales
    const subMedian = agg(suburbData.map(r => r.median_price));
    const subSales = sum(suburbData.map(r => r.sales_count));
    const subDays = agg(suburbData.map(r => r.days_to_sell));
    const distMedian = agg(districtData.map(r => r.median_price));
    const distSales = sum(districtData.map(r => r.sales_count));
    const distDays = agg(districtData.map(r => r.days_to_sell));

    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Quarterly Summary'] });
    const qRows = [
      { cells: [
        ['Metric'],
        [suburbName],
        ['North Shore City'],
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

    const monthStr = (d: unknown) => typeof d === 'string' ? d : new Date(d as string).toISOString().slice(0, 10);
    const months = [...new Set(marketTrends.map((r) => monthStr(r.period_month)))].sort();
    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Monthly Breakdown'] });

    const mRows = [
      { cells: [
        ['Month'],
        [`${suburbName} Median`],
        [`${suburbName} Sales`],
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
      blocks.push({ type: 'paragraph', content: [`${suburbName} median price is ${lastSub.price_diff_1yr_pct >= 0 ? 'up' : 'down'} ${Math.abs(lastSub.price_diff_1yr_pct).toFixed(1)}% year-on-year, with a median of ${fmtM(subMedian)}.`] });
      if (lastSub.days_to_sell != null) {
        blocks.push({ type: 'paragraph', content: [`Average days to sell: ${lastSub.days_to_sell} days.`] });
      }
    }
  } else {
    blocks.push({ type: 'paragraph', content: ['Market trend data is not yet available for this suburb. Upload REINZ data via the Analytics page to populate this section.'] });
  }

  blocks.push({ type: 'divider' });

  // Page 3: Sales Analysis
  blocks.push({ type: 'heading', props: { level: 2 }, content: ['Sales Analysis'] });

  if (lastSold) {
    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Last Sold Data For Sale'] });
    blocks.push({ type: 'paragraph', content: [`Active listings in ${suburbName}: ${lastSold.total} properties`] });
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

  blocks.push({ type: 'divider' });

  // Page 4: About Marie
  blocks.push({ type: 'heading', props: { level: 2 }, content: ['About Marie Nian'] });
  blocks.push({ type: 'paragraph', content: ['Marie Nian is a dedicated real estate professional serving the North Shore community. With extensive local market knowledge, Marie provides personalised service to buyers and sellers across the North Shore.'] });
  blocks.push({ type: 'heading', props: { level: 3 }, content: ['Services Offered'] });
  blocks.push({ type: 'bulletListItem', content: ['Free property appraisals and market analysis'] });
  blocks.push({ type: 'bulletListItem', content: ['Expert negotiation and sales strategy'] });
  blocks.push({ type: 'bulletListItem', content: ['Comprehensive marketing campaigns'] });
  blocks.push({ type: 'bulletListItem', content: ['Buyer representation and property search'] });
  blocks.push({ type: 'bulletListItem', content: ['Investment portfolio advice'] });
  blocks.push({ type: 'paragraph', content: ['Contact Marie today for a no-obligation discussion about your property goals.'] });
  blocks.push({ type: 'paragraph', props: { textAlignment: 'center' }, content: ['www.nzmarie.co.nz'] });

  return blocks;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { suburb_id, quarter } = body;

    if (!suburb_id || !quarter) {
      return NextResponse.json({ success: false, error: 'suburb_id and quarter are required' }, { status: 400 });
    }

    const suburbResult = await marieQuery<{ id: string; name: string }>(
      `SELECT id, name FROM report_suburbs WHERE id = $1`,
      [suburb_id]
    );
    if (suburbResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Suburb not found' }, { status: 404 });
    }
    const suburb = suburbResult.rows[0];

    const adminResult = await marieQuery<{ id: string }>(
      `SELECT id FROM admin_users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    );
    const userId = adminResult.rows[0].id;

    const [marketTrends, lastSold, campaign, chartImageUrl] = await Promise.all([
      fetchMarketTrends(suburb.name, quarter),
      fetchLastSoldData(suburb.name),
      fetchCampaignStats(suburb.name),
      generateChartImageUrl(suburb.name, quarter).catch(() => null),
    ]);

    const title = `${suburb.name} ${quarter} Market Report`;
    const content = buildBlocks(suburb.name, quarter, marketTrends, lastSold, campaign, chartImageUrl);

    const result = await marieQuery<{ id: string }>(
      `INSERT INTO report_documents (user_id, doc_type, suburb_id, quarter, title, content)
       VALUES ($1, 'report', $2, $3, $4, $5) RETURNING id`,
      [userId, suburb_id, quarter, title, JSON.stringify(content)]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
