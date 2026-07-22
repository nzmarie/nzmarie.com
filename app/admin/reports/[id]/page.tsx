'use client';

import { useParams, useRouter } from 'next/navigation';
import { useReportStore } from '../stores/report-store';
import DocumentViewer from '../components/DocumentViewer';

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;
  const slugMap = useReportStore(s => s.slugMap);
  const idToSlug = useReportStore(s => s.idToSlug);

  const isUuid = /^[a-f0-9-]{36}$/.test(rawId);
  const resolvedId = isUuid ? rawId : (slugMap[rawId] ?? null);

  if (!resolvedId) return null;

  return (
    <DocumentViewer
      docId={resolvedId}
      onNavigate={(newId) => {
        if (newId) {
          const slug = idToSlug[newId];
          router.replace(`/admin/reports/${slug || newId}`, { scroll: false });
        } else {
          router.replace('/admin/reports', { scroll: false });
        }
      }}
    />
  );
}
