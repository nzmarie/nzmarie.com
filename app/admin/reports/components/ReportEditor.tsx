'use client';

import { useCallback } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useAutoSave } from '../hooks/useAutoSave';
import { useImageUpload } from '../hooks/useImageUpload';
import { useReportStore } from '../stores/report-store';
import type { ReportEditorContent } from '@/types/report';

interface ReportEditorProps {
  docId: string;
  initialContent: ReportEditorContent | null;
  onContentChange?: (content: ReportEditorContent) => void;
  className?: string;
}

export default function ReportEditor({ docId, initialContent, onContentChange, className }: ReportEditorProps) {
  const { isSaving, lastSaved, setIsSaving, setLastSaved, updateDocument } = useReportStore();
  const { handleImageFile } = useImageUpload();

  const editor = useCreateBlockNote({
    initialContent: initialContent ?? undefined,
    trailingBlock: false,
    uploadFile: async (file: File) => {
      return handleImageFile(file, docId);
    },
  });

  const saveContent = useCallback(async () => {
    const blocks = editor.document;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/reports/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, content: blocks }),
      });
      const result = await res.json();
      if (result.success) {
        setLastSaved(new Date().toLocaleTimeString('en-NZ'));
        updateDocument(docId, { content: blocks as ReportEditorContent });
        onContentChange?.(blocks as ReportEditorContent);
      }
    } catch {
      // silent
    } finally {
      setIsSaving(false);
    }
  }, [editor, docId, setIsSaving, setLastSaved, updateDocument, onContentChange]);

  useAutoSave({
    data: editor.document,
    onSave: saveContent,
    delay: 3000,
    enabled: true,
  });

  const handleChange = useCallback(() => {
    const now = Date.now();
    if (now - (editor as { _lastChangeTime?: number })._lastChangeTime! > 500) {
      (editor as { _lastChangeTime?: number })._lastChangeTime = now;
    }
  }, [editor]);

  return (
    <div className={'report-editor-container' + (className ? ' ' + className : '')} style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
      <div className="reports-editor-status" style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', fontSize: '0.8rem', color: '#999',
        background: 'white', borderBottom: '1px solid #eee',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isSaving ? '#f59e0b' : '#22c55e',
          }} />
          {isSaving ? 'Saving...' : lastSaved ? `Saved at ${lastSaved}` : 'Ready'}
        </span>
      </div>
      <div style={{ background: 'white' }}>
        <BlockNoteView editor={editor} theme="light" onChange={handleChange} />
      </div>
    </div>
  );
}
