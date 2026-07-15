import { query as marieQuery } from './db';
import { uploadToR2, isR2Mock } from './r2-storage';

interface RawTrendRow {
  region_name: string;
  period_month: string;
  median_price: number | null;
}

function avg(arr: number[]) {
  const nums = arr.filter(v => v != null).map(v => Number(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

async function fetchQuarterly(suburbName: string, numQuarters = 8) {
  const now = new Date();
  const endStr = `${now.getFullYear() + 1}-01-01`;
  const startDate = new Date(now.getFullYear(), now.getMonth() - numQuarters * 3, 1);
  const startStr = startDate.toISOString().slice(0, 10);

  const result = await marieQuery<RawTrendRow>(
    `SELECT region_name, period_month::text, median_price
     FROM market_monthly_snapshots
     WHERE region_name IN ($1, 'North Shore City')
       AND period_month >= $2::date AND period_month < $3::date
       AND median_price IS NOT NULL
     ORDER BY region_name, period_month ASC`,
    [suburbName, startStr, endStr]
  );

  const subQ: Record<string, number[]> = {};
  const distQ: Record<string, number[]> = {};
  for (const row of result.rows) {
    const d = new Date(row.period_month);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    const key = `${d.getFullYear()}-Q${q}`;
    const target = row.region_name === 'North Shore City' ? distQ : subQ;
    if (!target[key]) target[key] = [];
    if (row.median_price != null) target[key].push(row.median_price);
  }

  const subData = Object.entries(subQ).map(([k, v]) => ({ quarter: k, median: avg(v) })).sort((a, b) => a.quarter.localeCompare(b.quarter));
  const distData = Object.entries(distQ).map(([k, v]) => ({ quarter: k, median: avg(v) })).sort((a, b) => a.quarter.localeCompare(b.quarter));
  return { subData, distData };
}

function generateSVG(
  suburbName: string,
  subData: { quarter: string; median: number | null }[],
  distData: { quarter: string; median: number | null }[]
): string {
  // Filter out unreasonable values (> $50M) that indicate data corruption (SUM instead of MEDIAN)
  const MAX_SANE_PRICE = 50000000;
  const filterSane = (d: { quarter: string; median: number | null }) =>
    d.median != null && d.median > 10000 && d.median < MAX_SANE_PRICE ? d : { ...d, median: null };

  const cleanSub = subData.map(filterSane);
  const cleanDist = distData.map(filterSane);

  const allQ = [...new Set([...cleanSub.map(d => d.quarter), ...cleanDist.map(d => d.quarter)])].sort();
  const subMap = new Map(cleanSub.map(d => [d.quarter, d.median]));
  const distMap = new Map(cleanDist.map(d => [d.quarter, d.median]));
  const points = allQ.map(q => ({ quarter: q, sub: subMap.get(q) ?? null, dist: distMap.get(q) ?? null }));

  const valid = points.filter(p => p.sub != null || p.dist != null);
  if (valid.length < 2) return '';

  const W = 700, H = 380, PT = 40, PR = 30, PB = 60, PL = 70;
  const CW = W - PL - PR, CH = H - PT - PB;

  const allVals = points.flatMap(p => [p.sub, p.dist].filter((v): v is number => v != null));
  const maxVal = Math.max(...allVals);
  const yMax = Math.ceil(maxVal * 1.15 / 100000) * 100000;
  const yMin = 0;

  const xS = (i: number) => PL + (i / Math.max(points.length - 1, 1)) * CW;
  const yS = (v: number) => PT + CH - ((v - yMin) / (yMax - yMin)) * CH;

  const subColor = '#2563EB', distColor = '#DC2626';

  const subPts = points.filter(p => p.sub != null).map(p => ({ x: xS(allQ.indexOf(p.quarter)), y: yS(p.sub!) }));
  const distPts = points.filter(p => p.dist != null).map(p => ({ x: xS(allQ.indexOf(p.quarter)), y: yS(p.dist!) }));

  const yTicks = 5;
  const yGrid: { y: number; label: string }[] = [];
  for (let i = 0; i <= yTicks; i++) {
    const val = yMin + (yMax / yTicks) * i;
    yGrid.push({ y: yS(val), label: `$${(val / 1000000).toFixed(2)}M` });
  }

  const mkPt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  const subLine = subPts.length > 1 ? `<polyline points="${subPts.map(mkPt).join(' ')}" fill="none" stroke="${subColor}" stroke-width="2.5"/>` : '';
  const subDots = subPts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${subColor}"/>`).join('');
  const distLine = distPts.length > 1 ? `<polyline points="${distPts.map(mkPt).join(' ')}" fill="none" stroke="${distColor}" stroke-width="2.5" stroke-dasharray="6,3"/>` : '';
  const distDots = distPts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${distColor}"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="font-family: Arial, sans-serif;">
<rect width="${W}" height="${H}" fill="white"/>
<rect x="${PL}" y="${PT}" width="${CW}" height="${CH}" fill="none" stroke="#e5e7eb" stroke-width="1"/>
${yGrid.map(g => `<line x1="${PL}" y1="${g.y}" x2="${W - PR}" y2="${g.y}" stroke="#f3f4f6" stroke-width="1"/>
<text x="${PL - 6}" y="${g.y + 4}" text-anchor="end" fill="#6b7280" font-size="11">${g.label}</text>`).join('')}
${points.map((p, i) => `<text x="${xS(i)}" y="${H - PB + 20}" text-anchor="middle" fill="#6b7280" font-size="${points.length > 6 ? 8 : 10}">${p.quarter}</text>`).join('')}
<text x="${W / 2}" y="22" text-anchor="middle" fill="#111827" font-size="14" font-weight="bold">${suburbName} vs North Shore City — Median Price</text>
${subLine}
${subDots}
${distLine}
${distDots}
<rect x="${W - 220}" y="30" width="200" height="50" rx="4" fill="white" stroke="#e5e7eb" stroke-width="1"/>
<line x1="${W - 210}" y1="45" x2="${W - 180}" y2="45" stroke="${subColor}" stroke-width="2.5"/>
<circle cx="${W - 195}" cy="45" r="3" fill="${subColor}"/>
<text x="${W - 172}" y="49" fill="#374151" font-size="11">${suburbName}</text>
<line x1="${W - 210}" y1="65" x2="${W - 180}" y2="65" stroke="${distColor}" stroke-width="2.5" stroke-dasharray="6,3"/>
<circle cx="${W - 195}" cy="65" r="3" fill="${distColor}"/>
<text x="${W - 172}" y="69" fill="#374151" font-size="11">North Shore City</text>
<text x="${W / 2}" y="${H - 5}" text-anchor="middle" fill="#6b7280" font-size="11">Quarter</text>
<text x="14" y="${H / 2}" text-anchor="middle" fill="#6b7280" font-size="11" transform="rotate(-90, 14, ${H / 2})">Median Price (NZD)</text>
</svg>`;
}

export async function generateChartImageUrl(suburbName: string, quarter: string): Promise<string | null> {
  if (isR2Mock) return null;

  const { subData, distData } = await fetchQuarterly(suburbName);
  const svg = generateSVG(suburbName, subData, distData);
  if (!svg) return null;

  const safeName = suburbName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const key = `charts/${safeName}-${quarter}-median-trend.svg`;
  await uploadToR2(key, Buffer.from(svg, 'utf-8'), 'image/svg+xml');

  const domain = process.env.R2_PUBLIC_DOMAIN;
  return domain ? `${domain}/${key}` : null;
}
