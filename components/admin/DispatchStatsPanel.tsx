'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, PieChart, Pie, Cell,
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
  business_card_summary: { pv: number; uv: number };
  business_card_daily_scans: DailyScan[];
}

const SUMMARY_CARDS = [
  { key: 'pending_count', label: 'Pending', icon: '📬', color: 'text-amber-600' },
  { key: 'sent_count', label: 'Sent', icon: '✅', color: 'text-blue-600' },
  { key: 'no_junk_mail_count', label: 'No Junk Mail', icon: '🚫', color: 'text-orange-600' },
  { key: 'total_scans_pv', label: 'QR Scans (PV/UV)', icon: '👁', color: 'text-indigo-600' },
  { key: 'biz_pv', label: 'Business Card 🪪', icon: '🪪', color: 'text-indigo-600' },
  { key: 'interacted_count', label: 'Interacted', icon: '💬', color: 'text-purple-600' },
  { key: 'converted_count', label: 'Converted', icon: '🎯', color: 'text-green-600' },
] as const;

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });
}

function SummaryCards({ summary, bizPv, bizUv }: { summary: Summary; bizPv: number; bizUv: number }) {
  const totalScans = `${summary.total_scans_pv} / ${summary.total_scans_uv}`;
  const bizScans = `${bizPv} / ${bizUv}`;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
      {SUMMARY_CARDS.map(({ key, label, icon, color }) => {
        let value: string | number;
        if (key === 'total_scans_pv') {
          value = totalScans;
        } else if (key === 'biz_pv') {
          value = bizScans;
        } else {
          value = summary[key as keyof Summary];
        }
        return (
          <div key={key} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{icon}</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        );
      })}
    </div>
  );
}

const PIE_COLORS = ['#16A34A', '#DC2626', '#F59E0B'];

function PieChartLegend({ pieData, total }: { pieData: { name: string; value: number }[]; total: number }) {
  return (
    <div className="space-y-2 text-sm">
      {pieData.map((d, idx) => {
        const pct = ((d.value / total) * 100).toFixed(1);
        return (
          <div key={d.name} className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
            <span className="font-medium text-slate-700 w-32">{d.name}</span>
            <span className="text-slate-500">{d.value} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

function CampaignOverview({ summary }: { summary: Summary }) {
  const total = summary.pending_count;
  if (total === 0) return null;

  const remaining = summary.pending_count - summary.sent_count - summary.no_junk_mail_count;

  const pieData = [
    { name: 'Sent', value: summary.sent_count },
    { name: 'No Junk Mail', value: summary.no_junk_mail_count },
    { name: 'Remaining', value: remaining },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Campaign Overview — {total} Addresses</h3>
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
          <Legend formatter={(value) => {
            let color = '#1e293b';
            let weight = 600;
            if (value.includes('Total Scans')) {
              color = '#064E3B';
              weight = 700;
            } else if (value.includes('Business Card Unique')) {
              color = '#1e3a5f';
              weight = 600;
            } else if (value.includes('Oteha Unique')) {
              color = '#14532D';
              weight = 600;
            }
            return <span style={{ color, fontWeight: weight, fontSize: '0.875rem' }}>{value}</span>;
          }} />
              <Bar dataKey="total_sent" name="Total Sent" fill="#2563EB" radius={[4, 4, 0, 0]} />
              {noJunkTotal > 0 && (
                <Bar dataKey="no_junk_sent" name="No Junk Mail" fill="#DC2626" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
    </div>
  );
}

// ─── Scan Logs ────────────────────────────────────────────────────────────────

interface ScanLog {
  id: string;
  campaign_key: string;
  visitor_hash: string;
  ip_address: string;
  user_agent: string;
  device_type: string;
  referrer: string;
  is_unique: boolean;
  created_at: string;
}

interface ScanLogCampaign {
  campaign_key: string;
  campaign_name: string;
  total_pv: number;
  total_uv: number;
}

function CampaignScanLogsPanel() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [open, setOpen] = useState(true);

  const limit = 20;

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['scanLogs'],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: String(limit) });
      const res = await fetch(`/api/admin/analytics/scans?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load scan logs');
      return json;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const page = lastPage.page ?? 1;
      const limitVal = lastPage.limit ?? limit;
      const total = lastPage.total_logs ?? 0;
      const fetchedSoFar = page * limitVal;
      return fetchedSoFar < total ? page + 1 : undefined;
    },
  });

  const campaigns: ScanLogCampaign[] = data?.pages?.[0]?.campaigns || [];
  const totalScans = data?.pages?.[0]?.total_scans ?? 0;
  const allLogs = data ? data.pages.flatMap((p) => p.logs || []) : [];

  const filteredLogs = allLogs.filter((l: ScanLog) => {
    const matchCampaign = selectedCampaign === 'all' || l.campaign_key === selectedCampaign;
    const matchDate = !dateFilter || new Date(l.created_at).toISOString().split('T')[0] === dateFilter;
    return matchCampaign && matchDate;
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasNextPage || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      });
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm transition-all duration-200">
      <button
        type="button"
        onClick={() => {
          if (!open) setDateFilter('');
          setOpen((v) => !v);
        }}
        className="w-full flex items-center justify-between px-6 py-4 text-left focus:outline-none"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-700">QR Code Scan Logs</h3>
          <p className="text-xs text-slate-400 mt-0.5">Detailed record of direct mail visitor scans</p>
        </div>
        <span className="text-slate-400 text-xs font-medium">
          {open ? '▲ Hide' : '▼ Show'}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCampaign('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedCampaign === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Campaigns ({totalScans})
            </button>
            {campaigns.map((c) => (
              <button
                key={c.campaign_key}
                type="button"
                onClick={() => setSelectedCampaign(c.campaign_key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCampaign === c.campaign_key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {c.campaign_name || c.campaign_key} ({c.total_pv})
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="p-6 min-h-[300px]">
            {isLoading && allLogs.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : isError && allLogs.length === 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                Failed to load scan logs
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No scan logs recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" data-testid="scan-logs-table">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Campaign</th>
                      <th className="py-3 px-4">Visitor Fingerprint</th>
                      <th className="py-3 px-4">Device &amp; IP</th>
                      <th className="py-3 px-4">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 select-text">
                          {new Date(log.created_at).toLocaleString('en-NZ')}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded">
                            {log.campaign_key
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500 select-text">
                          {log.visitor_hash
                            ? `${log.visitor_hash.substring(0, 12)}...`
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div>{log.ip_address || 'Unknown IP'}</div>
                          <div
                            className="text-slate-400 truncate max-w-[200px] select-text"
                            title={log.user_agent}
                          >
                            {log.device_type ? `${log.device_type} · ` : ''}
                            {log.user_agent || 'Unknown UA'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {log.is_unique ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Unique
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                              Repeat
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hasNextPage && <div ref={sentinelRef} />}
                {isFetchingNextPage && (
                  <div className="pt-4 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Combined Scan Chart ──────────────────────────────────────────────────────

interface CombinedScan {
  date: string;
  campaign_pv: number;
  campaign_uv: number;
  campaign_repeat: number;
  biz_pv: number;
  biz_uv: number;
  biz_repeat: number;
}

function mergeScanData(campaign: DailyScan[], bizCard: DailyScan[]): CombinedScan[] {
  const allDates = new Set([...campaign.map(d => d.date), ...bizCard.map(d => d.date)]);
  return [...allDates].sort().map(date => {
    const campaignPv = campaign.find(d => d.date === date)?.pv ?? 0;
    const campaignUv = campaign.find(d => d.date === date)?.uv ?? 0;
    const bizPv = bizCard.find(d => d.date === date)?.pv ?? 0;
    const bizUv = bizCard.find(d => d.date === date)?.uv ?? 0;
    return {
      date,
      campaign_pv: campaignPv,
      campaign_uv: campaignUv,
      campaign_repeat: Math.max(0, campaignPv - campaignUv),
      biz_pv: bizPv,
      biz_uv: bizUv,
      biz_repeat: Math.max(0, bizPv - bizUv),
    };
  });
}

function CombinedScanChart({ campaignScans, bizCardScans, campaignName = 'Campaign' }: { campaignScans: DailyScan[]; bizCardScans: DailyScan[]; campaignName?: string }) {
  const data = mergeScanData(campaignScans, bizCardScans);
  const displayCampaignName = campaignName
    ? campaignName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Campaign';

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">QR Code Scan Trend</h3>
        <p className="text-sm text-slate-400">Awaiting first QR scan.</p>
      </div>
    );
  }

  const totalCampaignPv = data.reduce((s, d) => s + d.campaign_pv, 0);
  const totalCampaignUv = data.reduce((s, d) => s + d.campaign_uv, 0);
  const totalBizPv = data.reduce((s, d) => s + d.biz_pv, 0);
  const totalBizUv = data.reduce((s, d) => s + d.biz_uv, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">QR Code Scan Trend</h3>
        <div className="flex gap-3 text-xs">
          <span className="font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
            {displayCampaignName}: {totalCampaignPv} / {totalCampaignUv}
          </span>
          <span className="font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            Business Card: {totalBizPv} / {totalBizUv}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDateLabel} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            content={({ active, label }) => {
              if (!active || !label) return null;
              const row = data.find((d) => d.date === label);
              if (!row) return null;
              return (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{formatDateLabel(String(label))}</p>
                  {(row.campaign_pv > 0 || row.campaign_uv > 0) && (
                    <div style={{ marginBottom: 6 }}>
                      <p style={{ color: '#16a34a', fontWeight: 700 }}>
                        {displayCampaignName} Total Scans (PV): {row.campaign_pv}
                      </p>
                      <p style={{ color: '#14532d', fontWeight: 600, paddingLeft: 8 }}>
                        └ Unique Visitors (UV): {row.campaign_uv}
                      </p>
                      {row.campaign_repeat > 0 && (
                        <p style={{ color: '#16a34a', fontWeight: 500, paddingLeft: 8, opacity: 0.85 }}>
                          └ Repeat Scans: {row.campaign_repeat}
                        </p>
                      )}
                    </div>
                  )}
                  {(row.biz_pv > 0 || row.biz_uv > 0) && (
                    <div>
                      <p style={{ color: '#2563eb', fontWeight: 700 }}>
                        Business Card Total Scans (PV): {row.biz_pv}
                      </p>
                      <p style={{ color: '#1d4ed8', fontWeight: 600, paddingLeft: 8 }}>
                        └ Unique Visitors (UV): {row.biz_uv}
                      </p>
                      {row.biz_repeat > 0 && (
                        <p style={{ color: '#2563eb', fontWeight: 500, paddingLeft: 8, opacity: 0.85 }}>
                          └ Repeat Scans: {row.biz_repeat}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Legend formatter={(value) => {
            const colorMap: Record<string, string> = {
              'Business Card Repeat Scans': '#6366f1',
              'Business Card Unique Visitors': '#1d4ed8',
              [`${displayCampaignName} Repeat Scans`]: '#16a34a',
              [`${displayCampaignName} Unique Visitors`]: '#14532d',
            };
            const color = colorMap[value] ?? '#1e293b';
            return <span style={{ color, fontWeight: 600, fontSize: '0.8125rem' }}>{value}</span>;
          }} />
          <Bar dataKey="campaign_uv" name={`${displayCampaignName} Unique Visitors`} stackId="a" fill="#16A34A" radius={[0, 0, 0, 0]} />
          <Bar dataKey="campaign_repeat" name={`${displayCampaignName} Repeat Scans`} stackId="a" fill="rgba(22, 163, 74, 0.25)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="biz_uv" name="Business Card Unique Visitors" stackId="b" fill="#2563EB" radius={[0, 0, 0, 0]} />
          <Bar dataKey="biz_repeat" name="Business Card Repeat Scans" stackId="b" fill="rgba(99, 102, 241, 0.3)" radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DispatchStatsPanel() {
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [defaultCampaign, setDefaultCampaign] = useState<string>('');
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [error, setError] = useState('');

  const statsCacheRef = React.useRef<Map<string, CampaignStats>>(new Map());

  // "2026_Q2_Torbay" → "Torbay 2026 Q2"; falls back to a readable key.
  const formatCampaignLabel = (c: string) => {
    const parts = c.split('_');
    if (parts.length >= 3) {
      const [year, quarter, ...suburbParts] = parts;
      return `${suburbParts.join(' ')} ${year} ${quarter}`.trim();
    }
    return c.replace(/_/g, ' ');
  };

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoadingCampaigns(true);
      try {
        const res = await fetch('/api/admin/outreach/campaign-stats');
        if (res.ok) {
          const data = await res.json();
          const list: string[] = data.available_campaigns || [];
          const defaultCampaign: string = data.default_campaign || '';
          setCampaigns(list);
          setDefaultCampaign(defaultCampaign);
          if (list.length > 0) {
            setSelectedCampaign(
              defaultCampaign && list.includes(defaultCampaign) ? defaultCampaign : list[0]
            );
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

  const setAsDefault = async () => {
    if (!selectedCampaign) return;
    setSavingDefault(true);
    setError('');
    try {
      const res = await fetch('/api/admin/outreach/default-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: selectedCampaign }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to set default campaign');
      }
      setDefaultCampaign(selectedCampaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default campaign');
    } finally {
      setSavingDefault(false);
    }
  };

  const fetchStats = useCallback(async (campaign: string) => {
    const cached = statsCacheRef.current.get(campaign);
    if (cached) {
      setStats(cached);
    } else {
      setLoading(true);
    }
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
      statsCacheRef.current.set(campaign, data);
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      }
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

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-slate-700 mr-1">Campaign:</label>
            {campaigns.length === 0 ? (
              <span className="text-sm text-slate-400">No campaign data available.</span>
            ) : (
              campaigns.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCampaign(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    selectedCampaign === c
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {formatCampaignLabel(c)}
                  {defaultCampaign === c && <span className="ml-1 opacity-80" title="Default campaign">★</span>}
                </button>
              ))
            )}
            {campaigns.length > 0 && selectedCampaign && (
              <button
                type="button"
                onClick={setAsDefault}
                disabled={savingDefault}
                title="Open this page with this campaign pre-selected"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  defaultCampaign === selectedCampaign
                    ? 'bg-amber-50 text-amber-700 border-amber-300 cursor-default'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                } disabled:opacity-50`}
              >
                {savingDefault
                  ? 'Saving…'
                  : defaultCampaign === selectedCampaign
                    ? '★ Default'
                    : '☆ Set as default'}
              </button>
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
              <SummaryCards summary={stats.summary} bizPv={stats.business_card_summary.pv} bizUv={stats.business_card_summary.uv} />
              <CampaignOverview summary={stats.summary} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DailySendChart data={stats.daily_sends} noJunkTotal={stats.summary.no_junk_mail_count} />
                <CombinedScanChart campaignScans={stats.daily_scans} bizCardScans={stats.business_card_daily_scans} campaignName={stats.campaign} />
              </div>
              <CampaignScanLogsPanel />
            </>
          )}
        </>
      )}
    </div>
  );
}
