'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
          { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Oteha Introduction', styles: {} }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'This is a new Oteha introduction. Edit and save to persist.', styles: {} }] },
        ];
        const res = await fetch('/api/admin/reports/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_type: 'suburb_intro', title: 'Oteha Introduction', content }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError('Failed to create introduction document. See console for details.');
          console.error('Create intro failed', data);
          return;
        }
        if (cancelled) return;
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
