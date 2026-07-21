'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useReportStore } from '../stores/report-store';
import DocumentViewer from '../components/DocumentViewer';

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;
  const slugMap = useReportStore(s => s.slugMap);
  const setSelectedDocId = useReportStore(s => s.setSelectedDocId);

  const isUuid = /^[a-f0-9-]{36}$/.test(rawId);
  const resolvedId = isUuid ? rawId : (slugMap[rawId] ?? null);

  useEffect(() => {
    // Keep human-readable slugs in the URL for intro and quarterly report pages.
    // We only resolve slug → document ID internally, without canonicalizing back to UUID.
  }, [isUuid, resolvedId, rawId, router]);

  if (!resolvedId) return null;

  return (
    <DocumentViewer
      docId={resolvedId}
      onNavigate={(newId) => {
        setSelectedDocId(newId);
        if (newId) {
          router.replace(`/admin/reports/${newId}`, { scroll: false });
        } else {
          router.replace('/admin/reports', { scroll: false });
        }
      }}
    />
  );
}
