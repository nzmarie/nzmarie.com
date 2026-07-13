'use client';

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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

    render(<OutreachPage />);

    expect(await screen.findByText('📬 Outreach')).toBeTruthy();
    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);
    const suburbButton = await screen.findByRole('button', { name: /Takapuna/i });
    fireEvent.click(suburbButton);

    expect(await screen.findByText('15 Marine Parade')).toBeTruthy();
    expect(screen.getByRole('button', { name: /✓ Sent/i })).toBeTruthy();
  });

  it('marks a pending address as sent when row button clicked', async () => {
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
      })
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      });

    window.confirm = vi.fn().mockReturnValue(true);

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);
    const suburbButton = await screen.findByRole('button', { name: /Takapuna/i });
    fireEvent.click(suburbButton);

    const sentButton = await screen.findByRole('button', { name: /✓ Sent/i });
    fireEvent.click(sentButton);

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
    },
    {
      id: 'out-2',
      property_address: '22 Beach Road',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'liked',
      created_at: '2026-07-02T10:00:00Z',
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

    await waitFor(() => expect(screen.getByText('Liked')).toBeDefined());

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

    await waitFor(() => expect(screen.getByText('Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const firstBtns = buttons.filter(b => b.textContent === '≪');
      firstBtns.forEach(b => expect(b.disabled).toBe(true));
    });
  });

  it('switches back to infinite mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('Liked')).toBeDefined());

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

    await waitFor(() => expect(screen.getByText('Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 20 of 45 properties/).length).toBeGreaterThanOrEqual(2);
    });
  });
});
