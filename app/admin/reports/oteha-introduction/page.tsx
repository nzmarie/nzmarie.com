'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReportStore } from '../stores/report-store';

export default function OtehaIntroRedirect() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const createDocIfMissing = async () => {
      try {
        // Create a minimal introduction document for Oteha
        const content = [
          { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Oteha', styles: {} }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'This is a new Oteha introduction. Edit and save to persist.', styles: {} }] },
        ];
        // Attempt to find the Oteha suburb id from the overview API so the created document appears under the Oteha tree in the sidebar
        let suburbId: string | null = null;
        try {
          const ov = await fetch('/api/admin/reports/overview');
          const ovData = await ov.json();
          if (ovData && ovData.success && Array.isArray(ovData.suburbs)) {
            const match = ovData.suburbs.find((s: any) => String(s.name).toLowerCase() === 'oteha');
            if (match) suburbId = match.id;
          }
        } catch (e) {
          // ignore overview fetch failures; proceed without suburb association
        }

        // Before creating, rename any existing suburb_intro documents for this suburb that use the old 'Introduction' title to 'Oteha'
        if (suburbId) {
          try {
            const existingRes = await fetch(`/api/admin/reports/documents?suburb_id=${encodeURIComponent(suburbId)}&type=suburb_intro`);
            const existingData = await existingRes.json();
            if (existingData && existingData.success && Array.isArray(existingData.documents)) {
              for (const doc of existingData.documents) {
                if (typeof doc.title === 'string' && doc.title.toLowerCase().includes('introduction') && doc.title !== 'Oteha') {
                  try {
                    await fetch('/api/admin/reports/documents', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: doc.id, title: 'Oteha' }),
                    });
                  } catch (e) {
                    // ignore individual update failures
                  }
                }
              }
            }
          } catch (e) {
            // ignore listing failures
          }
        }

        const res = await fetch('/api/admin/reports/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_type: 'suburb_intro', title: 'Oteha', content, suburb_id: suburbId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError('Failed to create introduction document. See console for details.');
          console.error('Create intro failed', data);
          return;
        }
        if (cancelled) return;
        // Update client-side suburb/slug maps so sidebar links resolve to the new intro immediately
        try {
          const overviewRes = await fetch('/api/admin/reports/overview');
          const overviewData = await overviewRes.json();
          if (overviewData && overviewData.success) {
            const slugMap: Record<string, string> = {};
            const idToSlug: Record<string, string> = {};
            const toSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');
            const quarterToSlug = (quarter: string) => {
              const parts = quarter.split('-Q');
              if (parts.length === 2) return `q${parts[1].toLowerCase()}-${parts[0]}`;
              return quarter.toLowerCase();
            };
            function addToSlugMaps(id: string, baseSlug: string) {
              let slug = baseSlug;
              let counter = 2;
              while (slugMap[slug] && slugMap[slug] !== id) {
                slug = `${baseSlug}-${counter}`;
                counter++;
              }
              slugMap[slug] = id;
              idToSlug[id] = slug;
            }

            for (const suburb of overviewData.suburbs) {
              const slugName = toSlug(suburb.name);
              if (suburb.introDoc) addToSlugMaps(suburb.introDoc.id, `${slugName}-introduction`);
              if (suburb.letterDoc) addToSlugMaps(suburb.letterDoc.id, `${slugName}-letter`);
              for (const report of suburb.reports) {
                const qSlug = quarterToSlug(report.quarter);
                addToSlugMaps(report.id, `${slugName}-${qSlug}`);
              }
              const firstDoc = suburb.introDoc || suburb.letterDoc || suburb.reports?.[0];
              if (firstDoc && !slugMap[slugName]) slugMap[slugName] = firstDoc.id;
            }
            // update store
            const setSuburbs = useReportStore.getState().setSuburbs;
            const setSlugMap = useReportStore.getState().setSlugMap;
            try { setSuburbs(overviewData.suburbs); } catch (e) {}
            try { setSlugMap(slugMap, idToSlug); } catch (e) {}
          }
        } catch (e) {
          // ignore
        }

        // Navigate to the standard admin editor route for the created document
        router.replace(`/admin/reports/${data.id}`);
      } catch (e) {
        console.error('Error creating Oteha intro', e);
        setError('Error creating introduction document');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    createDocIfMissing();
    return () => { cancelled = true; };
  }, [router]);

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Preparing Oteha introduction...</h2>
        <p>Please wait while a new draft introduction is created. You will be redirected to the editor automatically.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Unable to create Oteha introduction</h2>
        <p>{error}</p>
        <p>Check the browser console and server logs for details.</p>
      </div>
    );
  }

  return null;
}
