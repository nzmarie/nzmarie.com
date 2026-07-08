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
        description: 'Beautiful home with sea views',
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
  default: ({ onChange, value, placeholder }: { onChange: (v: string) => void; value: string; placeholder?: string }) => (
    <input
      data-testid="address-autocomplete"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonProperties: () => <div>Loading Properties</div>,
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) => {
    const { unoptimized, onError, ...safeProps } = rest;
    void unoptimized;
    void onError;
    return <img src={src} alt={alt} {...safeProps} />;
  },
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

  it('shows a truncated description at the bottom of the property card', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const description = await screen.findByTitle('Beautiful home with sea views');
    expect(description).toBeDefined();
    expect(description.textContent).toContain('Beautiful…');
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

describe('Properties Page - Edit Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Edit button on each property card', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      expect(editButtons.length).toBe(2);
    });
  });

  it('opens edit modal when Edit button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
      expect(screen.getByDisplayValue('15 Marine Parade')).toBeDefined();
      expect(screen.getByDisplayValue('Takapuna')).toBeDefined();
    });
  });

  it('pre-fills form fields with current property data', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('15 Marine Parade')).toBeDefined();
      expect(screen.getByDisplayValue('Takapuna')).toBeDefined();
    });
  });

  it('calls PATCH API with updated data when Save Changes is clicked', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
    });

    const addressInput = screen.getByDisplayValue('15 Marine Parade') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '16 Marine Parade' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/properties/prop-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.address).toBe('16 Marine Parade');
    expect(body.suburb).toBe('Takapuna');
  });

  it('shows success notification after successful edit', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Property updated successfully')).toBeDefined();
    });
  });

  it('shows error notification on failed edit', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Update failed' }),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeDefined();
    });
  });

  it('closes modal when Cancel is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Edit Property')).toBeNull();
    });
  });
});
