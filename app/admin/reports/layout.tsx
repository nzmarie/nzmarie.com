'use client';

import { useEffect } from 'react';
import { useReportStore } from './stores/report-store';
import ReportSidebar from './components/ReportSidebar';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const { setDocuments, setSuburbs } = useReportStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docRes, subRes] = await Promise.all([
          fetch('/api/admin/reports/documents'),
          fetch('/api/admin/reports/suburbs'),
        ]);
        const docData = await docRes.json();
        const subData = await subRes.json();
        if (docData.success) setDocuments(docData.documents);
        if (subData.success) setSuburbs(subData.suburbs);
      } catch {
        // silent
      }
    };
    fetchData();
  }, [setDocuments, setSuburbs]);

  return (
    <>
      <style>{`
        @media print {
          .reports-sidebar { display: none !important; }
          .reports-toolbar { display: none !important; }
          .reports-editor-status { display: none !important; }
          body { overflow: visible !important; }
          .reports-layout-wrapper {
            position: static !important;
            overflow: visible !important;
            display: block !important;
          }
          .reports-layout-wrapper > main {
            overflow: visible !important;
          }
        }
      `}</style>
      <div className="reports-layout-wrapper" style={{
        position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0,
        display: 'flex', overflow: 'hidden',
      }}>
        <ReportSidebar />
        <main style={{ flex: 1, overflowY: 'auto', background: 'white' }}>
          {children}
        </main>
      </div>
    </>
  );
}
