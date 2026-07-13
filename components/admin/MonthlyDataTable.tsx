'use client';

import React from 'react';
import type { MonthlyDataPoint } from '@/lib/market-data-aggregator';
import { aggregateToQuarterly } from '@/lib/quarterly-aggregator';

const SUBURB_COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

function getSuburbColor(index: number): string {
  return SUBURB_COLORS[index % SUBURB_COLORS.length];
}

function formatPrice(value: number | null): string {
  if (value == null) return 'Low Vol.';
  return `$${value.toLocaleString('en-NZ')}`;
}

function formatNumber(value: number | null): string {
  if (value == null) return 'Low Vol.';
  return value.toLocaleString('en-NZ');
}

interface Props {
  monthlyData: MonthlyDataPoint[];
  dataMode: 'monthly' | 'quarterly';
  onModeChange: (mode: 'monthly' | 'quarterly') => void;
  activeFocusSuburb: string;
  availableSuburbs: string[];
  onFocusChange: (suburb: string) => void;
}

export default function MonthlyDataTable({
  monthlyData,
  dataMode,
  onModeChange,
  activeFocusSuburb,
  availableSuburbs,
  onFocusChange,
}: Props) {
  const isDistrict = activeFocusSuburb === 'North Shore City';
  const activeData = dataMode === 'monthly' ? monthlyData : aggregateToQuarterly(monthlyData);

  if (activeData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Data</h3>
        <div className="flex items-center justify-center h-[100px] text-gray-400 text-sm">
          No market data yet. Upload a REINZ Excel file above to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Monthly Data</h3>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => onModeChange('monthly')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              dataMode === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => onModeChange('quarterly')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              dataMode === 'quarterly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Quarterly
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap gap-2">
          {availableSuburbs.map((s) => {
            const active = activeFocusSuburb === s;
            const color = getSuburbColor(availableSuburbs.indexOf(s));
            return (
              <button
                key={s}
                onClick={() => onFocusChange(s)}
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
          onClick={() => onFocusChange('North Shore City')}
          className={`text-sm font-medium rounded-full px-3 py-1.5 border transition-all ${
            isDistrict
              ? 'bg-[#94A3B8] text-white border-[#94A3B8] shadow-sm'
              : 'text-gray-500 border-gray-300 hover:border-gray-400 bg-white'
          }`}
        >
          North Shore {isDistrict ? '✓' : ''}
        </button>
      </div>

      {isDistrict ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Period</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">North Shore City Median</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Avg Days</th>
              </tr>
            </thead>
            <tbody>
              {activeData.map((row) => (
                <tr key={row.period} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium">{row.period}</td>
                  <td className="text-right py-2 px-3">{formatPrice(row.cityMedian)}</td>
                  <td className="text-right py-2 px-3">{formatNumber(row.cityDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Period</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">
                  {activeFocusSuburb} Median
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">
                  North Shore City Median
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">
                  {activeFocusSuburb} Sales
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Avg Days</th>
              </tr>
            </thead>
            <tbody>
              {activeData.map((row) => {
                const sd = row.suburbs[activeFocusSuburb];
                return (
                  <tr key={row.period} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{row.period}</td>
                    <td className="text-right py-2 px-3">{sd ? formatPrice(sd.median) : 'N/A'}</td>
                    <td className="text-right py-2 px-3">{formatPrice(row.cityMedian)}</td>
                    <td className="text-right py-2 px-3">{sd ? formatNumber(sd.sales) : 'N/A'}</td>
                    <td className="text-right py-2 px-3">{sd ? formatNumber(sd.days) : 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
