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

  it('renders downloads content for super admins', async () => {
    render(<DownloadsPage />);
    expect(await screen.findByText('Downloads')).toBeTruthy();
    expect(screen.getByText('Recent Downloads')).toBeTruthy();
  });

  it('renders pdf manager content for super admins', async () => {
    render(<PDFManagerPage />);
    expect(await screen.findByText('Suburb PDF Manager')).toBeTruthy();
    expect(screen.getByText('Uploaded Reports')).toBeTruthy();
  });
});
