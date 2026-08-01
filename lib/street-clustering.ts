/**
 * Street clustering utilities for planning mail runs.
 *
 * Uses Haversine distance so it works on plain lat/lng without requiring
 * PostGIS geometry columns (CockroachDB compatible, small data size).
 */

export interface StreetPoint {
  street: string;
  suburb: string;
  lat: number;
  lng: number;
  pendingCount: number;
  /** Optional full addresses for this street (e.g. for run detail views). */
  addresses?: string[];
}

export interface ClusterGroup {
  groupId: number;
  streets: StreetPoint[];
  totalPending: number;
  extentMeters: number;
}

/** Haversine distance in meters between two lat/lng points. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Star clustering of streets within a suburb.
 * A street joins a group only if it is within `radius` meters of that
 * group's SEED street (the first street picked for the group). This keeps
 * groups compact ("streets reachable around one point") and prevents the
 * whole suburb from chaining into a single group.
 * Output groups are ordered by seed position.
 */
export function clusterStreets(
  streets: StreetPoint[],
  radiusMeters: number
): ClusterGroup[] {
  const remaining = [...streets];
  const groups: ClusterGroup[] = [];
  let groupId = 1;

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const members: StreetPoint[] = [seed];

    for (let i = remaining.length - 1; i >= 0; i--) {
      const candidate = remaining[i];
      const distance = haversineMeters(
        seed.lat,
        seed.lng,
        candidate.lat,
        candidate.lng
      );
      if (distance <= radiusMeters) {
        members.push(candidate);
        remaining.splice(i, 1);
      }
    }

    members.sort((a, b) =>
      a.street.localeCompare(b.street, undefined, { sensitivity: 'base' })
    );

    const lats = members.map((m) => m.lat);
    const lngs = members.map((m) => m.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const extentMeters = haversineMeters(minLat, minLng, maxLat, maxLng);

    groups.push({
      groupId,
      streets: members,
      totalPending: members.reduce((sum, m) => sum + m.pendingCount, 0),
      extentMeters: Math.round(extentMeters),
    });
    groupId++;
  }

  return groups;
}

/**
 * Split clustered streets into budget-sized "runs".
 * Operates at the STREET level so an oversized group is split into
 * multiple runs, keeping each run geographically close (streets from the
 * same compact group are adjacent in the flat list).
 * Each run is a list of (groupId, streets) chunks; a run may span multiple
 * groups when the first group is too small to reach the budget.
 *
 * Flushing strategy: a run is only closed when it has reached at least half
 * the budget AND adding the next street would overshoot. This prevents small
 * geographic clusters from being emitted as tiny under-filled runs.
 */
export function splitRuns(
  groups: ClusterGroup[],
  budget: number
): ClusterGroup[][] {
  const flat: { group: ClusterGroup; street: StreetPoint }[] = [];
  for (const group of groups) {
    for (const street of group.streets) {
      flat.push({ group, street });
    }
  }

  const runs: ClusterGroup[][] = [];
  let current: ClusterGroup[] = [];
  let currentTotal = 0;

  const flush = () => {
    if (current.length > 0) {
      runs.push(current);
      current = [];
      currentTotal = 0;
    }
  };

  for (const { group, street } of flat) {
    if (street.pendingCount > budget) {
      flush();
      runs.push([cloneGroupWith([street])]);
      continue;
    }

    const wouldOvershoot = currentTotal + street.pendingCount > budget;
    const halfFull = currentTotal >= Math.ceil(budget / 2);

    if (wouldOvershoot && halfFull) {
      flush();
    }

    let chunk = current.find((c) => c.groupId === group.groupId);
    if (!chunk) {
      chunk = cloneGroupWith([]);
      chunk.groupId = group.groupId;
      current.push(chunk);
    }
    chunk.streets.push(street);
    chunk.totalPending += street.pendingCount;
    currentTotal += street.pendingCount;
  }
  flush();

  return runs;
}

function cloneGroupWith(streets: StreetPoint[]): ClusterGroup {
  return {
    groupId: 0,
    streets,
    totalPending: streets.reduce((s, st) => s + st.pendingCount, 0),
    extentMeters: 0,
  };
}
