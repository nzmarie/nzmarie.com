'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReportEditor from '../components/ReportEditor';
import ReportToolbar from '../components/ReportToolbar';
import EmptyState from '../components/EmptyState';
import { useReportStore } from '../stores/report-store';
import type { ReportDocument } from '@/types/report';

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { setSelectedDocId, isSaving, updateDocument } = useReportStore();
  const [doc, setDoc] = useState<ReportDocument | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSelectedDocId(id);
    const fetchDoc = async () => {
      try {
        const res = await fetch(`/api/admin/reports/documents/${id}`);
        const data = await res.json();
        if (data.success) {
          setDoc(data.document);
          setTitle(data.document.title || '');
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
    return () => setSelectedDocId(null);
  }, [id, setSelectedDocId]);

  const handleTitleChange = useCallback(async (newTitle: string) => {
    setTitle(newTitle);
    try {
      await fetch('/api/admin/reports/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: newTitle }),
      });
      updateDocument(id, { title: newTitle } as any);
    } catch {
      // silent
    }
  }, [id, updateDocument]);

  const handleContentChange = useCallback((content: unknown[]) => {
    updateDocument(id, { content: content as any } as any);
  }, [id, updateDocument]);

  const handleSaveNow = useCallback(async () => {
    if (!doc) return;
    try {
      await fetch('/api/admin/reports/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title }),
      });
    } catch {
      // silent
    }
  }, [id, title, doc]);

  const handleExport = useCallback(() => {
    window.print();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        Loading...
      </div>
    );
  }

  if (!doc) {
    return (
      <EmptyState
        onCreatePage={async () => {
          const res = await fetch('/api/admin/reports/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_type: 'general', title: 'Untitled' }),
          });
          const data = await res.json();
          if (data.success) router.push(`/admin/reports/${data.id}`);
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ReportToolbar
        title={title}
        onTitleChange={handleTitleChange}
        status={doc.status}
        docType={doc.doc_type}
        saving={isSaving}
        onSaveNow={handleSaveNow}
        onExport={handleExport}
        suburbName={(doc as any).suburb_name}
        quarter={doc.quarter || undefined}
      />
      <div style={{ flex: 1 }}>
        <ReportEditor
          docId={id}
          initialContent={doc.content as unknown[]}
          onContentChange={handleContentChange}
        />
      </div>
    </div>
  );
}
