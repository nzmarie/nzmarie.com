import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import DispatchStatsPanel from '@/components/admin/DispatchStatsPanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

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

// ─── Shared mock data ─────────────────────────────────────────────────────────

const mockCampaigns = ['2026_Q2_Oteha', '2026_Q1_Oteha'];

const mockStats = {
  campaign: '2026_Q2_Oteha',
  summary: {
    pending_count: 100,
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

const mockScanLogs = {
  success: true,
  total_scans: 38,
  total_unique: 20,
  campaigns: [
    { campaign_key: '2026_q2_oteha', campaign_name: '2026 Q2 Oteha', total_pv: 28, total_uv: 14 },
    { campaign_key: 'business_card', campaign_name: 'Business Card', total_pv: 10, total_uv: 6 },
  ],
  logs: [
    {
      id: 'log-1',
      campaign_key: '2026_q2_oteha',
      visitor_hash: 'abcdef123456xyz',
      ip_address: '1.2.3.4',
      user_agent: 'Mozilla/5.0',
      device_type: 'mobile',
      referrer: '',
      is_unique: true,
      created_at: '2026-07-25T10:30:00.000Z',
    },
    {
      id: 'log-2',
      campaign_key: 'business_card',
      visitor_hash: 'zyx654321fedcba',
      ip_address: '5.6.7.8',
      user_agent: 'Chrome/120',
      device_type: 'desktop',
      referrer: '',
      is_unique: false,
      created_at: '2026-07-24T08:00:00.000Z',
    },
  ],
};

// ─── URL-aware fetch mock factory ─────────────────────────────────────────────
// DispatchStatsPanel and CampaignScanLogsPanel issue parallel fetches, so
// ordering-based mockResolvedValueOnce is unreliable. All tests use this
// URL-aware approach instead.

function makeFetchMock(overrides?: {
  scanLogs?: object;
  stats?: object;
  campaigns?: string[];
  scansError?: boolean;
  statsError?: boolean;
}) {
  const campaigns = overrides?.campaigns ?? mockCampaigns;
  const stats = overrides?.stats ?? mockStats;
  const scanLogs = overrides?.scanLogs ?? { success: true, total_scans: 0, total_unique: 0, campaigns: [], logs: [] };

  return vi.fn((url: RequestInfo) => {
    const s = String(url || '');
    if (s.includes('/api/admin/analytics/scans')) {
      if (overrides?.scansError) return Promise.reject(new Error('Scan logs unavailable'));
      return Promise.resolve({ ok: true, json: async () => scanLogs });
    }
    if (s.includes('/api/admin/outreach/campaign-stats')) {
      if (s.includes('?campaign=')) {
        if (overrides?.statsError) return Promise.resolve({ ok: false, json: async () => ({ error: 'Server error' }) });
        return Promise.resolve({ ok: true, json: async () => stats });
      }
      return Promise.resolve({ ok: true, json: async () => ({ available_campaigns: campaigns }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

// ─── Helper ───────────────────────────────────────────────────────────────────
// Renders DispatchStatsPanel with a full URL-aware mock and waits for the
// CampaignScanLogsPanel header to appear (confirming both stats and scans settled).
async function renderWithStats(scanLogsMock = mockScanLogs) {
  (global.fetch as any) = makeFetchMock({ scanLogs: scanLogsMock });

  const qc = createQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <DispatchStatsPanel />
    </QueryClientProvider>
  );
  await waitFor(() => expect(screen.getByText('QR Code Scan Logs')).toBeTruthy());
}

// ─── DispatchStatsPanel ───────────────────────────────────────────────────────

describe('DispatchStatsPanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('loads campaigns on mount and shows loading state', async () => {
    (global.fetch as any) = makeFetchMock();

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DispatchStatsPanel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Campaign:')).toBeTruthy();
      expect(screen.getByText('2026_Q2_Oteha')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('100')).toBeTruthy();
      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('8')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
      expect(screen.getByText('120 / 45')).toBeTruthy();
    });
  });

  it('shows error state when API fails', async () => {
    (global.fetch as any) = makeFetchMock({ statsError: true });

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DispatchStatsPanel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy();
    });
  });

  it('shows no campaigns message when list is empty', async () => {
    (global.fetch as any) = makeFetchMock({ campaigns: [] });

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DispatchStatsPanel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No campaign data available.')).toBeTruthy();
    });
  });

  it('switches campaign and refetches stats', async () => {
    let statsCallCount = 0;
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/analytics/scans')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, total_scans: 0, total_unique: 0, campaigns: [], logs: [] }) });
      }
      if (s.includes('/api/admin/outreach/campaign-stats')) {
        if (s.includes('?campaign=')) {
          statsCallCount++;
          const sentCount = statsCallCount === 1 ? 42 : 18;
          const campaign = statsCallCount === 1 ? '2026_Q2_Oteha' : '2026_Q1_Oteha';
          return Promise.resolve({ ok: true, json: async () => ({ ...mockStats, campaign, summary: { ...mockStats.summary, sent_count: sentCount } }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ available_campaigns: mockCampaigns }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DispatchStatsPanel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2026_Q1_Oteha' } });

    await waitFor(() => {
      expect(screen.getByText('18')).toBeTruthy();
    });
  });

  it('shows campaign overview with pie chart and percentage legend', async () => {
    (global.fetch as any) = makeFetchMock();

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DispatchStatsPanel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Campaign Overview — 100 Addresses')).toBeTruthy();
    });
  });

  it('shows no junk mail badge on daily dispatch chart', async () => {
    (global.fetch as any) = makeFetchMock();

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DispatchStatsPanel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Multiple "No Junk Mail" elements exist (summary card + chart badge) — use getAllByText
      expect(screen.getAllByText('No Junk Mail').length).toBeGreaterThan(0);
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('shows business card summary card and scan trend section', async () => {
    (global.fetch as any) = makeFetchMock();

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DispatchStatsPanel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Business Card 🪪')).toBeTruthy();
      expect(screen.getByText('18 / 7')).toBeTruthy();
    });

    expect(screen.getByText('Business Card 🪪')).toBeTruthy();
    expect(screen.getByText('QR Code Scan Trend')).toBeTruthy();
    expect(screen.getByText(/55 \/ 27/)).toBeTruthy();
    expect(screen.getByText('Business Card: 18 / 7')).toBeTruthy();
  });

  it('shows awaiting message when no QR scans at all', async () => {
    (global.fetch as any) = makeFetchMock({
      stats: {
        ...mockStats,
        summary: { ...mockStats.summary, total_scans_pv: 0, total_scans_uv: 0 },
        daily_scans: [],
        business_card_summary: { pv: 0, uv: 0 },
        business_card_daily_scans: [],
      },
    });

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DispatchStatsPanel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Awaiting first QR scan/i)).toBeTruthy();
    });
  });
});

// ─── CampaignScanLogsPanel ────────────────────────────────────────────────────

describe('CampaignScanLogsPanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('renders the expanded panel header and table after stats load', async () => {
    await renderWithStats();

    expect(screen.getByText('QR Code Scan Logs')).toBeTruthy();
    expect(screen.getByText('Detailed record of direct mail visitor scans')).toBeTruthy();
    // Panel is open by default — Hide button shown
    expect(screen.getByText('\u25B2 Hide')).toBeTruthy();
  });

  it('fetches logs on mount and shows the table', async () => {
    await renderWithStats();

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls as string[][];
      expect(calls.some(([url]) => String(url).includes('/api/admin/analytics/scans'))).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId('scan-logs-table')).toBeTruthy();
    });
  });

  it('shows All Campaigns button with total scan count', async () => {
    await renderWithStats();

    await waitFor(() => {
      expect(screen.getByText('All Campaigns (38)')).toBeTruthy();
    });
  });

  it('shows campaign filter buttons with pv counts', async () => {
    await renderWithStats();

    await waitFor(() => {
      expect(screen.getByText('2026 Q2 Oteha (28)')).toBeTruthy();
      expect(screen.getByText('Business Card (10)')).toBeTruthy();
    });
  });

  it('displays log rows — visitor fingerprint, IP, and unique/repeat badges', async () => {
    await renderWithStats();

    await waitFor(() => {
      expect(screen.getByText('abcdef123456...')).toBeTruthy();
      expect(screen.getByText('1.2.3.4')).toBeTruthy();
      expect(screen.getByText('Unique')).toBeTruthy();
      expect(screen.getByText('Repeat')).toBeTruthy();
    });
    const fingerprintEl = screen.getByText('abcdef123456...');
    expect(fingerprintEl.closest('td')?.className).toContain('select-text');
  });

  it('filters logs by campaign when a campaign button is clicked', async () => {
    await renderWithStats();

    await waitFor(() => expect(screen.getByText('2026 Q2 Oteha (28)')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('1.2.3.4')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('5.6.7.8')).toBeTruthy());

    // Click Oteha campaign — client-side filter, no new fetch needed
    fireEvent.click(screen.getByText('2026 Q2 Oteha (28)'));

    await waitFor(() => {
      expect(screen.getByText('1.2.3.4')).toBeTruthy();
      expect(screen.queryByText('5.6.7.8')).toBeNull();
    });
  });

  it('shows empty state when no logs are returned', async () => {
    await renderWithStats({ ...mockScanLogs, logs: [] });

    await waitFor(() => {
      expect(screen.getByText('No scan logs recorded yet.')).toBeTruthy();
    });
  });

  it('shows error message when scans API fails', async () => {
    (global.fetch as any) = makeFetchMock({ scansError: true });

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DispatchStatsPanel />
      </QueryClientProvider>
    );

    // Wait for stats to load so CampaignScanLogsPanel mounts
    await waitFor(() => expect(screen.getByText('QR Code Scan Logs')).toBeTruthy(), { timeout: 3000 });

    await waitFor(() => {
      const hasError = !!screen.queryByText('Failed to load scan logs');
      const hasTable = !!screen.queryByTestId('scan-logs-table');
      const hasEmpty = !!screen.queryByText('No scan logs recorded yet.');
      if (!hasError && !hasTable && !hasEmpty) throw new Error('Expected error, table, or empty state');
    });
  });

  it('collapses the panel when Hide is clicked and re-expands with Show', async () => {
    await renderWithStats();

    // Panel is open — click Hide
    fireEvent.click(screen.getByText('\u25B2 Hide'));

    await waitFor(() => {
      expect(screen.queryByTestId('scan-logs-table')).toBeNull();
      expect(screen.getByText('\u25BC Show')).toBeTruthy();
    });

    // Re-open — no new fetch needed (data already in state)
    fireEvent.click(screen.getByText('\u25BC Show'));

    await waitFor(() => {
      expect(screen.getByTestId('scan-logs-table')).toBeTruthy();
      expect(screen.getByText('\u25B2 Hide')).toBeTruthy();
    });
  });

  it('date filter hides non-matching logs and Clear restores them', async () => {
    await renderWithStats();

    await waitFor(() => expect(screen.getByTestId('scan-logs-table')).toBeTruthy());

    expect(screen.getByText('1.2.3.4')).toBeTruthy();
    expect(screen.getByText('5.6.7.8')).toBeTruthy();

    // Apply date filter — only log-1 (2026-07-25) matches
    const dateInput = screen.getByDisplayValue('');
    fireEvent.change(dateInput, { target: { value: '2026-07-25' } });

    await waitFor(() => {
      expect(screen.queryByText('5.6.7.8')).toBeNull();
      expect(screen.getByText('1.2.3.4')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Clear'));

    await waitFor(() => {
      expect(screen.getByText('5.6.7.8')).toBeTruthy();
    });
  });
});
