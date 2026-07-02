'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SkeletonAnalytics } from '@/components/admin/Skeleton';

const SUPER_ADMIN = 'nzlouis.com@gmail.com';

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

  const [locationStats, setLocationStats] = useState<{
    region: string;
    city: string;
    count: number;
  }[]>([]);

  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [migrationMessage, setMigrationMessage] = useState('');

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email !== SUPER_ADMIN) {
      router.push('/admin/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email === SUPER_ADMIN) {
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
          }
        })
        .catch(() => undefined);
    }
  }, [status, session]);

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

  if (!session || session.user?.email !== SUPER_ADMIN) {
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
          { label: 'Total Campaigns', value: stats.totalMailed.toString(), icon: '📬', color: 'blue' },
          { label: 'Download Rate', value: `${stats.totalMailed > 0 ? ((stats.totalDownloads / stats.totalMailed) * 100).toFixed(0) : 0}%`, icon: '📥', color: 'green' },
          { label: 'Conversion Rate', value: `${stats.totalAppraisals > 0 ? ((stats.totalConversions / stats.totalAppraisals) * 100).toFixed(0) : 0}%`, icon: '✅', color: 'purple' },
          { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString('en-NZ')}`, icon: '💰', color: 'yellow' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`text-xs font-medium px-2 py-1 rounded-full bg-${stat.color}-100 text-${stat.color}-700`}>
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
          <p className="text-sm text-gray-500 mb-4">Appraisal requests by region and city</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locationStats.slice(0, 9).map((loc, idx) => (
              <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800">{loc.region}</div>
                    <div className="text-xs text-slate-500">{loc.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{loc.count}</div>
                    <div className="text-xs text-slate-400">leads</div>
                  </div>
                </div>
                <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (loc.count / Math.max(...locationStats.map(l => l.count))) * 100)}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <svg className="h-5 w-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Under Development</h3>
            <p className="mt-2 text-sm text-blue-700">
              Full analytics dashboard with real-time metrics, campaign comparison, and detailed ROI
              calculations is being implemented.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
