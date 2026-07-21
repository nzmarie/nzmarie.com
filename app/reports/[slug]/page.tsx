import { notFound } from "next/navigation";
import {
  formatCurrency,
  type ReportMetrics,
  type TrendRow,
} from "../../../lib/report-data";
import { staticMetrics } from "../../../lib/report-data-static";
import { query as marieQuery } from "../../../lib/db";

function loadMetrics(slug: string): ReportMetrics | null {
  return staticMetrics[slug.toLowerCase()] || null;
}

function slugToQuarter(slug: string): { suburbSlug: string; quarterLabel: string } | null {
  // expect slug like 'northcross-q2-2026' or 'northcross-q1-2026'
  const m = slug.match(/^(.+)-q([1-4])-(\d{4})$/i);
  if (!m) return null;
  const suburbSlug = m[1];
  const qNum = m[2];
  const year = m[3];
  return { suburbSlug: suburbSlug.toLowerCase(), quarterLabel: `${year}-Q${qNum}` };
}

async function fetchReportContentBySlug(slug: string): Promise<any[] | null> {
  const parsed = slugToQuarter(slug);
  if (!parsed) return null;
  const { suburbSlug, quarterLabel } = parsed;

  // find suburb by slug (name lowercased, spaces replaced by '-')
  const suburbRes = await marieQuery<{ id: string; name: string }>(
    `SELECT id, name FROM report_suburbs WHERE lower(replace(name, ' ', '-')) = $1 LIMIT 1`,
    [suburbSlug]
  );
  if (suburbRes.rows.length === 0) return null;
  const suburb = suburbRes.rows[0];

  const docRes = await marieQuery<{ content: any }>(
    `SELECT content FROM report_documents WHERE suburb_id = $1 AND quarter = $2 AND status != 'archived' ORDER BY updated_at DESC LIMIT 1`,
    [suburb.id, quarterLabel]
  );
  if (docRes.rows.length === 0) return null;
  const raw = docRes.rows[0].content;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function renderBlock(block: any, i: number) {
  if (!block) return null;
  const { type } = block as { type: string };
  if (type === 'heading') {
    const level = (block.props?.level ?? 2) as number;
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    const text = Array.isArray(block.content) ? block.content.join('') : (block.content || '');
    return <Tag key={i} className="text-xl font-bold text-slate-900 mb-4">{text}</Tag>;
  }
  if (type === 'paragraph') {
    const text = Array.isArray(block.content) ? block.content.join('') : (block.content || '');
    return <p key={i} className="text-slate-600 mb-4">{text}</p>;
  }
  if (type === 'image') {
    const url = block.props?.url;
    const caption = block.props?.caption || '';
    return (
      <figure key={i} className="mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={caption} className="max-w-full h-auto" />
        {caption && <figcaption className="text-sm text-slate-500">{caption}</figcaption>}
      </figure>
    );
  }
  if (type === 'quarterlyData') {
    // reuse the admin HTML style from ReportEditor for consistent look
    const p = block.props || {};
    const fmtM = (v: number | null | undefined) => (v == null ? '\u2014' : `$${(v / 1000000).toFixed(1)}M`);
    const displayTotalVolume = (p.totalVolumeNumeric != null) ? fmtM(Number(p.totalVolumeNumeric)) : (p.totalVolume || '\u2014');
    const displayTotalSales = (p.totalSalesNumeric != null) ? String(p.totalSalesNumeric) : (p.totalSales || '\u2014');
    const avgDays = p.avgDaysToSell ? p.avgDaysToSell + ' Days' : '\u2014';

    const html = `
      <div style="font-family:inherit;">
        <div style="display:flex;gap:12px;margin-bottom:16px;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;flex:1;min-width:0;box-shadow:0 1px 3px rgba(0,0,0,.06);">
            <span style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:.05em;display:block;margin-bottom:8px;text-transform:none;">Total Volume</span>
            <span style="font-size:26px;font-weight:800;color:#0f172a;display:block;white-space:nowrap;">${displayTotalVolume}</span>
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;flex:1;min-width:0;box-shadow:0 1px 3px rgba(0,0,0,.06);">
            <span style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:.05em;display:block;margin-bottom:8px;text-transform:none;">Transactions</span>
            <span style="font-size:26px;font-weight:800;color:#2563eb;display:block;white-space:nowrap;">${displayTotalSales}</span>
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;flex:1;min-width:0;box-shadow:0 1px 3px rgba(0,0,0,.06);">
            <span style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:.05em;display:block;margin-bottom:8px;text-transform:none;">Avg Days to Sell</span>
            <span style="font-size:26px;font-weight:800;color:#0f172a;display:block;white-space:nowrap;">${avgDays}</span>
          </div>
        </div>
        ${p.avgDaysToSell ? `
        <div style="background:linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%);border:1px solid #ddd6fe;border-radius:12px;padding:20px 24px;"> 
          <div style="margin-bottom:12px;">
            <span style="font-size:28px;font-weight:800;color:#6d28d9;">${p.avgDaysToSell}</span>
            <span style="font-size:16px;font-weight:600;color:#7c3aed;margin-left:8px;">Days to Sell</span>
          </div>
          ${p.insightText ? `<p style="font-size:13px;color:#475569;line-height:1.6;margin:0 0 16px;">${p.insightText}</p>` : ''}
        </div>` : ''}
      </div>
    `;
    return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (type === 'table' && block.content?.type === 'tableContent') {
    const rows = (block.content.rows || []) as any[];
    return (
      <div key={i} className="overflow-x-auto mb-6">
        <table className="w-full text-left text-xs border-collapse">
          <tbody>
            {rows.map((row: any, ri: number) => (
              <tr key={ri} className="border-b border-slate-100">
                {row.cells.map((cell: any, ci: number) => (
                  <td key={ci} className="px-3 py-2">{Array.isArray(cell[0]) ? cell[0].join('') : cell[0]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // Fallback simple renderer
  return <div key={i} className="mb-4">{JSON.stringify(block)}</div>;
}

function QuarterlyKpiCard({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <span className="text-xs font-medium text-slate-500 block">{title}</span>
      <span className={`text-2xl font-bold ${color || "text-slate-900"} mt-1 block whitespace-nowrap`}>{value}</span>
    </div>
  );
}

function TrendRowMonthly({ row }: { row: TrendRow }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="px-3 py-2 font-semibold text-slate-900 border-r border-slate-200 bg-slate-50/50">{row.monthName}</td>
      {isNaN(row.currPrice) ? (
        <td colSpan={3} className="px-2 py-2 text-center text-slate-400 italic text-[10px] border-r border-slate-200 bg-slate-50/20">Low Vol. (Calculations Suppressed)</td>
      ) : (
        <>
          <td className="px-1.5 py-2 text-right font-bold text-slate-900">{formatCurrency(row.currPrice)}</td>
          <td className="px-1.5 py-2 text-right text-slate-500">{row.prevPrice === null ? "N/A" : formatCurrency(row.prevPrice)}</td>
          <td className={`px-1.5 py-2 text-right border-r border-slate-200 ${row.priceDiffPct.startsWith("-") ? "text-red-600" : row.priceDiffPct === "N/A" ? "text-slate-400" : "text-green-600"}`}>{row.priceDiffPct}</td>
        </>
      )}
      <td className="px-1.5 py-2 text-right font-bold text-slate-900">{row.currSales}</td>
      <td className="px-1.5 py-2 text-right text-slate-500">{row.prevSales}</td>
      <td className={`px-1.5 py-2 text-right border-r border-slate-200 ${row.salesDiffPct.startsWith("-") ? "text-red-600" : row.salesDiffPct === "N/A" ? "text-slate-400" : "text-green-600"}`}>{row.salesDiffPct}</td>
      <td className="px-1.5 py-2 text-right font-bold text-slate-900">
        {isNaN(row.currDays) ? "N/A" : row.currDays}
      </td>
      <td className="px-1.5 py-2 text-right text-slate-500">{row.prevDays === null ? "N/A" : row.prevDays}</td>
      <td className={`px-1.5 py-2 text-right ${row.daysDiff.startsWith("+") ? "text-red-600 font-bold" : row.daysDiff === "N/A" ? "text-slate-400" : "text-green-600 font-bold"}`}>{row.daysDiff}</td>
    </tr>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const metrics = loadMetrics(slug);

  if (!metrics) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Northcross Property Market Report</h1>
          <p className="text-slate-500 mt-1">{metrics.name} &middot; {metrics.periodText}</p>
        </div>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Quarterly Overview</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <QuarterlyKpiCard title="Total Volume" value={formatCurrency(metrics.totalVolume)} />
            <QuarterlyKpiCard title="Transactions / Sales Count" value={String(metrics.totalSales)} color="text-blue-600" />
            <QuarterlyKpiCard title="Avg Days to Sell" value={`${metrics.avgDaysToSell} Days`} />
          </div>

          <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-3">
              <span className="bg-indigo-100 text-indigo-900 font-bold text-xs px-3 py-1 rounded-full whitespace-nowrap">
                {metrics.avgDaysToSell} Days to Sell
              </span>
              <p className="text-sm text-slate-600 leading-relaxed">
                The average Days to Sell of {metrics.avgDaysToSell} days during {metrics.periodText} reflects healthy buyer interest
                and quick turnover for realistically priced family homes in the Northcross region.
              </p>
            </div>

            <div className="border-t border-slate-200/60 pt-4 mt-3">
              <span className="text-xs font-semibold text-slate-500 block mb-2">{metrics.compareLabel}</span>
              <div className="grid grid-cols-3 text-center gap-2">
                <div>
                  <span className="text-xs text-slate-500 block">Median Price</span>
                  <span className={`text-sm font-bold ${metrics.comparePriceUp ? "text-emerald-600" : "text-red-500"}`}>
                    {metrics.comparePriceUp ? "▲" : "▼"} {metrics.comparePriceChange}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Sales Count</span>
                  <span className={`text-sm font-bold ${metrics.compareSalesUp ? "text-emerald-600" : "text-red-500"}`}>
                    {metrics.compareSalesUp ? "▲" : "▼"} {metrics.compareSalesChange}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Days to Sell</span>
                  <span className={`text-sm font-bold ${metrics.compareDaysUp ? "text-emerald-600" : "text-red-500"}`}>
                    {metrics.compareDaysUp ? "▼" : "▲"} {metrics.compareDaysChange}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">Northcross Quarterly Data</h2>

          <div className="my-6 break-inside-avoid">
            <h2 className="text-xl font-bold text-slate-900 mb-4">季度数据</h2>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span className="text-xs font-medium text-slate-500 block">Total Volume</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block whitespace-nowrap">{formatCurrency(metrics.totalVolume)}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span className="text-xs font-medium text-slate-500 block">Transactions / Sales Count</span>
                <span className="text-2xl font-bold text-blue-600 mt-1 block whitespace-nowrap">{String(metrics.totalSales)}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span className="text-xs font-medium text-slate-500 block">Avg Days to Sell</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block whitespace-nowrap">{metrics.avgDaysToSell} Days</span>
              </div>
            </div>

            <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="bg-indigo-100 text-indigo-900 font-bold text-xs px-3 py-1 rounded-full whitespace-nowrap">
                  30 Days to Sell
                </span>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The average Days to Sell of 30 days during Q1 reflects healthy buyer interest and quick turnover for realistically priced family homes in the Northcross region.
                </p>
              </div>
              <div className="border-t border-slate-200/60 pt-4 mt-3">
                <span className="text-xs font-semibold text-slate-500 block mb-2">Compared to Previous Baseline</span>
                <div className="grid grid-cols-3 text-center gap-2">
                  <div>
                    <span className="text-xs text-slate-500 block">Median Price</span>
                    <span className="text-sm font-bold text-red-500">▼ -8.9%</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Sales Count</span>
                    <span className="text-sm font-bold text-emerald-600">▲ +28.6%</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Days to Sell</span>
                    <span className="text-sm font-bold text-emerald-600">▼ -5 Days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <h2 className="text-2xl font-bold text-slate-900">Northcross Region Trends</h2>
            <p className="text-slate-500 text-sm">Q1 2026 quarterly breakdown</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F1F5F9] text-slate-700 font-bold tracking-wider border-b border-slate-200">
                  <th className="px-3 py-2.5 border-r border-slate-200">Month</th>
                  <th colSpan={3} className="px-2 py-2.5 text-center border-r border-slate-200">Median Price</th>
                  <th colSpan={3} className="px-2 py-2.5 text-center border-r border-slate-200">Sales Count</th>
                  <th colSpan={3} className="px-2 py-2.5 text-center">Days to Sell</th>
                </tr>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] font-bold tracking-wider">
                  <th className="px-3 py-1.5 border-r border-slate-200">Period</th>
                  <th className="px-1.5 py-1.5 text-right">Current</th>
                  <th className="px-1.5 py-1.5 text-right">Previous</th>
                  <th className="px-1.5 py-1.5 text-right border-r border-slate-200">QoQ %</th>
                  <th className="px-1.5 py-1.5 text-right">Current</th>
                  <th className="px-1.5 py-1.5 text-right">Previous</th>
                  <th className="px-1.5 py-1.5 text-right border-r border-slate-200">QoQ %</th>
                  <th className="px-1.5 py-1.5 text-right">Current</th>
                  <th className="px-1.5 py-1.5 text-right">Previous</th>
                  <th className="px-1.5 py-1.5 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.trendRows.map((row: TrendRow, i: number) => (
                  <TrendRowMonthly key={i} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50/50 border-l-4 border-amber-500 p-4 rounded-r-xl space-y-2 mt-4">
            <h3 className="text-sm tracking-wider text-amber-800 font-bold">{metrics.anomalyTitle}</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{metrics.anomalyText}</p>
          </div>
        </section>

        <div className="text-center pt-4 border-t border-slate-200">
          <a
            href={`/reports/pdf/${slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors text-sm font-semibold"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Download PDF Report
          </a>
        </div>
      </div>
    </main>
  );
}
