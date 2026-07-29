import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import DispatchStatsPanel from '@/components/admin/DispatchStatsPanel';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'admin@test.com' } }, status: 'authenticated' }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div>Bar</div>,
  ComposedChart: ({ children }: any) => <div>{children}</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  CartesianGrid: () => <div>CartesianGrid</div>,
  Tooltip: () => <div>Tooltip</div>,
  Legend: () => <div>Legend</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => <div>Cell</div>,
}));

const mockCampaigns = ['2026_Q2_Oteha', '2026_Q1_Oteha'];
const mockStats = {
  campaign: '2026_Q2_Oteha',
  summary: {
    pending_count: 15,
    sent_count: 42,
    interacted_count: 8,
    converted_count: 3,
    no_junk_mail_count: 5,
    total_scans_pv: 120,
    total_scans_uv: 45,
  },
  daily_sends: [
    { date: '2026-07-15', total_sent: 10, no_junk_sent: 2 },
    { date: '2026-07-16', total_sent: 20, no_junk_sent: 3 },
  ],
  daily_scans: [
    { date: '2026-07-17', pv: 30, uv: 15 },
    { date: '2026-07-18', pv: 25, uv: 12 },
  ],
  business_card_summary: { pv: 18, uv: 7 },
  business_card_daily_scans: [
    { date: '2026-07-16', pv: 8, uv: 3 },
    { date: '2026-07-17', pv: 10, uv: 4 },
  ],
};

describe('DispatchStatsPanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('loads campaigns on mount and shows loading state', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available_campaigns: mockCampaigns }),
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    render(<DispatchStatsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Campaign:')).toBeTruthy();
      expect(screen.getByText('2026_Q2_Oteha')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('15')).toBeTruthy();
      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('8')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
      expect(screen.getByText('120 / 45')).toBeTruthy();
    });
  });

  it('shows error state when API fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available_campaigns: mockCampaigns }),
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });

    render(<DispatchStatsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy();
    });
  });

  it('shows no campaigns message when list is empty', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available_campaigns: [] }),
    });

    render(<DispatchStatsPanel />);

    await waitFor(() => {
      expect(screen.getByText('No campaign data available.')).toBeTruthy();
    });
  });

  it('switches campaign and refetches stats', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available_campaigns: mockCampaigns }),
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    render(<DispatchStatsPanel />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockStats,
        campaign: '2026_Q1_Oteha',
        summary: { ...mockStats.summary, sent_count: 18 },
      }),
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2026_Q1_Oteha' } });

    await waitFor(() => {
      expect(screen.getByText('18')).toBeTruthy();
    });
  });

  it('shows campaign overview with pie chart and percentage legend', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available_campaigns: mockCampaigns }),
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    render(<DispatchStatsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Campaign Overview')).toBeTruthy();
    });
  });

  it('shows no junk mail badge on daily dispatch chart', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available_campaigns: mockCampaigns }),
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    render(<DispatchStatsPanel />);

    await waitFor(() => {
      expect(screen.getByText('No Junk Mail: 5')).toBeTruthy();
    });
  });

  it('shows business card summary card and scan trend section', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available_campaigns: mockCampaigns }),
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    render(<DispatchStatsPanel />);

    await waitFor(() => {
      expect(screen.getByText('18 / 7')).toBeTruthy();
    });

    expect(screen.getByText('Business Card 🪪')).toBeTruthy();
    expect(screen.getByText('QR Code Scan Trend')).toBeTruthy();
    expect(screen.getByText('Oteha: 55 / 27')).toBeTruthy();
    expect(screen.getByText('Business Card: 18 / 7')).toBeTruthy();
  });

  it('shows awaiting message when no QR scans at all', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available_campaigns: mockCampaigns }),
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockStats,
        summary: { ...mockStats.summary, total_scans_pv: 0, total_scans_uv: 0 },
        daily_scans: [],
        business_card_summary: { pv: 0, uv: 0 },
        business_card_daily_scans: [],
      }),
    });

    render(<DispatchStatsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Awaiting first QR scan.')).toBeTruthy();
    });
  });
});
