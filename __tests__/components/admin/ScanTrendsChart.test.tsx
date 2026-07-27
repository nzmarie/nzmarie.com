import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import ScanTrendsChart from '../../../components/admin/ScanTrendsChart';

const mockData = {
  success: true,
  data: [
    { time: '2026-07-25', 'campaign_a': 5, 'campaign_b': 3 },
    { time: '2026-07-26', 'campaign_a': 8, 'campaign_b': 2 },
    { time: '2026-07-27', 'campaign_a': 4, 'campaign_b': 6 },
  ],
  campaigns: [
    { key: 'campaign_a', name: 'Campaign A' },
    { key: 'campaign_b', name: 'Campaign B' },
  ],
  isSubDay: false,
};

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(mockData),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ScanTrendsChart', () => {
  it('renders title and time range buttons', async () => {
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    expect(screen.getByText('Scan Trends')).toBeTruthy();
    for (const r of ['1h', '6h', '1d', '2d', '1w', '2w', '1m', '2m', '3m', '6m', '1y']) {
      expect(screen.getByText(r)).toBeTruthy();
    }
  });

  it('shows loading state initially', () => {
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    expect(screen.getByText('Loading chart data...')).toBeTruthy();
  });

  it('renders chart and campaign toggles after fetch', async () => {
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Campaign A')).toBeTruthy();
      expect(screen.getByText('Campaign B')).toBeTruthy();
    });
    expect(screen.queryByText('No scan data yet for this time range.')).toBeNull();
  });

  it('toggles campaign visibility on click', async () => {
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    await waitFor(() => expect(screen.getByText('Campaign A')).toBeTruthy());
    const btnA = screen.getByText('Campaign A').closest('button')!;
    fireEvent.click(btnA);
    const btnB = screen.getByText('Campaign B');
    expect(btnB).toBeTruthy();
  });

  it('prevents hiding last visible campaign', async () => {
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    await waitFor(() => expect(screen.getByText('Campaign A')).toBeTruthy());
    const btnA = screen.getByText('Campaign A').closest('button')!;
    const btnB = screen.getByText('Campaign B').closest('button')!;
    fireEvent.click(btnB);
    fireEvent.click(btnA);
    expect(btnA).toBeTruthy();
  });

  it('changes range on preset button click', async () => {
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    const btn1w = screen.getByText('1w');
    fireEvent.click(btn1w);
    expect(btn1w.className).toContain('bg-blue-600');
  });

  it('shows empty state when no data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [], campaigns: [], isSubDay: false }),
    });
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('No scan data yet for this time range.')).toBeTruthy();
    });
  });

  it('renders without crashing and fires fetch on mount', async () => {
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/analytics/scan-trends?range=1m');
    });
  });

  it('handles sub-day format', async () => {
    const subDayData = {
      success: true,
      data: [
        { time: '2026-07-27T10:00:00.000Z', 'campaign_a': 2 },
        { time: '2026-07-27T11:00:00.000Z', 'campaign_a': 5 },
      ],
      campaigns: [{ key: 'campaign_a', name: 'Campaign A' }],
      isSubDay: true,
    };
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(subDayData),
    });
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Campaign A')).toBeTruthy();
    });
  });

  it('re-fetches when range changes', async () => {
    render(<ScanTrendsChart onDrillDown={() => {}} />);
    await waitFor(() => expect(screen.getByText('1y')).toBeTruthy());
    fireEvent.click(screen.getByText('1y'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/analytics/scan-trends?range=1y');
    });
  });
});
