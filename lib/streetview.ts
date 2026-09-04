import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { uploadToR2, isR2Mock } from '@/lib/r2-storage';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'a128bb5285b94a778d4b098fbd8266f1';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'mock-r2-access-key-id';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'mock-r2-secret-access-key';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'nzmarie-reports';
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || 'https://reports.nzmarie.com';
const GOOGLE_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export function isR2StreetViewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith(R2_PUBLIC_DOMAIN) && url.includes('/streetview/');
}

export function isGoogleStreetViewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('maps.googleapis.com/maps/api/streetview');
}

export function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.includes('no-photo-available') || url.includes('via.placeholder.com') || url.includes('No+Image');
}

export function streetViewR2Key(propertyId: string): string {
  return `streetview/${propertyId}.jpg`;
}

export function streetViewR2Url(propertyId: string): string {
  return `${R2_PUBLIC_DOMAIN}/${streetViewR2Key(propertyId)}`;
}

async function headR2Exists(key: string): Promise<boolean> {
  if (isR2Mock) return false;
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function fetchGoogleStreetView(lat: number, lng: number): Promise<Buffer | null> {
  if (!GOOGLE_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&key=${GOOGLE_KEY}&return_error_code=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('image')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) return null;
    return buf;
  } catch {
    return null;
  }
}

async function hasStreetViewPanorama(lat: number, lng: number): Promise<boolean> {
  if (!GOOGLE_KEY) return false;
  const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${GOOGLE_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === 'OK';
  } catch {
    return false;
  }
}

export async function getCachedR2Url(propertyId: string): Promise<string | null> {
  if (!propertyId) return null;
  const key = streetViewR2Key(propertyId);
  if (await headR2Exists(key)) return streetViewR2Url(propertyId);
  return null;
}

export async function getOrCreateStreetViewUrl(
  propertyId: string,
  latitude: number | null,
  longitude: number | null,
  currentImageUrl: string | null | undefined
): Promise<string | null> {
  if (!propertyId) return currentImageUrl || null;
  if (isR2StreetViewUrl(currentImageUrl || '')) return currentImageUrl || null;
  if (isPlaceholderUrl(currentImageUrl || '')) return currentImageUrl || null;
  if (latitude == null || longitude == null) return currentImageUrl || null;
  const key = streetViewR2Key(propertyId);
  const r2Url = streetViewR2Url(propertyId);
  if (await headR2Exists(key)) return r2Url;
  const has = await hasStreetViewPanorama(latitude, longitude);
  if (!has) return currentImageUrl || null;
  const buf = await fetchGoogleStreetView(latitude, longitude);
  if (!buf) return currentImageUrl || null;
  try {
    await uploadToR2(key, buf, 'image/jpeg', 'public, max-age=31536000, immutable');
  } catch {
    return currentImageUrl || null;
  }
  try {
    const { query } = await import('@/lib/db');
    query(`UPDATE properties SET cover_image_url=$1 WHERE id=$2`, [r2Url, propertyId]).catch(() => {});
  } catch {}
  return r2Url;
}

export async function batchResolveStreetViews<T extends { id: string; latitude: number | null; longitude: number | null; image_url?: string | null; cover_image_url?: string | null }>(
  rows: T[]
): Promise<T[]> {
  const limit = 5;
  const results: T[] = [];
  for (let i = 0; i < rows.length; i += limit) {
    const chunk = rows.slice(i, i + limit);
    const resolved = await Promise.all(
      chunk.map(async (row) => {
        const current = (row as unknown as { image_url?: string | null }).image_url ?? (row as unknown as { cover_image_url?: string | null }).cover_image_url ?? null;
        const next = await getOrCreateStreetViewUrl(row.id, row.latitude, row.longitude, current);
        if (next && next !== current) {
          if ('image_url' in row) (row as unknown as { image_url: string | null }).image_url = next;
          if ('cover_image_url' in row) (row as unknown as { cover_image_url: string | null }).cover_image_url = next;
        }
        return row;
      })
    );
    results.push(...resolved);
  }
  return results;
}

export async function batchGetCachedR2Urls(
  propertyIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    propertyIds.map(async (id) => {
      const url = await getCachedR2Url(id);
      if (url) map.set(id, url);
    })
  );
  return map;
}
