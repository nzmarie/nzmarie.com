import * as path from 'path';
import * as fs from 'fs';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        process.env[k] = v;
      }
    }
  }
}

async function main() {
  loadEnv();
  const key = 'reports/Northcross/2026-YTD-H1.pdf';
  const { getSignedDownloadUrl } = await import('../lib/r2-storage');
  const downloadUrl = await getSignedDownloadUrl(key);
  console.log('Signed/download URL:', downloadUrl);

  // If local path, invoke local route; if HTTP(S), fetch the URL
  if (downloadUrl.startsWith('/reports/')) {
    const { GET } = await import('../app/reports/[...key]/route');
    const req = new Request('http://localhost' + downloadUrl);
    const res = await GET(req as any);
    console.log('Local route status:', res.status);
    if (res.status === 200) {
      const array = await res.arrayBuffer();
      console.log('Downloaded bytes:', array.byteLength);
    } else {
      const json = await res.json();
      console.log('Response JSON:', json);
    }
  } else if (downloadUrl.startsWith('http')) {
    console.log('Fetching presigned HTTP URL...');
    const res = await fetch(downloadUrl);
    console.log('HTTP fetch status:', res.status);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      console.log('Downloaded bytes from R2:', buf.byteLength);
    } else {
      const txt = await res.text();
      console.log('Response body:', txt.slice(0, 200));
    }
  } else {
    console.log('Unknown downloadUrl format:', downloadUrl);
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });
