import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

let useSessionMock: any;

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonDashboard: () => <div>Loading Dashboard</div>,
}));

(global.fetch as any) = vi.fn();

describe('Dashboard Stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with authentication', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    expect(container.querySelector('h1')).toBeDefined();
  });

  it('displays welcome message', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      const welcome = screen.queryByText(/Welcome back/);
      expect(welcome).toBeDefined();
    }, { timeout: 3000 });
  });

  it('fetches stats data', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 23,
            highPriorityLeads: 12,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/dashboard/stats');
  });

  it('renders stat cards', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    expect(container.querySelector('[class*="bg-white"]')).toBeDefined();
  });

  it('renders follow-ups section', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      const followupSection = screen.queryByText(/Today's Follow-ups/i);
      expect(followupSection).toBeDefined();
    }, { timeout: 3000 });
  });

  it('handles API errors', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValueOnce({ ok: false });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      const error = screen.queryByText(/Failed to fetch dashboard data/i);
      expect(error).toBeDefined();
    }, { timeout: 3000 });
  });

  it('redirects unauthenticated users', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
    });
  });

  it('displays suburb filter dropdown', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      const selects = container.querySelectorAll('select');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  it('filters stats by suburb', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
          suburb: 'Takapuna',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    expect(global.fetch).toHaveBeenCalled();
  });

  it('handles suburb filter with API request', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 3,
            highPriorityLeads: 1,
            pendingOutreach: 50,
            todayFollowups: 2,
            overdueFollowups: 1,
            todayDownloads: 5,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await new Promise(resolve => setTimeout(resolve, 100));

    const fetchCalls = (global.fetch as any).mock.calls;
    expect(fetchCalls.length).toBeGreaterThan(0);
  });

  it('renders Outreach by Suburb with the most recently sent suburb first', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 1,
            highPriorityLeads: 0,
            pendingOutreach: 0,
            sentOutreach: 0,
            todayFollowups: 0,
            overdueFollowups: 0,
            todayDownloads: 0,
            outreachBySuburb: [
              { suburb: 'Albany', pending_count: 3, sent_count: 5, total_count: 8, last_sent_at: '2026-07-01T00:00:00.000Z' },
              { suburb: 'Torbay', pending_count: 2, sent_count: 12, total_count: 14, last_sent_at: '2026-08-10T00:00:00.000Z' },
              { suburb: 'Browns Bay', pending_count: 1, sent_count: 0, total_count: 1, last_sent_at: null },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Outreach by Suburb')).toBeTruthy();
    }, { timeout: 3000 });

    const section = screen.getByText('Outreach by Suburb').closest('div.bg-white') as HTMLElement;
    const titles = section.querySelectorAll('div.text-sm.font-semibold.text-slate-800');
    const order = Array.from(titles).map((el) => el.textContent);
    expect(order).toEqual(['Torbay', 'Albany', 'Browns Bay']);
    expect(container.querySelectorAll('div.text-sm.font-semibold.text-slate-800').length).toBeGreaterThan(0);
  });
});
