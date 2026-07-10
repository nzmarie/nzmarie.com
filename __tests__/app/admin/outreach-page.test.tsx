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
