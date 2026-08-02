import { haversineMeters } from './street-clustering';

export interface OrderableStreet {
  street: string;
  minHouseNumber: number | null;
  anchorLat: number | null;
  anchorLng: number | null;
}

export function parseHouseNumber(address: string): number | null {
  const clean = address.trim();
  const unit = clean.match(/^(\d+)\/(\d+)/);
  if (unit) return parseInt(unit[2], 10);
  const num = clean.match(/^(\d+)/);
  return num ? parseInt(num[1], 10) : null;
}

export function orderStreetsGreedily(streets: OrderableStreet[], startStreet?: string): string[] {
  const anchored = streets.filter((s) => s.anchorLat != null && s.anchorLng != null);
  const noAnchor = streets
    .filter((s) => s.anchorLat == null || s.anchorLng == null)
    .sort((a, b) => a.street.localeCompare(b.street, undefined, { sensitivity: 'base' }));

  if (anchored.length === 0) {
    return noAnchor.map((s) => s.street);
  }

  const requested = startStreet
    ? anchored.find((s) => s.street === startStreet)
    : undefined;

  let current = requested ?? anchored.reduce((best, s) => {
    const bh = best.minHouseNumber ?? Infinity;
    const sh = s.minHouseNumber ?? Infinity;
    if (sh < bh) return s;
    if (sh === bh) {
      return s.street.localeCompare(best.street, undefined, { sensitivity: 'base' }) < 0 ? s : best;
    }
    return best;
  });

  const ordered = [current];
  const remaining = anchored.filter((s) => s !== current);

  while (remaining.length > 0) {
    let next = remaining[0];
    let best = Infinity;
    for (const candidate of remaining) {
      const d = haversineMeters(
        current.anchorLat!,
        current.anchorLng!,
        candidate.anchorLat!,
        candidate.anchorLng!
      );
      if (d < best) {
        best = d;
        next = candidate;
      }
    }
    ordered.push(next);
    remaining.splice(remaining.indexOf(next), 1);
    current = next;
  }

  return [...ordered.map((s) => s.street), ...noAnchor.map((s) => s.street)];
}
