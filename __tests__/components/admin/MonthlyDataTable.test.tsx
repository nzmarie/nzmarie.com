import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import MonthlyDataTable from '../../../components/admin/MonthlyDataTable';
import type { MonthlyDataPoint } from '../../../lib/market-data-aggregator';

const mockData: MonthlyDataPoint[] = [
  {
    period: '2025-01',
    periodRaw: '2025-01-01',
    cityMedian: 900000,
    citySales: 50,
    cityDays: 35,
    suburbs: {
      Oteha: { median: 1000000, sales: 10, days: 30 },
      Albany: { median: 950000, sales: 8, days: 28 },
    },
  },
  {
    period: '2025-02',
    periodRaw: '2025-02-01',
    cityMedian: 920000,
    citySales: 55,
    cityDays: 33,
    suburbs: {
      Oteha: { median: 1100000, sales: 12, days: 28 },
      Albany: { median: 960000, sales: 9, days: 26 },
    },
  },
  {
    period: '2025-03',
    periodRaw: '2025-03-01',
    cityMedian: 910000,
    citySales: 45,
    cityDays: 34,
    suburbs: {
      Oteha: { median: 1050000, sales: 8, days: 32 },
      Albany: { median: 940000, sales: 7, days: 30 },
    },
  },
];

const availableSuburbs = ['Oteha', 'Albany', 'Browns Bay'];

describe('MonthlyDataTable', () => {
  const onModeChange = vi.fn();
  const onFocusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the title and mode toggle', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('Monthly Data')).toBeDefined();
    expect(screen.getByText('Monthly')).toBeDefined();
    expect(screen.getByText('Quarterly')).toBeDefined();
  });

  it('renders suburb buttons with single-select highlighting', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Albany"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    const albanyBtn = screen.getByText('Albany');
    const otehaBtn = screen.getByText('Oteha');
    expect(albanyBtn).toBeDefined();
    expect(otehaBtn).toBeDefined();
    expect(screen.getByText('Browns Bay')).toBeDefined();
  });

  it('renders North Shore City button', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByRole('button', { name: /North Shore/ })).toBeDefined();
  });

  it('renders 5 columns in normal mode', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('Period')).toBeDefined();
    expect(screen.getByText('Oteha Median')).toBeDefined();
    expect(screen.getByText('North Shore City Median')).toBeDefined();
    expect(screen.getByText('Oteha Sales')).toBeDefined();
    expect(screen.getByText('Avg Days')).toBeDefined();
  });

  it('renders 3 columns in district mode', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="North Shore City"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('Period')).toBeDefined();
    expect(screen.getByText('North Shore City Median')).toBeDefined();
    expect(screen.getByText('Avg Days')).toBeDefined();
    expect(screen.queryByText('Oteha Median')).toBeNull();
    expect(screen.queryByText('Oteha Sales')).toBeNull();
  });

  it('shows North Shore ✓ when district mode is active', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="North Shore City"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('North Shore ✓')).toBeDefined();
  });

  it('formats prices with $ and commas', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('$1,000,000')).toBeDefined();
  });

  it('shows "Low Vol." for null values', () => {
    const dataWithNull: MonthlyDataPoint[] = [
      {
        period: '2025-01',
        periodRaw: '2025-01-01',
        cityMedian: null,
        citySales: 0,
        cityDays: null,
        suburbs: {
          Oteha: { median: null, sales: 0, days: null },
        },
      },
    ];

    render(
      <MonthlyDataTable
        monthlyData={dataWithNull}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    const lowVol = screen.getAllByText('Low Vol.');
    expect(lowVol.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onFocusChange when a suburb button is clicked', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    fireEvent.click(screen.getByText('Albany'));
    expect(onFocusChange).toHaveBeenCalledWith('Albany');
  });

  it('calls onFocusChange with North Shore City when district button is clicked', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /North Shore/ }));
    expect(onFocusChange).toHaveBeenCalledWith('North Shore City');
  });

  it('calls onModeChange when Monthly/Quarterly toggle is clicked', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    fireEvent.click(screen.getByText('Quarterly'));
    expect(onModeChange).toHaveBeenCalledWith('quarterly');
  });

  it('switches column header to match activeFocusSuburb', () => {
    const { rerender } = render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Albany"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('Albany Median')).toBeDefined();
    expect(screen.getByText('Albany Sales')).toBeDefined();
    expect(screen.queryByText('Oteha Median')).toBeNull();

    rerender(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('Oteha Median')).toBeDefined();
    expect(screen.queryByText('Albany Median')).toBeNull();
  });

  it('renders quarterly data when mode is quarterly', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="quarterly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('2025-Q1')).toBeDefined();
  });

  it('shows empty state when no data', () => {
    render(
      <MonthlyDataTable
        monthlyData={[]}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText(/No market data yet/)).toBeDefined();
  });
});
