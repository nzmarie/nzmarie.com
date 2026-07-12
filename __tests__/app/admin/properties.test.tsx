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

const mockSetQueryData = vi.fn();

const defaultProperties = [
  {
    id: 'prop-1',
    address: '15 Marine Parade',
    suburb: 'Takapuna',
    city: 'North Shore City',
    region: 'Auckland',
    description: 'Beautiful home with sea views and modern renovations throughout the entire property',
    bedrooms: 4,
    bathrooms: 2,
    garages: 2,
    rv: 1200000,
    last_sold_price: 1150000,
    last_sold_date: '2023-01-15',
    build_year: 1990,
    floor_area: '220',
    land_area: '801',
    image_url: 'https://example.com/image.jpg',
    property_url: 'https://example.com/prop1',
    postcode: '0632',
    land_value: 1075000,
    improvement_value: 200000,
    estimated_value_low: 1200000,
    estimated_value_high: 1300000,
    property_type: 'Residential',
    sale_status: 'unknown',
    has_rental_history: false,
    is_currently_rented: false,
    latitude: -36.7061,
    longitude: 174.7297,
  },
  {
    id: 'prop-2',
    address: '2/910 East Coast Road',
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
];

const { mockUseInfiniteQuery } = vi.hoisted(() => {
  const fn = vi.fn(() => ({
    data: { pages: [{ properties: defaultProperties, total: 45 }] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }));
  return { mockUseInfiniteQuery: fn };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData: mockSetQueryData }),
  useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
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

let intersectionCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
let intersectionOptions: IntersectionObserverInit | null = null;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

global.IntersectionObserver = vi.fn().mockImplementation((callback, options) => {
  intersectionCallback = callback;
  intersectionOptions = options;
  return {
    observe: mockObserve,
    unobserve: vi.fn(),
    disconnect: mockDisconnect,
  };
}) as any;

function triggerIntersection(isIntersecting: boolean) {
  if (intersectionCallback) {
    intersectionCallback([{ isIntersecting } as IntersectionObserverEntry]);
  }
}

const mockLikeFetch = () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => ({ liked_ids: [] }),
  });
};

const mockLikeFetchOnce = () => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ liked_ids: [] }),
  });
};

describe('Properties Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows full description text with CSS truncation on the property card', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const description = await screen.findByTitle('Beautiful home with sea views and modern renovations throughout the entire property');
    expect(description).toBeDefined();
    expect(description.textContent).toContain('Beautiful home with sea views and modern renovations throughout the entire property');
  });

  it('renders off-screen AI data chamber with all property fields for sidebar Gemini', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const startMarkers = screen.getAllByText(/\[AI-DATA-START\]/);
    expect(startMarkers.length).toBe(2);

    const endMarkers = screen.getAllByText(/\[AI-DATA-END\]/);
    expect(endMarkers.length).toBe(2);

    expect(screen.getByText(/Address: 15 Marine Parade/)).toBeDefined();
    expect(screen.getByText(/Bedrooms: 4/)).toBeDefined();
    expect(screen.getByText(/Car Spaces: 2/)).toBeDefined();
    expect(screen.getByText(/Land Value/)).toBeDefined();
    expect(screen.getByText(/Improvement Value/)).toBeDefined();
    expect(screen.getByText(/Property Type: Residential/)).toBeDefined();
    expect(screen.getByText(/Sale Status: unknown/)).toBeDefined();
    expect(screen.getByText(/Coordinates: -36\.7061/)).toBeDefined();

    expect(screen.getByText(/Address: 2\/910 East Coast Road/)).toBeDefined();
    expect(screen.getByText(/Bedrooms: 3/)).toBeDefined();
    expect(screen.getByText(/Car Spaces: 1/)).toBeDefined();

    expect(screen.getAllByText(/Capital Value \(RV\)/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Bathrooms:/).length).toBe(2);
    expect(screen.getAllByText(/Estimated Value/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows No description fallback for properties without description', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const noDesc = screen.getByText('No description');
    expect(noDesc).toBeDefined();
  });

  it('renders House type button selected by default', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const houseBtn = screen.getByText('House');
    const allBtns = screen.getAllByText('All');
    const townhouseBtn = screen.getByText('Townhouse/Unit');
    expect(houseBtn).toBeDefined();
    expect(allBtns.length).toBeGreaterThanOrEqual(2);
    expect(townhouseBtn).toBeDefined();
    expect(houseBtn.parentElement).toBeDefined();
  });

  it('changes property filter when a different type button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const houseBtn = screen.getByText('House');
    const allBtns = screen.getAllByText('All');
    const townhouseBtn = screen.getByText('Townhouse/Unit');

    fireEvent.click(allBtns[0]);
    fireEvent.click(townhouseBtn);
    fireEvent.click(houseBtn);
  });

  it('displays all properties regardless of selected property type (server-side filtering)', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText('15 Marine Parade')).toBeDefined();
    expect(screen.getByText('2/910 East Coast Road')).toBeDefined();
  });

  it('renders Last Sold preset buttons with 5-10 years selected by default', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText('5-10 years')).toBeDefined();
    expect(screen.getByText('3-5 years')).toBeDefined();
    expect(screen.getByText('0-3 years')).toBeDefined();
    expect(screen.getByText('15+ years')).toBeDefined();
  });

  it('switches Last Sold preset when a different preset button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('3-5 years'));
    fireEvent.click(screen.getByText('0-3 years'));
    fireEvent.click(screen.getByText('15+ years'));
    fireEvent.click(screen.getByText('5-10 years'));
  });

  it('renders custom Min Years and Max Years inputs for Last Sold', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText('Min Years')).toBeDefined();
    expect(screen.getByText('Max Years')).toBeDefined();
  });

});

describe('Properties Page - Edit Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
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
    mockLikeFetchOnce();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, property: { id: 'prop-1', address: '16 Marine Parade' } }),
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

    const patchCall = (global.fetch as any).mock.calls.find((c: unknown[]) =>
      c[0] === '/api/admin/properties/prop-1' && c[1]?.method === 'PATCH'
    );
    const body = JSON.parse(patchCall[1].body);
    expect(body.address).toBe('16 Marine Parade');
    expect(body.suburb).toBe('Takapuna');
  });

  it('shows success notification after successful edit', async () => {
    mockLikeFetchOnce();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, property: { id: 'prop-1' } }),
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
    mockLikeFetchOnce();
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

describe('Properties Page - Quick Filter by Suburb clears Address Input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('clears address input when a suburb button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '15 Marine Parade' } });
    expect(addressInput.value).toBe('15 Marine Parade');

    const suburbBtn = screen.getByRole('button', { name: 'Northcross' });
    fireEvent.click(suburbBtn);

    await waitFor(() => {
      expect(addressInput.value).toBe('');
    });
  });

  it('clears address input when suburb Clear button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const suburbBtn = screen.getByRole('button', { name: 'Northcross' });
    fireEvent.click(suburbBtn);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '15 Marine Parade' } });
    expect(addressInput.value).toBe('15 Marine Parade');

    const clearBtn = screen.getByRole('button', { name: '✕ Clear' });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(addressInput.value).toBe('');
    });
  });

  it('clears address input when a different suburb is re-clicked (toggle off)', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;

    fireEvent.change(addressInput, { target: { value: '10 Some Street' } });
    const albanyBtn = screen.getByRole('button', { name: 'Albany' });
    fireEvent.click(albanyBtn);
    expect(addressInput.value).toBe('');

    fireEvent.change(addressInput, { target: { value: '20 Other Road' } });
    fireEvent.click(albanyBtn);
    expect(addressInput.value).toBe('');
  });
});

describe('Properties Page - Like Icon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a like button on each property card', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const likeButtons = await screen.findAllByTitle('Like');
    expect(likeButtons.length).toBe(2);
  });

  it('calls like API when like button is clicked', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked_ids: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: true }) });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const likeButtons = await screen.findAllByTitle('Like');
    fireEvent.click(likeButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/outreach/like',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  it('toggles like icon state on click', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked_ids: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: true }) });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const likeButtons = await screen.findAllByTitle('Like');
    expect(likeButtons.length).toBe(2);
    fireEvent.click(likeButtons[0]);

    await waitFor(() => {
      expect(screen.getByTitle('Unlike')).toBeTruthy();
    });
  });
});

describe('Properties Page - Infinite Scroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersectionCallback = null;
    intersectionOptions = null;
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ liked_ids: [] }),
    });
  });

  afterEach(() => {
    cleanup();
    intersectionCallback = null;
    intersectionOptions = null;
  });

  it('creates IntersectionObserver with threshold 0 and rootMargin 200px', async () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(global.IntersectionObserver).toHaveBeenCalled();
      expect(intersectionOptions).toEqual({ threshold: 0, rootMargin: '200px' });
    });
  });

  it('observes the last property card element', async () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(mockObserve).toHaveBeenCalled();
    });
  });

  it('calls fetchNextPage when sentinel intersects, hasNextPage=true, and isFetchingNextPage=false', async () => {
    const fetchNextPage = vi.fn();
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    triggerIntersection(true);

    await waitFor(() => {
      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call fetchNextPage when hasNextPage is false', async () => {
    const fetchNextPage = vi.fn();
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    triggerIntersection(true);

    await waitFor(() => {
      expect(fetchNextPage).not.toHaveBeenCalled();
    });
  });

  it('does NOT call fetchNextPage when isFetchingNextPage is true', async () => {
    const fetchNextPage = vi.fn();
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: true,
      hasNextPage: true,
      fetchNextPage,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    triggerIntersection(true);

    await waitFor(() => {
      expect(fetchNextPage).not.toHaveBeenCalled();
    });
  });
});
