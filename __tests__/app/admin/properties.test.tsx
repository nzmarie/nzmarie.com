import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSession = { user: { email: 'nzmarie.com@gmail.com' } };
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockSession, status: 'authenticated' }),
}));

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: () => ({
    data: { pages: [[
      {
        id: 'prop-1',
        address: '15 Marine Parade',
        suburb: 'Takapuna',
        city: 'North Shore City',
        bedrooms: 4,
        bathrooms: 2,
        garages: 2,
        rv: 1200000,
        last_sold_price: 1150000,
        last_sold_date: '2023-01-15',
        image_url: 'https://example.com/image.jpg',
        property_url: 'https://example.com/prop1',
      },
      {
        id: 'prop-2',
        address: '28 Sunset Road',
        suburb: 'Albany',
        city: 'North Shore City',
        bedrooms: 3,
        bathrooms: 2,
        garages: 1,
        rv: 950000,
        last_sold_price: 920000,
        last_sold_date: '2022-11-20',
        image_url: 'https://example.com/image2.jpg',
        property_url: 'https://example.com/prop2',
      }
    ]] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }),
  keepPreviousData: vi.fn(),
}));

vi.mock('@/components/property/AddressAutocomplete', () => ({
  default: ({ onChange, value }: any) => (
    <input
      data-testid="address-autocomplete"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonProperties: () => <div>Loading Properties</div>,
}));

global.fetch = vi.fn();

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

describe('Properties Page - Batch Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('can toggle select mode', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    expect(selectModeButton).toBeDefined();

    fireEvent.click(selectModeButton);

    await waitFor(() => {
      expect(screen.getByText('✓ Select Mode')).toBeDefined();
      expect(screen.getByText(/Selected: 0 properties/i)).toBeDefined();
    });
  });

  it('can select individual properties', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    fireEvent.click(selectModeButton);

    await waitFor(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(screen.getByText(/Selected: 1 properties/i)).toBeDefined();
    });
  });

  it('can select all properties', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    fireEvent.click(selectModeButton);

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeDefined();
    });

    const selectAllButton = screen.getByText('Select All');
    fireEvent.click(selectAllButton);

    await waitFor(() => {
      expect(screen.getByText(/Selected: 2 properties/i)).toBeDefined();
    });
  });

  it('can clear selection', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    fireEvent.click(selectModeButton);

    await waitFor(() => {
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Selected: 2 properties/i)).toBeDefined();
    });

    const clearButton = screen.getAllByText('Clear All')[0];
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText(/Selected:/i)).toBeNull();
    });
  });

  it('shows Add to Outreach button when properties selected', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    fireEvent.click(selectModeButton);

    await waitFor(() => {
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Add to Outreach')).toBeDefined();
    });
  });

  it('opens confirmation modal when Add to Outreach clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    fireEvent.click(selectModeButton);

    await waitFor(() => {
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);
    });

    const addButton = await screen.findByText('Add to Outreach');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add Properties to Outreach')).toBeDefined();
      expect(screen.getByText(/You are about to add 2 properties/i)).toBeDefined();
      expect(screen.getByText('Selected suburbs:')).toBeDefined();
    });
  });

  it('calls API when confirming add to outreach', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        added: 2,
        skipped: 0,
        message: 'Added 2 properties to outreach queue',
      }),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    fireEvent.click(selectModeButton);

    await waitFor(() => {
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);
    });

    const addButton = await screen.findByText('Add to Outreach');
    fireEvent.click(addButton);

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirm & Add');
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/outreach/batch-add',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  it('shows success notification after successful add', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        added: 2,
        skipped: 0,
        message: 'Added 2 properties to outreach queue',
      }),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    fireEvent.click(selectModeButton);

    await waitFor(() => {
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);
    });

    const addButton = await screen.findByText('Add to Outreach');
    fireEvent.click(addButton);

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirm & Add');
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Added 2 properties to outreach queue/i)).toBeDefined();
    });
  });

  it('shows error notification on API failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Database connection failed',
      }),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    fireEvent.click(selectModeButton);

    await waitFor(() => {
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);
    });

    const addButton = await screen.findByText('Add to Outreach');
    fireEvent.click(addButton);

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirm & Add');
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Database connection failed/i)).toBeDefined();
    });
  });

  it('can cancel modal', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const selectModeButton = await screen.findByText(/Select Mode/i);
    fireEvent.click(selectModeButton);

    await waitFor(() => {
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);
    });

    const addButton = await screen.findByText('Add to Outreach');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add Properties to Outreach')).toBeDefined();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Add Properties to Outreach')).toBeNull();
    });
  });
});
