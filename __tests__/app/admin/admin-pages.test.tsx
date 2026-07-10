import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import BookingsPage from '../../../app/admin/bookings/page';
import OutreachPage from '../../../app/admin/outreach/page';

const mockPush = vi.fn();
let mockSession: { data: { user: { email: string; name?: string } } | null; status: 'authenticated' | 'loading' | 'unauthenticated' } = {
  data: { user: { email: 'nzmarie.com@gmail.com' } },
  status: 'authenticated',
};

vi.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonBookings: () => <div>Loading Bookings</div>,
  SkeletonOutreach: () => <div>Loading Outreach</div>,
}));

describe('Admin pages', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/bookings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: '1',
                client_name: 'John Smith',
                email: 'john@example.com',
                phone: '0210000000',
                property_address: '15 Marine Parade',
                region: 'Auckland',
                city: 'North Shore City',
                suburb: 'Takapuna',
                contact_status: 'new',
                priority: 'high',
                created_at: '2026-07-01T00:00:00.000Z',
                next_follow_up_at: '2026-07-02T00:00:00.000Z',
              },
            ],
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
            locationStats: [
              { region: 'Auckland', city: 'North Shore City', suburb: 'Northcross', count: 1 },
            ],
          }),
        }) as any;
      }

      if (url.includes('/api/admin/outreach')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: '10',
                louis_property_id: 'prop-1',
                property_address: '15 Marine Parade',
                suburb: 'Takapuna',
                status: 'PENDING',
                tracking_code: 'DM-ABC123',
                selected_by: 'nzmarie.com@gmail.com',
                selected_at: '2026-06-29T00:00:00.000Z',
              },
            ],
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
            suburbs: ['Takapuna'],
          }),
        }) as any;
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) as any;
    }) as any;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders booking status labels in a readable format', async () => {
    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeTruthy();
    });

    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('shows the booking summary and location filters', async () => {
    render(<BookingsPage />);

    expect(await screen.findByText('Total Bookings')).toBeTruthy();
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
    expect(screen.getByLabelText('Region')).toBeTruthy();
    expect(screen.getByLabelText('City / District')).toBeTruthy();
    expect(screen.getByLabelText('Suburb')).toBeTruthy();
  });

  it('updates city and suburb options based on the selected region and city', async () => {
    render(<BookingsPage />);

    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'Auckland' } });

    const citySelect = screen.getByLabelText('City / District') as HTMLSelectElement;
    expect(screen.getByRole('option', { name: 'North Shore City' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Wellington City' })).toBeNull();

    fireEvent.change(citySelect, { target: { value: 'North Shore City' } });

    const suburbSelect = screen.getByLabelText('Suburb') as HTMLSelectElement;
    expect(screen.getByRole('option', { name: 'Northcross' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Aro Valley' })).toBeNull();
    expect(suburbSelect.value).toBe('');
  });

  it('shows the mark as sent action for super admins', async () => {
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);
    const suburbGroup = await screen.findByRole('button', { name: /Takapuna/i });
    fireEvent.click(suburbGroup);

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(checkbox.checked).toBe(true);
      expect(screen.getByRole('button', { name: /Mark as Sent/i })).toBeTruthy();
    });
  });
});
