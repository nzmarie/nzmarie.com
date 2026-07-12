'use client';

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  period: string;
  suburbMedian: number | null;
  suburbSales: number;
  suburbDays: number | null;
  cityMedian: number | null;
  citySales: number;
  cityDays: number | null;
}

interface Props {
  data: DataPoint[];
  suburb: string;
  district: string;
  mode: 'monthly' | 'quarterly';
}

const formatYAxis = (value: number) => `$${(value / 1000000).toFixed(1)}M`;

const MONTH_SHORT: Record<string, string> = {
  '01': 'Jan','02': 'Feb','03': 'Mar','04': 'Apr','05': 'May','06': 'Jun',
  '07': 'Jul','08': 'Aug','09': 'Sep','10': 'Oct','11': 'Nov','12': 'Dec',
};

function buildLabels(data: DataPoint[], mode: 'monthly' | 'quarterly'): DataPoint[] {
  if (mode === 'quarterly') {
    return data.map(d => ({ ...d, _label: d.period }));
  }

  let currentYear = '';
  return data.map((d) => {
    const parts = d.period.split('-');
    const m = parts[1];
    const y = parts[0];
    const showYear = y !== currentYear;
    currentYear = y;
    return {
      ...d,
      _label: showYear ? `${MONTH_SHORT[m] || m} ${y}` : (MONTH_SHORT[m] || m),
    };
  });
}

export default function MarketTrendsChart({ data, suburb, district, mode }: Props) {
  const chartData = buildLabels(data, mode).map(d => ({
    ...d,
    suburbMedian: d.suburbMedian ?? undefined,
    cityMedian: d.cityMedian ?? undefined,
  }));

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-xl font-bold mb-4">
        {suburb} vs {district} {mode === 'monthly' ? 'Monthly' : 'Quarterly'} Median Price
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="_label" />
          <YAxis tickFormatter={formatYAxis} />
          <Tooltip
            formatter={(value, name) => {
              if (typeof value === 'number' && (name === 'suburbMedian' || name === 'cityMedian')) {
                return [`$${value.toLocaleString()}`, name === 'suburbMedian' ? suburb : district];
              }
              return [value, name];
            }}
            labelFormatter={(label) => `${mode === 'monthly' ? 'Month' : 'Period'}: ${label}`}
          />
          <Legend />
          <Line
            name="suburbMedian"
            type="monotone"
            dataKey="suburbMedian"
            stroke="#2563EB"
            strokeWidth={3}
            connectNulls
            dot={{ r: 6, fill: '#2563EB' }}
            activeDot={{ r: 8 }}
          />
          <Line
            name="cityMedian"
            type="monotone"
            dataKey="cityMedian"
            stroke="#94A3B8"
            strokeWidth={2}
            strokeDasharray="5 5"
            connectNulls
            dot={{ r: 4, fill: '#94A3B8' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
