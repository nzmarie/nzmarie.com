import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;

if (redisUrl && redisToken) {
  try {
    redis = new Redis({ url: redisUrl, token: redisToken });
  } catch {
    console.warn('Failed to initialize Redis client');
  }
}

export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 600
): Promise<T> {
  if (!redis) return fetchFn();

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      if (typeof cached === 'string') {
        try {
          return JSON.parse(cached);
        } catch {
          return cached as unknown as T;
        }
      }
      return cached;
    }
  } catch {
  }

  const data = await fetchFn();

  try {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    await redis.set(key, serialized, { ex: ttlSeconds });
  } catch {
  }

  return data;
}

const SEARCH_HISTORY_TTL = 259200; // 3 days

export async function saveSearchHistory(adminId: number, query: string): Promise<void> {
  if (!redis || !query.trim()) return;
  try {
    const key = `search_history:${adminId}`;
    const trimmed = query.trim();
    await redis.lrem(key, 0, trimmed);
    await redis.lpush(key, trimmed);
    await redis.ltrim(key, 0, 9);
    await redis.expire(key, SEARCH_HISTORY_TTL);
  } catch {
    // Redis unavailable — silently ignore
  }
}

export async function getSearchHistory(adminId: number): Promise<string[]> {
  if (!redis) return [];
  try {
    const items = await redis.lrange<string>(`search_history:${adminId}`, 0, 9);
    return items ?? [];
  } catch {
    return [];
  }
}

// ─── Suburb street-summary cache ─────────────────────────────────────────────
// Stores the greedy-orderable data for every street in a suburb.
// The full StreetSummary.addresses[] array is intentionally omitted here: it
// can be hundreds of KB and is not needed for ordering or counting.

export interface CachedStreetSummary {
  street: string;
  address_count: number;
  minHouseNumber: number | null;
  anchorLat: number | null;
  anchorLng: number | null;
}

export interface CachedSuburbStreets {
  summaries: CachedStreetSummary[];
  alphaFirst: string;
}

const SUBURB_STREETS_TTL = 180 * 24 * 60 * 60; // 6 months — street names and coordinates are highly stable
const suburbStreetsKey = (suburb: string) =>
  `suburb_streets:${suburb.toLowerCase().trim()}`;

export async function getSuburbStreetsFromCache(
  suburb: string,
): Promise<CachedSuburbStreets | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get<CachedSuburbStreets>(suburbStreetsKey(suburb));
    if (cached !== null) {
      // Upstash returns plain objects for JSON-serialised values
      if (typeof cached === 'string') {
        return JSON.parse(cached) as CachedSuburbStreets;
      }
      return cached;
    }
  } catch {
    // Redis unavailable — caller will fall back to DB
  }
  return null;
}

export async function setSuburbStreetsInCache(
  suburb: string,
  data: CachedSuburbStreets,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(suburbStreetsKey(suburb), JSON.stringify(data), {
      ex: SUBURB_STREETS_TTL,
    });
  } catch {
    // Non-critical — silently ignore
  }
}

export async function deleteSuburbStreetsFromCache(suburb: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(suburbStreetsKey(suburb));
  } catch {
    // Non-critical
  }
}

// ─── Street-clusters cache (Today's Run planner) ─────────────────────────────
// Caches the full GET /api/admin/outreach/street-clusters response for a given
// combination of suburb + status + sentStatus + reportQuarter + budget.
// TTL: 30 minutes — short enough to reflect newly liked/pending properties
// while still eliminating the repeated DB hit during a single planning session.

const STREET_CLUSTERS_TTL = 30 * 60; // 30 minutes in seconds

export function streetClustersKey(
  suburb: string,
  status: string,
  sentStatus: string,
  reportQuarter: string | null,
  budget: number,
): string {
  const q = reportQuarter ?? 'all';
  return `street_clusters:${suburb.toLowerCase().trim()}:${status}:${sentStatus}:${q}:${budget}`;
}

export async function getStreetClustersFromCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      if (typeof cached === 'string') return JSON.parse(cached) as T;
      return cached;
    }
  } catch {
    // Redis unavailable — fall back to DB
  }
  return null;
}

export async function setStreetClustersInCache(key: string, data: unknown): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(data), { ex: STREET_CLUSTERS_TTL });
  } catch {
    // Non-critical
  }
}

/**
 * Invalidate all street-clusters cache entries for a suburb.
 * Called after a like/unlike action since pending counts change.
 *
 * Strategy: delete the most common key combinations rather than a KEYS scan
 * (Upstash REST does not support KEYS pattern efficiently).
 * Covers: status=pending × sentStatus in [all, unsent] × budget in [20, 25, 30, 35, 40, 50]
 */
export async function invalidateStreetClustersForSuburb(suburb: string): Promise<void> {
  if (!redis) return;
  const statuses = ['pending'];
  const sentStatuses = ['all', 'unsent'];
  const budgets = [20, 25, 30, 35, 40, 50];

  const keys: string[] = [];
  for (const st of statuses) {
    for (const ss of sentStatuses) {
      for (const b of budgets) {
        const base = streetClustersKey(suburb, st, ss, null, b);
        keys.push(base);
        keys.push(`${base}:coords`); // also invalidate the address-coords variant
      }
    }
  }

  try {
    // Upstash supports multi-key DEL
    await redis.del(...keys);
  } catch {
    // Non-critical
  }
}
