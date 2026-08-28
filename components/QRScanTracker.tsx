'use client';

import { useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export default function QRScanTracker() {
  useEffect(() => {
    let cancelled = false;

    async function track() {
      if (typeof window === 'undefined' || !('sendBeacon' in navigator)) return;

      const params = new URLSearchParams(window.location.search);
      const suburb = params.get('utm_campaign');
      if (!suburb) return;

      const ua = navigator.userAgent || '';
      let visitorId = '';
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        visitorId = result.visitorId;
      } catch {
        visitorId = '';
      }

      if (cancelled) return;

      const payload = JSON.stringify({ suburb, visitorId, ua });
      const endpoint = '/api/track-scan';
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
      }
    }

    track();
    return () => { cancelled = true; };
  }, []);

  return null;
}
