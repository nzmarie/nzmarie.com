import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import DashboardPage from '../../../app/admin/dashboard/page';
import AnalyticsPage from '../../../app/admin/analytics/page';
import DownloadsPage from '../../../app/admin/downloads/page';
import PDFManagerPage from '../../../app/admin/pdf-manager/page';

const mockPush = vi.fn();
let mockSession: { data: { user: { email: string; name?: string } } | null; status: 'authenticated' | 'loading' | 'unauthenticated' } = {
  data: { user: { email: 'nzlouis.com@gmail.com' } },
  status: 'authenticated',
};

vi.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonDashboard: () => <div>Loading Dashboard</div>,
  SkeletonAnalytics: () => <div>Loading Analytics</div>,
  SkeletonDownloads: () => <div>Loading Downloads</div>,
  SkeletonPDFManager: () => <div>Loading PDF Manager</div>,
}));

describe('Extra admin pages', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/leads')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, leads: [] }) }) as any;
      }
      if (url.includes('/api/admin/reports')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, reports: [] }) }) as any;
      }
      if (url.includes('/api/admin/downloads')) {
        return Promise.resolve({ 
          ok: true, 
          json: () => Promise.resolve({ 
            data: [], 
            suburbs: [], 
            stats: { total_downloads: '0', this_month: '0', unique_users: '0' },
            pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
          }) 
        }) as any;
      }
      if (url.includes('/api/admin/dashboard/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            stats: { newLeads: 0, highPriorityLeads: 0, pendingOutreach: 0, todayFollowups: 0, overdueFollowups: 0, todayDownloads: 0 },
            followups: []
          })
        }) as any;
      }
      if (url.includes('/api/admin/analytics/available-suburbs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ availableSuburbs: ['Oteha', 'Albany', 'Browns Bay', 'Torbay'] }),
        }) as any;
      }
      if (url.includes('/api/admin/analytics/last-sold-data')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            suburbs: [
              { suburb: 'Albany', total: 12, buckets: [
                { range: '0-3', count: 2, percentage: 17 },
                { range: '3-5', count: 3, percentage: 25 },
                { range: '5-10', count: 4, percentage: 33 },
                { range: '10-15', count: 2, percentage: 17 },
                { range: '15+', count: 1, percentage: 8 },
                { range: 'no_data', count: 0, percentage: 0 },
              ]},
              { suburb: 'Oteha', total: 8, buckets: [
                { range: '0-3', count: 1, percentage: 13 },
                { range: '3-5', count: 2, percentage: 25 },
                { range: '5-10', count: 3, percentage: 38 },
                { range: '10-15', count: 1, percentage: 13 },
                { range: '15+', count: 1, percentage: 13 },
                { range: 'no_data', count: 0, percentage: 0 },
              ]},
            ],
            northShore: {
              total: 20,
              buckets: [
                { range: '0-3', count: 3, percentage: 15 },
                { range: '3-5', count: 5, percentage: 25 },
                { range: '5-10', count: 7, percentage: 35 },
                { range: '10-15', count: 3, percentage: 15 },
                { range: '15+', count: 2, percentage: 10 },
                { range: 'no_data', count: 0, percentage: 0 },
              ],
            },
          }),
        }) as any;
      }
      if (url.includes('/api/admin/analytics/chart-data')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              monthlyData: [
                { period: '2025-01', periodRaw: '2025-01-01', cityMedian: 900000, citySales: 50, cityDays: 35, suburbs: { Oteha: { median: 1000000, sales: 10, days: 30 }, Albany: { median: 950000, sales: 8, days: 28 } } },
                { period: '2025-02', periodRaw: '2025-02-01', cityMedian: 920000, citySales: 55, cityDays: 33, suburbs: { Oteha: { median: 1100000, sales: 12, days: 28 }, Albany: { median: 960000, sales: 9, days: 26 } } },
                { period: '2025-03', periodRaw: '2025-03-01', cityMedian: 910000, citySales: 45, cityDays: 34, suburbs: { Oteha: { median: 1050000, sales: 8, days: 32 }, Albany: { median: 940000, sales: 7, days: 30 } } },
              ],
              quarterlyData: [
                { period: '2025-Q1', periodRaw: '2025-Q1', cityMedian: 910000, citySales: 150, cityDays: 34, suburbs: { Oteha: { median: 1050000, sales: 30, days: 30 }, Albany: { median: 950000, sales: 24, days: 28 } } },
              ],
            },
          }),
        }) as any;
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) as any;
    }) as any;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a dashboard overview with summary cards', async () => {
    render(<DashboardPage />);
    expect(await screen.findByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Total Leads')).toBeTruthy();
    expect(screen.getByText('High Priority')).toBeTruthy();
  });

  it('renders analytics content for super admins', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('Analytics')).toBeTruthy();
    expect(screen.getByText('Conversion Rate')).toBeTruthy();
  });

  it('renders Monthly Data section with suburb buttons', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('Analysis Data')).toBeTruthy();
    expect(screen.getAllByText('Oteha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Albany').length).toBeGreaterThanOrEqual(1);
  });

  it('shows new rich table column headers', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('Analysis Data')).toBeTruthy();
    expect(screen.getByText('Median Price')).toBeTruthy();
    expect(screen.getByText('List vs Sold')).toBeTruthy();
  });

  it('renders North Shore City button in monthly data section', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText(/North Shore/)).toBeTruthy();
  });

  it('renders downloads content for super admins', async () => {
    render(<DownloadsPage />);
    expect(await screen.findByRole('heading', { name: /Downloads/ })).toBeTruthy();
    expect(screen.getByText('Download Records')).toBeTruthy();
  });

  it('renders pdf manager content for super admins', async () => {
    render(<PDFManagerPage />);
    expect(await screen.findByText('Suburb PDF Manager')).toBeTruthy();
    expect(screen.getByText('Uploaded Reports')).toBeTruthy();
  });

  it('renders Last Sold Data For Sale table with suburb rows', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('Last Sold Data For Sale')).toBeTruthy();
    const albanyElements = screen.getAllByText('Albany');
    expect(albanyElements.length).toBeGreaterThanOrEqual(2);
    const otehaElements = screen.getAllByText('Oteha');
    expect(otehaElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('North Shore Total')).toBeTruthy();
  });

  it('applies dual-color highlighting (blue for recent, green for lifecycle)', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('Last Sold Data For Sale')).toBeTruthy();
    expect(screen.getByText('(33%)')).toBeTruthy();
    expect(screen.getByText('(38%)')).toBeTruthy();
  });

  it('shows Active column with total counts', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('Active')).toBeTruthy();
    const twelves = screen.getAllByText('12');
    expect(twelves.length).toBeGreaterThanOrEqual(1);
    const eights = screen.getAllByText('8');
    expect(eights.length).toBeGreaterThanOrEqual(1);
  });
});
