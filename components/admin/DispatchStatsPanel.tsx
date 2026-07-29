'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';

interface Summary {
  pending_count: number;
  sent_count: number;
  interacted_count: number;
  converted_count: number;
  no_junk_mail_count: number;
  total_scans_pv: number;
  total_scans_uv: number;
}

interface DailySend {
  date: string;
  total_sent: number;
  no_junk_sent?: number;
}

interface DailyScan {
  date: string;
  pv: number;
  uv: number;
}

interface CampaignStats {
  campaign: string;
  summary: Summary;
  daily_sends: DailySend[];
  daily_scans: DailyScan[];
}

const SUMMARY_CARDS = [
  { key: 'pending_count', label: 'Pending', icon: '📬', color: 'text-amber-600' },
  { key: 'sent_count', label: 'Sent', icon: '✅', color: 'text-blue-600' },
  { key: 'no_junk_mail_count', label: 'No Junk Mail', icon: '🚫', color: 'text-orange-600' },
  { key: 'total_scans_pv', label: 'QR Scans (PV/UV)', icon: '👁', color: 'text-indigo-600' },
  { key: 'interacted_count', label: 'Interacted', icon: '💬', color: 'text-purple-600' },
  { key: 'converted_count', label: 'Converted', icon: '🎯', color: 'text-green-600' },
] as const;

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });
}

function SummaryCards({ summary }: { summary: Summary }) {
  const totalScans = `${summary.total_scans_pv} / ${summary.total_scans_uv}`;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {SUMMARY_CARDS.map(({ key, label, icon, color }) => (
        <div key={key} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{icon}</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
          </div>
          <p className={`text-2xl font-bold ${color}`}>
            {key === 'total_scans_pv' ? totalScans : summary[key]}
          </p>
        </div>
      ))}
    </div>
  );
}

const PIE_COLORS = ['#2563EB', '#F59E0B', '#DC2626'];

function PieChartLegend({ pieData, total }: { pieData: { name: string; value: number }[]; total: number }) {
  return (
    <div className="space-y-2 text-sm">
      {pieData.map((d, idx) => {
        const pct = ((d.value / total) * 100).toFixed(1);
        return (
          <div key={d.name} className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
            <span className="font-medium text-slate-700 w-28">{d.name}</span>
            <span className="text-slate-500">{d.value} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

function CampaignOverview({ summary }: { summary: Summary }) {
  const total = summary.pending_count + summary.sent_count + summary.no_junk_mail_count;
  if (total === 0) return null;

  const pieData = [
    { name: 'Sent', value: summary.sent_count },
    { name: 'Pending', value: summary.pending_count },
    { name: 'No Junk Mail', value: summary.no_junk_mail_count },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Campaign Overview</h3>
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="shrink-0">
          <ResponsiveContainer width={220} height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                {pieData.map((entry, idx) => (
                  <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <PieChartLegend pieData={pieData} total={total} />
      </div>
    </div>
  );
}

function DailySendChart({ data, noJunkTotal }: { data: DailySend[]; noJunkTotal: number }) {
  if (data.length === 0 && noJunkTotal === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Daily Dispatch Volume</h3>
        <p className="text-sm text-slate-400">No dispatch data for this campaign.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Daily Dispatch Volume</h3>
        {noJunkTotal > 0 && (
          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
            No Junk Mail: {noJunkTotal}
          </span>
        )}
      </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDateLabel} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => formatDateLabel(String(v))} />
              <Legend />
              <Bar dataKey="total_sent" name="Total Sent" fill="#2563EB" radius={[4, 4, 0, 0]} />
              {noJunkTotal > 0 && (
                <Bar dataKey="no_junk_sent" name="No Junk Mail" fill="#DC2626" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
    </div>
  );
}

function ScanTrendChart({ data }: { data: DailyScan[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">QR Code Scan Trend</h3>
        <p className="text-sm text-slate-400">Awaiting first QR scan for this campaign.</p>
      </div>
    );
  }

  const totalPv = data.reduce((s, d) => s + d.pv, 0);
  const totalUv = data.reduce((s, d) => s + d.uv, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">QR Code Scan Trend</h3>
        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
          PV: {totalPv} / UV: {totalUv}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDateLabel} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={(v) => formatDateLabel(String(v))} />
          <Legend />
          <Line type="monotone" dataKey="pv" name="Total Scans (PV)" stroke="#2563EB" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="uv" name="Unique Visitors (UV)" stroke="#16A34A" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DispatchStatsPanel() {
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoadingCampaigns(true);
      try {
        const res = await fetch('/api/admin/outreach/campaign-stats');
        if (res.ok) {
          const data = await res.json();
          const list: string[] = data.available_campaigns || [];
          setCampaigns(list);
          if (list.length > 0) {
            setSelectedCampaign(list[0]);
          }
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || `Failed to load campaigns (${res.status})`);
        }
      } catch {
        setError('Failed to load campaigns');
      } finally {
        setLoadingCampaigns(false);
      }
    };
    fetchCampaigns();
  }, []);

  const fetchStats = useCallback(async (campaign: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ campaign });
      const res = await fetch(`/api/admin/outreach/campaign-stats?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch');
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      fetchStats(selectedCampaign);
    }
  }, [selectedCampaign, fetchStats]);

  return (
    <div className="space-y-6">
      {loadingCampaigns ? (
        <>
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse w-64" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="h-4 bg-slate-100 rounded w-16 mb-2 animate-pulse" />
                <div className="h-7 bg-slate-100 rounded w-12 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
        </>
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-semibold text-slate-700">Campaign:</label>
            {campaigns.length === 0 ? (
              <span className="text-sm text-slate-400">No campaign data available.</span>
            ) : (
              <select
                value={selectedCampaign}
                onChange={(e) => { setSelectedCampaign(e.target.value); setStats(null); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {campaigns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {loading && !stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <div className="h-4 bg-slate-100 rounded w-16 mb-2 animate-pulse" />
                    <div className="h-7 bg-slate-100 rounded w-12 animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
            </div>
          )}

          {!loading && !stats && !error && campaigns.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Select a campaign to view dispatch statistics.
            </div>
          )}

          {stats && (
            <>
              <SummaryCards summary={stats.summary} />
              <CampaignOverview summary={stats.summary} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DailySendChart data={stats.daily_sends} noJunkTotal={stats.summary.no_junk_mail_count} />
                <ScanTrendChart data={stats.daily_scans} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
