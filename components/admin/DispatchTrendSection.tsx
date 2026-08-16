'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export type TrendGranularity = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface TrendBucket {
  bucket: string;
  sent: number;
  junk: number;
}

export interface SuburbDispatch {
  suburb: string;
  sent_count: number;
  junk_count: number;
  unsent_count: number;
  total_count: number;
  first_sent_at: string | null;
  last_sent_at: string | null;
}

export interface DispatchTrend {
  daily: TrendBucket[];
  weekly: TrendBucket[];
  monthly: TrendBucket[];
  quarterly: TrendBucket[];
  seriesBySuburb: Record<TrendGranularity, Record<string, TrendBucket[]>>;
  bySuburb: SuburbDispatch[];
}

const GRANULARITIES: TrendGranularity[] = ['daily', 'weekly', 'monthly', 'quarterly'];

const GRANULARITY_LABELS: Record<TrendGranularity, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

function formatBucketLabel(bucket: string, granularity: TrendGranularity): string {
  const d = new Date(`${bucket}T00:00:00`);
  if (granularity === 'daily') {
    return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  }
  if (granularity === 'weekly') {
    return `${d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} wk`;
  }
  if (granularity === 'monthly') {
    return d.toLocaleDateString('en-NZ', { month: 'short', year: '2-digit' });
  }
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `Q${quarter} ${String(d.getFullYear()).slice(2)}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

function formatSuburbName(name: string): string {
  return name.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function DispatchVolumeChart({
  trend,
  selectedSuburb,
  onClearSuburb,
}: {
  trend: DispatchTrend;
  selectedSuburb: string | null;
  onClearSuburb: () => void;
}) {
  const [granularity, setGranularity] = useState<TrendGranularity>('daily');
  const series = selectedSuburb
    ? trend.seriesBySuburb[granularity]?.[selectedSuburb] ?? []
    : trend[granularity];
  const sentTotal = series.reduce((sum, b) => sum + b.sent, 0);
  const junkTotal = series.reduce((sum, b) => sum + b.junk, 0);
  const activeSuburbs = trend.bySuburb.filter((b) => b.sent_count > 0 || b.junk_count > 0).length;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Dispatch Volume</h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {selectedSuburb ? (
              <button
                type="button"
                onClick={onClearSuburb}
                className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full hover:bg-indigo-100 transition-colors"
              >
                {formatSuburbName(selectedSuburb)} ×
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                All suburbs
              </span>
            )}
            <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">
              Sent: {sentTotal}
            </span>
            <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full">
              Junk: {junkTotal}
            </span>
            {!selectedSuburb && (
              <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
                {activeSuburbs} suburb{activeSuburbs === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          {GRANULARITIES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                granularity === g
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {GRANULARITY_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {series.length === 0 ? (
        <p className="text-sm text-slate-400 py-12 text-center">No dispatch data.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => formatBucketLabel(v, granularity)}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(v: unknown) => formatBucketLabel(String(v ?? ''), granularity)}
              formatter={(value: unknown, name: unknown) => [
                String(value ?? 0),
                name === 'sent' ? 'Sent' : 'Junk Mail',
              ]}
            />
            <Legend
              formatter={(value: string) => (
                <span
                  style={{
                    color: value === 'sent' ? '#7C3AED' : '#CA8A04',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                  }}
                >
                  {value === 'sent' ? 'Sent' : 'Junk Mail'}
                </span>
              )}
            />
            <Bar dataKey="sent" name="sent" fill="#7C3AED" radius={[3, 3, 0, 0]} />
            <Bar dataKey="junk" name="junk" fill="#EAB308" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function SuburbDispatchTimeline({
  suburbs,
  selectedSuburb,
  onSelectSuburb,
}: {
  suburbs: SuburbDispatch[];
  selectedSuburb: string | null;
  onSelectSuburb: (suburb: string | null) => void;
}) {
  if (suburbs.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Suburb Dispatch Timeline</h3>
          <p className="text-sm text-slate-500 mt-1">Click a suburb to filter the volume chart.</p>
        </div>
        {selectedSuburb && (
          <button
            type="button"
            onClick={() => onSelectSuburb(null)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Suburb</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">First Sent</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Last Sent</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Sent</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Unsent</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Pending</th>
              <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase w-2/5">Progress</th>
            </tr>
          </thead>
          <tbody>
            {suburbs.map((s) => {
              const active = selectedSuburb === s.suburb;
              const sentPct = s.total_count > 0 ? (s.sent_count / s.total_count) * 100 : 0;
              const junkPct = s.total_count > 0 ? (s.junk_count / s.total_count) * 100 : 0;
              const unsentCount = s.unsent_count ?? Math.max(0, s.total_count - s.sent_count - s.junk_count);
              const unsentPct = s.total_count > 0 ? (unsentCount / s.total_count) * 100 : 0;
              const hasActivity = s.sent_count > 0 || s.junk_count > 0;
              return (
                <tr
                  key={s.suburb}
                  onClick={() => onSelectSuburb(active ? null : s.suburb)}
                  className={`border-b border-slate-50 cursor-pointer transition-colors ${
                    active ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-slate-900">{formatSuburbName(s.suburb)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{hasActivity ? formatDate(s.first_sent_at) : '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{hasActivity ? formatDate(s.last_sent_at) : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-purple-700">{s.sent_count}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-red-600">{unsentCount}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{s.total_count}</td>
                  <td className="px-3 py-2.5">
                    {s.total_count > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-2.5 flex-1 rounded-full overflow-hidden bg-slate-100">
                          {sentPct > 0 && (
                            <div style={{ width: `${sentPct}%` }} className="bg-purple-500" title={`Sent ${s.sent_count}`} />
                          )}
                          {unsentPct > 0 && (
                            <div style={{ width: `${unsentPct}%` }} className="bg-red-500" title={`Unsent ${unsentCount}`} />
                          )}
                          {junkPct > 0 && (
                            <div style={{ width: `${junkPct}%` }} className="bg-yellow-400" title={`Junk ${s.junk_count}`} />
                          )}
                        </div>
                        <span className="text-xs text-slate-400 w-16 text-right">
                          {s.sent_count}/{s.total_count}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No dispatch</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DispatchTrendSection({ trend }: { trend: DispatchTrend }) {
  const [selectedSuburb, setSelectedSuburb] = useState<string | null>(null);
  if (!trend) return null;

  return (
    <div className="space-y-6">
      <DispatchVolumeChart
        trend={trend}
        selectedSuburb={selectedSuburb}
        onClearSuburb={() => setSelectedSuburb(null)}
      />
      <SuburbDispatchTimeline
        suburbs={trend.bySuburb}
        selectedSuburb={selectedSuburb}
        onSelectSuburb={setSelectedSuburb}
      />
    </div>
  );
}