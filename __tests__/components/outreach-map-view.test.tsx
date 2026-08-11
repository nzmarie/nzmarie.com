import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@vis.gl/react-google-maps', () => {
  const LatLngBounds = class {
    extend() {
      return this;
    }
  };
  const mockMap = {
    fitBounds: vi.fn(),
    setZoom: vi.fn(),
    setCenter: vi.fn(),
    getZoom: vi.fn(() => 14),
    addListener: vi.fn(() => () => {}),
    setMap: vi.fn(),
  };
  return {
    APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Map: ({ children }: { children: React.ReactNode }) => <div data-testid="map-canvas">{children}</div>,
    useMap: () => mockMap,
    useMapsLibrary: () => null,
    LatLngBounds,
  };
});

vi.mock('@googlemaps/markerclusterer', () => {
  return {
    MarkerClusterer: class {
      constructor() {}
      setMap() {}
    },
  };
});

import OutreachMapView from '../../app/admin/outreach/components/OutreachMapView';

const mockFitBounds = vi.fn();

function coordsPayload(runs: Array<{ runId: number; totalPending: number }>) {
  return {
    success: true,
    suburb: 'Torbay',
    groups: [
      {
        suburb: 'Torbay',
        streets: [
          {
            street: 'Glamorgan Drive',
            suburb: 'Torbay',
            anchorLat: -36.69,
            anchorLng: 174.74,
            pendingCount: 12,
            runId: 1,
            addressCoords: [
              { address: '1 Glamorgan Drive', lat: -36.69, lng: 174.74, sent: false, status: 'unsent' },
            ],
          },
        ],
      },
    ],
    runs,
    unclusteredStreets: [],
    budget: 20,
    radius: 500,
    startStreet: 'Glamorgan Drive',
    allStreets: [{ street: 'Glamorgan Drive', count: 12 }],
  };
}

function installMockMap() {
  const map = {
    fitBounds: mockFitBounds,
    setZoom: vi.fn(),
    setCenter: vi.fn(),
    getZoom: vi.fn(() => 12),
    addListener: vi.fn(() => () => {}),
    setMap: vi.fn(),
  };
  const MarkerMock = class {
    map: unknown = null;
    position: unknown;
    title = '';
    zIndex = 0;
    icon: unknown = null;
    listeners: Record<string, () => void> = {};
    constructor(opts: { map?: unknown; position?: unknown; icon?: unknown; title?: string; zIndex?: number }) {
      this.map = opts.map ?? null;
      this.position = opts.position;
      this.title = opts.title ?? '';
      this.zIndex = opts.zIndex ?? 0;
      this.icon = opts.icon ?? null;
    }
    addListener(name: string, fn: () => void) {
      this.listeners[name] = fn;
      return { remove: () => {} };
    }
    setMap(map: unknown) {
      this.map = map;
    }
  };
  (globalThis.google as any) = {
    maps: {
      LatLngBounds: class {
        extend() {
          return this;
        }
      },
      LatLng: class {},
      SymbolPath: { CIRCLE: 'CIRCLE' },
      Marker: MarkerMock,
      event: { removeListener: vi.fn(), addListenerOnce: vi.fn() },
    },
  };
  return map;
}

beforeEach(() => {
  mockFitBounds.mockReset();
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-gmaps-key';
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID = 'test-map-id';
  (globalThis.google as any) = undefined;
  global.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('OutreachMapView', () => {
  it('shows a placeholder when no suburb is selected', () => {
    render(
      <OutreachMapView
        suburb=""
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Select a report to view the delivery map.')).toBeTruthy();
  });

  it('shows unavailable message when the API key is missing', () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/Map unavailable/)).toBeTruthy();
  });

  it('fetches address coords with the sent status and address_coords flag', async () => {
    installMockMap();
    const fetchMock = vi.fn(async (url: RequestInfo) => {
      return {
        ok: true,
        json: async () => coordsPayload([{ runId: 1, totalPending: 12 }]),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      const called = fetchMock.mock.calls.map((c) => String(c[0]));
      const url = called.find((u) => u.includes('/api/admin/outreach/street-clusters'));
      expect(url).toBeTruthy();
      expect(url).toContain('suburb=Torbay');
      expect(url).toContain('sent_status=unsent');
      expect(url).toContain('address_coords=true');
    });
  });

  it('includes report_quarter in the coords request when provided', async () => {
    installMockMap();
    const fetchMock = vi.fn(async (url: RequestInfo) => {
      return {
        ok: true,
        json: async () => coordsPayload([{ runId: 1, totalPending: 12 }]),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="all"
        reportQuarter="2026-Q2"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      const called = fetchMock.mock.calls.map((c) => String(c[0]));
      const url = called.find((u) => u.includes('/api/admin/outreach/street-clusters'));
      expect(url).toContain('sent_status=all');
      expect(url).toContain('report_quarter=2026-Q2');
    });
  });

  it('renders map canvas and status legend', async () => {
    installMockMap();
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => coordsPayload([
          { runId: 1, totalPending: 12 },
          { runId: 2, totalPending: 8 },
        ]),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={1}
        sentStatus="unsent"
        reportQuarter="2026-Q2"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    expect(await screen.findByTestId('map-canvas')).toBeTruthy();
    expect(screen.getByText('Unsent')).toBeTruthy();
  });

  it('shows an inline error when the coords request fails', async () => {
    installMockMap();
    const fetchMock = vi.fn(async () => {
      return { ok: false, json: async () => ({}) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    expect(await screen.findByText('Failed to fetch coords')).toBeTruthy();
  });
});