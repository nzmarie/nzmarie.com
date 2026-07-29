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
