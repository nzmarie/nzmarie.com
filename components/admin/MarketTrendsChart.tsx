'use client';

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface QuarterlyData {
  period: string;
  suburbMedian: number | null;
  suburbSales: number;
  suburbDays: number | null;
  cityMedian: number | null;
  citySales: number;
  cityDays: number | null;
}

interface Props {
  data: QuarterlyData[];
  suburb: string;
  district: string;
}

const formatYAxis = (value: number) => `$${(value / 1000000).toFixed(1)}M`;

export default function MarketTrendsChart({ data, suburb, district }: Props) {
  const chartData = data.map(d => ({
    ...d,
    suburbMedian: d.suburbMedian ?? undefined,
    cityMedian: d.cityMedian ?? undefined,
  }));

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-xl font-bold mb-4">
        {suburb} vs {district} Median Price Trend
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={formatYAxis} />
          <Tooltip
            formatter={(value, name) => {
              if (typeof value === 'number' && (name === 'suburbMedian' || name === 'cityMedian')) {
                return [`$${value.toLocaleString()}`, name === 'suburbMedian' ? suburb : district];
              }
              return [value, name];
            }}
            labelFormatter={(label) => `Period: ${label}`}
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
