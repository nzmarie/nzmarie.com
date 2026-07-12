'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SkeletonAnalytics } from '@/components/admin/Skeleton';
import MarketTrendsChart from '@/components/admin/MarketTrendsChart';
import ExcelUploadForm from '@/components/admin/ExcelUploadForm';
import { isSuperAdmin } from '@/lib/permissions';
const CARD_BADGE_STYLES = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  yellow: 'bg-yellow-100 text-yellow-700',
} as const;

type LocationRow = {
  region: string;
  city: string;
  count: number;
};

type RegionRow = {
  region: string;
  count: number;
};

interface ChartQuarter {
  period: string;
  suburbMedian: number | null;
  suburbSales: number;
  suburbDays: number | null;
  cityMedian: number | null;
  citySales: number;
  cityDays: number | null;
}

const FALLBACK_SUBURBS = ['Oteha', 'Northcross', 'Albany', 'Browns Bay', 'Torbay'];

type DataMode = 'monthly' | 'quarterly';

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState({
    totalCost: 0,
    totalRevenue: 0,
    totalMailed: 0,
    totalDownloads: 0,
    totalAppraisals: 0,
    totalConversions: 0,
  });

  const [locationStats, setLocationStats] = useState<LocationRow[]>([]);
  const [regionStats, setRegionStats] = useState<RegionRow[]>([]);
  const [locationTotal, setLocationTotal] = useState(0);

  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [migrationMessage, setMigrationMessage] = useState('');

  const [selectedSuburb, setSelectedSuburb] = useState('Oteha');
  const [quarterlyData, setQuarterlyData] = useState<ChartQuarter[]>([]);
  const [monthlyData, setMonthlyData] = useState<ChartQuarter[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>('monthly');
  const [chartLoading, setChartLoading] = useState(false);
  const [chartNeedsMigration, setChartNeedsMigration] = useState(false);
  const [availableSuburbs, setAvailableSuburbs] = useState<string[]>(FALLBACK_SUBURBS);

  // Fetch available suburbs from the database — runs on mount and after upload
  const fetchAvailableSuburbs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics/chart-data?suburb=_none_&district=_none_');
      const data = await res.json();
      if (data.availableSuburbs && Array.isArray(data.availableSuburbs) && data.availableSuburbs.length > 0) {
        setAvailableSuburbs(data.availableSuburbs);
        // If current selection isn't in the list, switch to first available
        setSelectedSuburb(prev => data.availableSuburbs.includes(prev) ? prev : data.availableSuburbs[0]);
      }
    } catch {
      // fallback stays
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && !isSuperAdmin(session.user.email)) {
      router.push('/admin/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && isSuperAdmin(session.user.email)) {
      fetchAvailableSuburbs();
      // Fetch overview stats
      fetch('/api/admin/analytics/overview')
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setStats({
              totalCost: data.total_cost ?? 0,
              totalRevenue: data.total_revenue ?? 0,
              totalMailed: data.total_mailed ?? 0,
              totalDownloads: data.total_downloads ?? 0,
              totalAppraisals: data.total_appraisals ?? 0,
              totalConversions: data.total_conversions ?? 0,
            });
          }
        })
        .catch(() => undefined);

      // Fetch location breakdown stats
      fetch('/api/admin/analytics/location')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.locations) {
            setLocationStats(data.locations);
            setRegionStats(data.regions ?? []);
            setLocationTotal(data.total ?? 0);
          }
        })
        .catch(() => undefined);
    }
  }, [status, session, fetchAvailableSuburbs]);

  // Compute quarterly from monthly: requires all 3 months in a quarter to display
  const computeQuarterly = useCallback((monthly: ChartQuarter[]): ChartQuarter[] => {
    const groups = new Map<string, ChartQuarter[]>();
    for (const m of monthly) {
      const [y, mo] = m.period.split('-');
      const q = Math.ceil(parseInt(mo) / 3);
      const key = `${y}-Q${q}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    const result: ChartQuarter[] = [];
    for (const [key, items] of groups) {
      if (items.length < 3) continue; // skip incomplete quarters
      const avg = (key: 'suburbMedian' | 'suburbDays' | 'cityMedian' | 'cityDays') => {
        const vals = items.map(i => i[key]).filter((v): v is number => v !== null);
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      };
      result.push({
        period: key,
        suburbMedian: avg('suburbMedian'),
        suburbSales: items.reduce((s, i) => s + i.suburbSales, 0),
        suburbDays: avg('suburbDays'),
        cityMedian: avg('cityMedian'),
        citySales: items.reduce((s, i) => s + i.citySales, 0),
        cityDays: avg('cityDays'),
      });
    }
    return result.sort((a, b) => a.period.localeCompare(b.period));
  }, []);

  const fetchChartData = useCallback(async (suburb: string) => {
    setChartLoading(true);
    setChartNeedsMigration(false);
    try {
      const res = await fetch(`/api/admin/analytics/chart-data?suburb=${encodeURIComponent(suburb)}&district=North Shore City`);
      const data = await res.json();
      if (data.needsMigration) {
        setChartNeedsMigration(true);
      } else if (data.success) {
        const monthly = data.data.monthlyData ?? [];
        setMonthlyData(monthly);
        setQuarterlyData(computeQuarterly(monthly));
      }
    } catch {
    } finally {
      setChartLoading(false);
    }
  }, [computeQuarterly]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && isSuperAdmin(session.user.email)) {
      fetchChartData(selectedSuburb);
    }
  }, [status, session, selectedSuburb, fetchChartData]);

  const runMigration = async () => {
    setMigrationStatus('running');
    setMigrationMessage('');
    try {
      const res = await fetch('/api/admin/migrate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMigrationStatus('success');
        const msgs = (data.results as { migration: string; status: string; message: string }[])
          .map(r => `${r.migration}: ${r.message}`)
          .join('\n');
        setMigrationMessage(msgs || 'Migration completed successfully');
      } else {
        setMigrationStatus('error');
        setMigrationMessage(data.error || 'Unknown error');
      }
    } catch {
      setMigrationStatus('error');
      setMigrationMessage('Network failure');
    }
  };

  // Show skeleton while session resolves — Navbar stays visible
  if (status === 'loading') {
    return <SkeletonAnalytics />;
  }

  if (!session || (session.user?.email && !isSuperAdmin(session.user.email))) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">This page is only available to super administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">
          Campaign performance, ROI tracking, and conversion funnels
        </p>
      </div>

      {/* DB Migration Panel — super admin only */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-amber-800">🛠 Database Migrations</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              Run pending migrations to add new columns (e.g., region &amp; city to appraisal_leads).
            </p>
            {migrationMessage && (
              <pre className="text-xs text-amber-900 mt-1 whitespace-pre-wrap">{migrationMessage}</pre>
            )}
          </div>
          <button
            onClick={runMigration}
            disabled={migrationStatus === 'running'}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              migrationStatus === 'success'
                ? 'bg-green-600 text-white cursor-default'
                : migrationStatus === 'error'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60'
            }`}
          >
            {migrationStatus === 'running' ? '⏳ Running...'
              : migrationStatus === 'success' ? '✅ Done'
              : migrationStatus === 'error' ? '❌ Retry'
              : 'Run Migrations'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Campaigns', value: stats.totalMailed.toString(), icon: '📬', color: 'blue' as const },
          { label: 'Download Rate', value: `${stats.totalMailed > 0 ? ((stats.totalDownloads / stats.totalMailed) * 100).toFixed(0) : 0}%`, icon: '📥', color: 'green' as const },
          { label: 'Conversion Rate', value: `${stats.totalAppraisals > 0 ? ((stats.totalConversions / stats.totalAppraisals) * 100).toFixed(0) : 0}%`, icon: '✅', color: 'purple' as const },
          { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString('en-NZ')}`, icon: '💰', color: 'yellow' as const },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${CARD_BADGE_STYLES[stat.color]}`}>
                This Month
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Mail sent</span><span>{stats.totalMailed}</span></div>
            <div className="flex justify-between text-sm"><span>Downloads</span><span>{stats.totalDownloads}</span></div>
            <div className="flex justify-between text-sm"><span>Appraisals</span><span>{stats.totalAppraisals}</span></div>
            <div className="flex justify-between text-sm"><span>Conversions</span><span>{stats.totalConversions}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ROI Snapshot</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Revenue</span><span>${stats.totalRevenue.toLocaleString('en-NZ')}</span></div>
            <div className="flex justify-between text-sm"><span>Cost</span><span>${stats.totalCost.toLocaleString('en-NZ')}</span></div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Net</span>
              <span>${(stats.totalRevenue - stats.totalCost).toLocaleString('en-NZ')}</span>
            </div>
          </div>
        </div>
      </div>

      {locationStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 Geographic Distribution</h3>
          <p className="text-sm text-gray-500 mb-4">Appraisal requests grouped by region and city with share of total leads</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {regionStats.map((region) => {
              const percent = locationTotal > 0 ? Math.round((region.count / locationTotal) * 100) : 0;
              return (
                <div key={region.region} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Region</div>
                      <div className="text-sm font-semibold text-slate-900">{region.region}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{region.count}</div>
                      <div className="text-xs text-slate-400">{percent}%</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locationStats.slice(0, 9).map((loc) => {
              const percent = locationTotal > 0 ? Math.round((loc.count / locationTotal) * 100) : 0;
              return (
                <div key={`${loc.region}-${loc.city}`} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-800">{loc.region}</div>
                      <div className="text-xs text-slate-500">{loc.city}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{loc.count}</div>
                      <div className="text-xs text-slate-400">{percent}%</div>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Market Trends Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">REINZ Market Trends</h2>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setDataMode('monthly')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dataMode === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >Monthly</button>
              <button
                onClick={() => setDataMode('quarterly')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dataMode === 'quarterly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >Quarterly</button>
            </div>
            <label className="text-sm text-gray-600">Suburb:</label>
            <select
              value={selectedSuburb}
              onChange={(e) => setSelectedSuburb(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              {availableSuburbs.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        {(() => {
          const activeData = dataMode === 'monthly' ? monthlyData : quarterlyData;
          return chartLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-[400px]">
              <div className="text-gray-400">Loading chart data...</div>
            </div>
          ) : chartNeedsMigration ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-center justify-center h-[200px]">
              <div className="text-center">
                <p className="text-lg font-semibold text-amber-800 mb-2">Table Not Found</p>
                <p className="text-sm text-amber-700">The market data table has not been created yet.</p>
                <p className="text-sm text-amber-700">Click <strong>&ldquo;Run Migrations&rdquo;</strong> at the top of this page, then upload a REINZ Excel file.</p>
              </div>
            </div>
          ) : activeData.length > 0 ? (
            <MarketTrendsChart data={activeData} suburb={selectedSuburb} district="North Shore City" mode={dataMode} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-[200px]">
              <div className="text-center text-gray-400">
                <p className="text-lg mb-2">No market data yet</p>
                <p className="text-sm">Upload a REINZ Excel file below to get started</p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Market Data Table */}
      {(() => {
        const activeData = dataMode === 'monthly' ? monthlyData : quarterlyData;
        return activeData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{dataMode === 'monthly' ? 'Monthly' : 'Quarterly'} Data</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Period</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">{selectedSuburb} Median</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">North Shore City Median</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">{selectedSuburb} Sales</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Avg Days</th>
                  </tr>
                </thead>
                <tbody>
                  {activeData.map((row) => (
                    <tr key={row.period} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{row.period}</td>
                      <td className="text-right py-2 px-3">{row.suburbMedian ? `$${row.suburbMedian.toLocaleString()}` : 'N/A'}</td>
                      <td className="text-right py-2 px-3">{row.cityMedian ? `$${row.cityMedian.toLocaleString()}` : 'N/A'}</td>
                      <td className="text-right py-2 px-3">{row.suburbSales}</td>
                      <td className="text-right py-2 px-3">{row.suburbDays ?? 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Excel Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExcelUploadForm onSuccess={(suburb) => {
          if (suburb) setSelectedSuburb(suburb);
          fetchChartData(suburb || selectedSuburb);
          fetchAvailableSuburbs();
        }} />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Guide</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>1. Export REINZ data for a suburb (e.g., Torbay)</p>
            <p>2. Upload the .xlsx or .csv file using the form</p>
            <p>3. Table is auto-created if needed, data is imported</p>
            <p>4. Chart refreshes automatically with the uploaded data</p>
            <p>5. Use the data table for detailed quarterly breakdown</p>
          </div>
        </div>
      </div>
    </div>
  );
}
