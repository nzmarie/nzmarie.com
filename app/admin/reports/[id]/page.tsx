'use client';

import { useParams, useRouter } from 'next/navigation';
import { useReportStore } from '../stores/report-store';
import DocumentViewer from '../components/DocumentViewer';

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const setSelectedDocId = useReportStore(s => s.setSelectedDocId);

  return (
    <DocumentViewer
      docId={id}
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
