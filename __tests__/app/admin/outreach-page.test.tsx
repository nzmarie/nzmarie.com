'use client';

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OutreachPage from '../../../app/admin/outreach/page';

const mockPush = vi.fn();
let mockSession: { data: { user: { email: string } } | null; status: 'authenticated' | 'loading' | 'unauthenticated' } = {
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
  SkeletonOutreach: () => <div>Loading Outreach</div>,
}));

vi.mock('@/components/admin/InlineAddressInput', () => ({
  default: () => <div data-testid="inline-input" />,
}));

vi.mock('@/components/property/AddressAutocomplete', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="address-autocomplete" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('@/lib/geo-data', () => ({
  getAllSuburbs: () => ['Takapuna'],
}));

describe('Outreach page', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('renders pending address row and shows mark as sent button', async () => {
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?') && s.includes('status=pending')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'out-1',
                property_address: '15 Marine Parade',
                suburb: 'Takapuna',
                city: 'Auckland',
                region: 'North Shore',
                status: 'PENDING',
                created_at: '2026-07-01T10:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      });
    });

    render(<OutreachPage />);

    expect(await screen.findByText('📬 Outreach')).toBeTruthy();
    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);
    const suburbHeader = await screen.findByText(/Takapuna/i);
    expect(suburbHeader).toBeTruthy();

    expect(await screen.findByText('15 Marine Parade')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /✓ Sent/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('marks a pending address as sent when row button clicked', async () => {
    let markedSent = false;
    (global.fetch as any) = vi.fn((url: RequestInfo, init?: RequestInit) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach/out-1/mark-sent')) {
        markedSent = true;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'out-1',
              status: 'SENT',
              sent_by: 'nzlouis.com@gmail.com',
              sent_at: '2026-07-02T12:00:00Z',
            },
          }),
        });
      }
      if (s.includes('/api/admin/outreach?') && s.includes('status=pending')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: markedSent ? [] : [
              {
                id: 'out-1',
                property_address: '15 Marine Parade',
                suburb: 'Takapuna',
                city: 'Auckland',
                region: 'North Shore',
                status: 'PENDING',
                created_at: '2026-07-01T10:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 50, total: markedSent ? 0 : 1, totalPages: markedSent ? 0 : 1 },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      });
    });

    window.confirm = vi.fn().mockReturnValue(true);

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);
    const suburbHeader = await screen.findByText(/Takapuna/i);
    expect(suburbHeader).toBeTruthy();

    const sentButtons = await screen.findAllByRole('button', { name: /✓ Sent/i });
    const rowSentButton = sentButtons[sentButtons.length - 1];
    fireEvent.click(rowSentButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/outreach/out-1/mark-sent', { method: 'PATCH' });
      expect(screen.queryByText('15 Marine Parade')).toBeNull();
    });
  });
});

describe('Outreach page - Dual Pagination Mode', () => {
  const mockItems = [
    {
      id: 'out-1',
      property_address: '15 Marine Parade',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'liked',
      created_at: '2026-07-01T10:00:00Z',
      no_junk_mail: false,
      joined_property_id: 'prop-1',
      build_year: 1990,
    },
    {
      id: 'out-2',
      property_address: '22 Beach Road',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'liked',
      created_at: '2026-07-02T10:00:00Z',
      no_junk_mail: true,
      joined_property_id: 'prop-2',
      build_year: 1985,
    },
  ];

  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('renders segmented control with Infinite Scroll and Classic Pages buttons', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getByText('Infinite Scroll')).toBeDefined();
      expect(screen.getByText('Classic Pages')).toBeDefined();
    });
  });

  it('shows counter text in infinite mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 2 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('switches to classic mode and shows page controls', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const prevBtns = buttons.filter(b => b.textContent === '‹');
      expect(prevBtns.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('disables prev/first buttons on page 1 in classic mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const firstBtns = buttons.filter(b => b.textContent === '≪');
      firstBtns.forEach(b => expect((b as HTMLButtonElement).disabled).toBe(true));
    });
  });

  it('switches back to infinite mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const prevBtns = buttons.filter(b => b.textContent === '‹');
      expect(prevBtns.length).toBeGreaterThanOrEqual(1);
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Infinite Scroll'));

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 2 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows counter with range in classic mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 18 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Outreach page - Liked icon on card image', () => {
  const mockItems = [
    {
      id: 'out-1',
      property_address: '15 Marine Parade',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'liked',
      created_at: '2026-07-01T10:00:00Z',
      image_url: '/static/media/no-photo-available.png',
      no_junk_mail: false,
      joined_property_id: 'prop-1',
      build_year: 1990,
    },
  ];

  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });
    window.confirm = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('shows "No Image Available" placeholder when image_url is no-photo-available', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());
    expect(await screen.findByText('No Image Available')).toBeDefined();
  });

  it('does NOT render a standalone unlike (♥/♡) button on the image in liked tab', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    // The old standalone heart button with title "Unlike"/"Like" must be gone.
    expect(screen.queryByTitle('Unlike')).toBeNull();
    expect(screen.queryByTitle('Like')).toBeNull();

    // Instead the liked icon is a pure red heart button.
    expect(screen.getByTitle('取消喜欢 / Unlike')).toBeDefined();
  });

  it('clicking the liked icon removes the record via DELETE without full refresh', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    const likedIcon = screen.getByTitle('取消喜欢 / Unlike');
    fireEvent.click(likedIcon);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/outreach/out-1', { method: 'DELETE' });
    });

    // After removal the property card text disappears (no page reload).
    await waitFor(() => {
      expect(screen.queryByText('15 Marine Parade')).toBeNull();
    });
  });

  it('does not delete when confirmation is cancelled', async () => {
    window.confirm = vi.fn().mockReturnValue(false);

    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    fireEvent.click(screen.getByTitle('取消喜欢 / Unlike'));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });

    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/outreach/out-1', { method: 'DELETE' });
    // Item remains on the page.
    expect(screen.getByText('15 Marine Parade')).toBeDefined();
  });

  it('rolls back the removal if the DELETE request fails', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Failed' }) });

    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    fireEvent.click(screen.getByTitle('取消喜欢 / Unlike'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/outreach/out-1', { method: 'DELETE' });
    });

    // Item should be restored (rollback) since the request failed.
    await waitFor(() => {
      expect(screen.getByText('15 Marine Parade')).toBeDefined();
    });
  });

  it('toggles no_junk_mail optimistically on outreach card', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    const noJunkBtn = screen.getByTitle('Click to mark No Junk');
    expect(noJunkBtn).toBeDefined();

    fireEvent.click(noJunkBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/properties/prop-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_junk_mail: true }),
      });
    });
  });

  it('card view content area has 16px padding', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    const cards = document.querySelectorAll('[style*="padding: 16px"]');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Outreach page - List view mobile layout', () => {
  const mockItems = [
    {
      id: 'out-1',
      property_address: '15 Marine Parade',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'pending',
      created_at: '2026-07-01T10:00:00Z',
      no_junk_mail: false,
      joined_property_id: 'prop-1',
    },
    {
      id: 'out-2',
      property_address: '22 Beach Road',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'pending',
      created_at: '2026-07-02T10:00:00Z',
      no_junk_mail: false,
      joined_property_id: 'prop-2',
    },
  ];

  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?') && s.includes('status=pending')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 50, total: 2, totalPages: 1 } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }),
      });
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('renders address next to checkbox in list view', async () => {
    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);

    await waitFor(() => {
      expect(screen.getByText('15 Marine Parade')).toBeDefined();
    });

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);

    const addr = screen.getByText('15 Marine Parade');
    expect(addr.className).toContain('truncate');
  });

  it('shows action buttons in a separate wrapped container below address', async () => {
    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);

    await waitFor(() => {
      expect(screen.getByText('15 Marine Parade')).toBeDefined();
    });

    const sentBtns = screen.getAllByText('✓ Sent');
    expect(sentBtns.length).toBeGreaterThanOrEqual(1);

    const likedBtns = screen.getAllByText('↩ Liked');
    expect(likedBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('does not loop when classic mode restores an empty cached page', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      });

    render(<OutreachPage />);
    await screen.findByRole('button', { name: /☰ List/i });

    const classicBtn = await screen.findByRole('button', { name: /Classic Pages/i });
    fireEvent.click(classicBtn);

    // If the render-phase setState loop existed, React would throw
    // "Too many re-renders" before this assertion runs.
    expect(screen.getByRole('button', { name: /☰ List/i })).toBeDefined();
  });

  it('auto-selects the default report after reports are loaded', async () => {
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, defaultReport: { suburb: 'Oteha', label: '2026-Q2' } }),
        });
      }
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            reports: [
              { suburb: 'Oteha', quarter: 'Q2', year: 2026, id: 'r1' },
              { suburb: 'Torbay', quarter: 'Q1', year: 2026, id: 'r2' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '★ Default' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Oteha ★' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-Q2 ★' })).toBeTruthy();
  });

  it('sets the selected report as default via the button', async () => {
    let postedBody: { suburb?: string; label?: string } | null = null;
    (global.fetch as any) = vi.fn((url: RequestInfo, init?: RequestInit) => {
      const s = String(url || '');
      if (s.includes('/api/admin/outreach/default-report')) {
        if (init?.method === 'POST') {
          postedBody = JSON.parse(String(init.body));
          return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: postedBody }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            reports: [{ suburb: 'Oteha', quarter: 'Q2', year: 2026, id: 'r1' }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const reportSection = (await screen.findByText('📋 Filter by Report')).closest('div') as HTMLElement;
    fireEvent.click(await within(reportSection).findByRole('button', { name: 'Oteha' }));
    fireEvent.click(await within(reportSection).findByRole('button', { name: '2026-Q2' }));

    const setBtn = await within(reportSection).findByRole('button', { name: '☆ Set as default report' });
    fireEvent.click(setBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '★ Default' })).toBeTruthy();
    });
    expect(postedBody).toEqual({ suburb: 'Oteha', label: '2026-Q2' });
  });

  it('filters sent properties by sent date via calendar', async () => {
    const calls: string[] = [];
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      calls.push(s);
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'out-s-1',
              property_address: '10 Sent St',
              suburb: 'Takapuna',
              city: 'Auckland',
              region: 'North Shore',
              status: 'sent',
              created_at: '2026-07-01T10:00:00Z',
              sent_at: '2026-07-02T12:00:00Z',
            },
          ],
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        }),
      });
    });

    render(<OutreachPage />);

    const sentTab = await screen.findByRole('button', { name: /✓ Sent/i });
    fireEvent.click(sentTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    await waitFor(() => {
      const sentFetch = calls.find(c => c.includes('/api/admin/outreach?') && c.includes('status=sent'));
      expect(sentFetch).toBeTruthy();
      expect(sentFetch).toContain('sent_dates=');
    });
  });
});
