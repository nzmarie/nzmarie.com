import { parseHouseNumber, OrderableStreet } from './street-ordering';

export interface AddressRow {
  street: string;
  house_number: string | number | null;
  property_address: string;
  lat: string | number | null;
  lng: string | number | null;
  id?: string | null;
  no_junk_mail?: boolean | null;
  sent?: boolean | null;
}

export interface StreetSummary {
  street: string;
  suburb: string;
  address_count: number;
  has_coords: boolean;
  minHouseNumber: number | null;
  anchorLat: number | null;
  anchorLng: number | null;
  addresses: string[];
  // Optional per-address coordinates and status (only when requested)
  addressCoords?: Array<{
    address: string;
    lat: number;
    lng: number;
    sent: boolean;
    status: 'unsent' | 'sent' | 'junk';
  }>;
}

export function buildStreetSummaries(rows: AddressRow[], suburb: string, includeAddressCoords: boolean = false): StreetSummary[] {
  const map = new Map<string, StreetSummary>();
  for (const r of rows) {
    let s = map.get(r.street);
    if (!s) {
      s = {
        street: r.street,
        suburb,
        address_count: 0,
        has_coords: false,
        minHouseNumber: null,
        anchorLat: null,
        anchorLng: null,
        addresses: [],
      };
      if (includeAddressCoords) s.addressCoords = [];
      map.set(r.street, s);
    }
    s.address_count++;
    s.addresses.push(r.property_address);

    const lat = r.lat != null ? Number(r.lat) : null;
    const lng = r.lng != null ? Number(r.lng) : null;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      s.has_coords = true;
      if (s.anchorLat == null) {
        const hn = r.house_number != null ? Number(r.house_number) : parseHouseNumber(r.property_address);
        if (hn != null && Number.isFinite(hn)) {
          s.anchorLat = lat;
          s.anchorLng = lng;
          s.minHouseNumber = hn;
        }
      }
      if (includeAddressCoords) {
        const status: 'unsent' | 'sent' | 'junk' = r.no_junk_mail ? 'junk' : (r.sent ? 'sent' : 'unsent');
        s.addressCoords!.push({
          address: r.property_address,
          lat,
          lng,
          sent: !!r.sent,
          status,
        });
      }
    }
  }
  return Array.from(map.values());
}

export function toOrderable(s: StreetSummary): OrderableStreet {
  return {
    street: s.street,
    minHouseNumber: s.minHouseNumber,
    anchorLat: s.anchorLat,
    anchorLng: s.anchorLng,
  };
}
