'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type Campaign = { key: string; name: string };

const TIME_RANGES = ['1h', '6h', '1d', '2d', '1w', '2w', '1m', '2m', '3m', '6m', '1y'] as const;
type TimeRange = typeof TIME_RANGES[number];

const COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  '#0D9488', '#7C3AED', '#DB2777', '#CA8A04',
];

function formatTime(time: string, isSubDay: boolean): string {
  if (isSubDay) {
    const d = new Date(time);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const parts = time.split('-');
  if (parts.length >= 3) {
    return `${parts[1]}/${parts[2].substring(0, 2)}`;
  }
  return time;
}

interface ScanTrendsChartProps {
  onDrillDown: (date: string, campaignKey: string) => void;
}

export default function ScanTrendsChart({ onDrillDown }: ScanTrendsChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isSubDay, setIsSubDay] = useState(false);
  const [visibleCampaigns, setVisibleCampaigns] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/scan-trends?range=${timeRange}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data || []);
        setCampaigns(result.campaigns || []);
        setIsSubDay(result.isSubDay || false);
        setVisibleCampaigns(new Set((result.campaigns || []).map((c: Campaign) => c.key)));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCampaign = (key: string) => {
    setVisibleCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const campaignsToShow = campaigns.filter(c => visibleCampaigns.has(c.key));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Scan Trends</h3>
        <div className="flex flex-wrap gap-1">
          {TIME_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                timeRange === r
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {campaigns.map((c, i) => {
          const active = visibleCampaigns.has(c.key);
          const color = COLORS[i % COLORS.length];
          return (
            <button
              key={c.key}
              onClick={() => toggleCampaign(c.key)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border"
              style={{
                backgroundColor: active ? `${color}15` : '#f9fafb',
                borderColor: active ? color : '#e5e7eb',
                color: active ? color : '#9ca3af',
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {c.name}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
          Loading chart data...
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
          No scan data yet for this time range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            onClick={(e) => {
              const date = e.activeLabel as string;
              const campaignKey = e.activeDataKey as string | undefined;
              if (date) {
                let displayDate: string;
                if (isSubDay) {
                  displayDate = new Date(date).toISOString().split('T')[0];
                } else {
                  displayDate = date;
                }
                onDrillDown(displayDate, campaignKey || '');
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tickFormatter={(v) => formatTime(v, isSubDay)}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              labelFormatter={(v) => formatTime(v, isSubDay)}
            />
            {campaignsToShow.map((c, i) => (
              <Line
                key={c.key}
                type="monotone"
                dataKey={c.key}
                name={c.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: COLORS[i % COLORS.length], cursor: 'pointer' }}
                activeDot={{ r: 5, fill: COLORS[i % COLORS.length], cursor: 'pointer' }}
                connectNulls
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              onClick={(e) => {
                const key = e.dataKey as string;
                if (key) toggleCampaign(key);
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
