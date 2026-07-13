'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SkeletonAnalytics } from '@/components/admin/Skeleton';
import MarketTrendsChart from '@/components/admin/MarketTrendsChart';
import ExcelUploadForm from '@/components/admin/ExcelUploadForm';
import MonthlyDataTable from '@/components/admin/MonthlyDataTable';
import { isSuperAdmin } from '@/lib/permissions';
import type { MonthlyDataPoint } from '@/lib/market-data-aggregator';
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

const FALLBACK_SUBURBS = ['Oteha', 'Northcross', 'Albany', 'Browns Bay', 'Torbay'];

type DataMode = 'monthly' | 'quarterly';

const SUBURB_COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

function getSuburbColor(index: number): string {
  return SUBURB_COLORS[index % SUBURB_COLORS.length];
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState({
    totalCost: 0, totalRevenue: 0, totalMailed: 0, totalDownloads: 0,
    totalAppraisals: 0, totalConversions: 0,
  });

  const [locationStats, setLocationStats] = useState<LocationRow[]>([]);
  const [regionStats, setRegionStats] = useState<RegionRow[]>([]);
  const [locationTotal, setLocationTotal] = useState(0);

  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [migrationMessage, setMigrationMessage] = useState('');

  const [selectedSuburbs, setSelectedSuburbs] = useState<string[]>(['Oteha']);
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [quarterlyData, setQuarterlyData] = useState<MonthlyDataPoint[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>('monthly');
  const [chartLoading, setChartLoading] = useState(false);
  const [chartNeedsMigration, setChartNeedsMigration] = useState(false);
  const [availableSuburbs, setAvailableSuburbs] = useState<string[]>(FALLBACK_SUBURBS);
  const [showDistrict, setShowDistrict] = useState(true);
  const [activeFocusSuburb, setActiveFocusSuburb] = useState<string>('Oteha');
  const [tableDataMode, setTableDataMode] = useState<DataMode>('monthly');

  const chartReqIdRef = React.useRef(0);

  const fetchAvailableSuburbs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics/available-suburbs');
      const data = await res.json();
      if (data.availableSuburbs && Array.isArray(data.availableSuburbs) && data.availableSuburbs.length > 0) {
        setAvailableSuburbs(data.availableSuburbs);
        setSelectedSuburbs(prev =>
          prev.filter(s => data.availableSuburbs.includes(s)).length > 0
            ? prev.filter(s => data.availableSuburbs.includes(s))
            : [data.availableSuburbs[0]]
        );
      }
    } catch {
      // fallback stays
    }
  }, []);

  useEffect(() => {
    if (availableSuburbs.length > 0) {
      setActiveFocusSuburb(prev =>
        prev !== 'North Shore City' && !availableSuburbs.includes(prev) ? availableSuburbs[0] : prev
      );
    }
  }, [availableSuburbs]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && !isSuperAdmin(session.user.email)) {
      router.push('/admin/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && isSuperAdmin(session.user.email)) {
      fetchAvailableSuburbs();
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

  const fetchChartData = useCallback(async (suburbs: string[]) => {
    const reqId = ++chartReqIdRef.current;
    setChartLoading(true);
    setChartNeedsMigration(false);
    try {
      const res = await fetch(`/api/admin/analytics/chart-data?suburbs=${suburbs.map(encodeURIComponent).join(',')}&district=North Shore City`);
      const data = await res.json();
      if (reqId !== chartReqIdRef.current) return;
      if (data.needsMigration) {
        setChartNeedsMigration(true);
      } else if (data.success) {
        setMonthlyData(data.data.monthlyData ?? []);
        setQuarterlyData(data.data.quarterlyData ?? []);
      }
    } catch {
    } finally {
      if (reqId === chartReqIdRef.current) {
        setChartLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && isSuperAdmin(session.user.email)) {
      fetchChartData(selectedSuburbs);
    }
  }, [status, session, selectedSuburbs, fetchChartData]);

  const toggleSuburb = (s: string) => {
    setSelectedSuburbs(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
    setActiveFocusSuburb(s);
  };

  useEffect(() => {
    setActiveFocusSuburb(prev => {
      if (selectedSuburbs.length > 0 && !selectedSuburbs.includes(prev)) {
        return selectedSuburbs[0];
      }
      if (selectedSuburbs.length === 0) {
        return 'North Shore City';
      }
      return prev;
    });
  }, [selectedSuburbs]);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900">REINZ Market Trends</h2>
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
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
          {availableSuburbs.map((s, i) => {
            const active = selectedSuburbs.includes(s);
            const color = getSuburbColor(i);
            return (
              <button
                key={s}
                onClick={() => toggleSuburb(s)}
                className={`text-sm font-medium rounded-full px-3 py-1.5 border transition-all ${
                  active
                    ? 'text-white shadow-sm'
                    : 'text-gray-600 border-gray-300 hover:border-gray-400 bg-white'
                }`}
                style={active ? { backgroundColor: color, borderColor: color } : undefined}
              >
                {s}
              </button>
            );
          })}
          </div>
          <button
            onClick={() => setShowDistrict(v => !v)}
            className={`text-sm font-medium rounded-full px-3 py-1.5 border transition-all ${
              showDistrict
                ? 'bg-[#94A3B8] text-white border-[#94A3B8] shadow-sm'
                : 'text-gray-500 border-gray-300 hover:border-gray-400 bg-white'
            }`}
          >
            North Shore {showDistrict ? '✓' : ''}
          </button>
        </div>
        {(() => {
          const activeData = dataMode === 'monthly' ? monthlyData : quarterlyData;
          if (chartNeedsMigration) {
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-center justify-center h-[200px]">
                <div className="text-center">
                  <p className="text-lg font-semibold text-amber-800 mb-2">Table Not Found</p>
                  <p className="text-sm text-amber-700">The market data table has not been created yet.</p>
                  <p className="text-sm text-amber-700">Click <strong>&ldquo;Run Migrations&rdquo;</strong> at the top of this page, then upload a REINZ Excel file.</p>
                </div>
              </div>
            );
          }
          if (chartLoading && activeData.length === 0) {
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-[400px]">
                <div className="text-gray-400">Loading chart data...</div>
              </div>
            );
          }
          if (activeData.length === 0) {
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-[200px]">
                <div className="text-center text-gray-400">
                  <p className="text-lg mb-2">No market data yet</p>
                  <p className="text-sm">Upload a REINZ Excel file below to get started</p>
                </div>
              </div>
            );
          }
          return (
            <div className="relative">
              <MarketTrendsChart
                data={activeData}
                suburbs={selectedSuburbs}
                district="North Shore City"
                mode={dataMode}
                suburbColors={Object.fromEntries(selectedSuburbs.map(s => [s, getSuburbColor(availableSuburbs.indexOf(s))]))}
                showDistrict={showDistrict}
              />
              {chartLoading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl z-10">
                  <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                    <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Market Data Table */}
      <MonthlyDataTable
        monthlyData={monthlyData}
        dataMode={tableDataMode}
        onModeChange={setTableDataMode}
        activeFocusSuburb={activeFocusSuburb}
        availableSuburbs={availableSuburbs}
        onFocusChange={(suburb) => {
          setActiveFocusSuburb(suburb);
          if (suburb !== 'North Shore City' && !selectedSuburbs.includes(suburb)) {
            setSelectedSuburbs(prev => [...prev, suburb]);
          }
        }}
      />

      {/* Excel Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExcelUploadForm onSuccess={(suburb) => {
          if (suburb && !selectedSuburbs.includes(suburb)) {
            setSelectedSuburbs(prev => [...prev, suburb]);
          } else if (suburb) {
            fetchChartData(selectedSuburbs);
          }
          fetchAvailableSuburbs();
        }} />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Guide</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>1. Export REINZ data for a suburb (e.g., Torbay)</p>
            <p>2. Upload the .xlsx or .csv file using the form</p>
            <p>3. Table is auto-created if needed, data is imported</p>
            <p>4. Chart refreshes automatically with the uploaded data</p>
            <p>5. Click suburb buttons to compare multiple suburbs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
