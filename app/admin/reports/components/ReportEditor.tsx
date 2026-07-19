'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback } from 'react';
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, createInlineContentSpec } from '@blocknote/core';
import { filterSuggestionItems } from '@blocknote/core/extensions';
import { SuggestionMenuController, getDefaultReactSlashMenuItems, useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useAutoSave } from '../hooks/useAutoSave';
import { useImageUpload } from '../hooks/useImageUpload';
import { useReportStore } from '../stores/report-store';
import type { ReportEditorContent } from '@/types/report';

function createDeltaSVG(height: string, strokeColor: string): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.height = height;
  svg.style.width = 'auto';
  svg.style.display = 'block';
  svg.style.cursor = 'pointer';
  svg.style.flexShrink = '0';

  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M12 3L22 18H2Z');
  path1.setAttribute('stroke', strokeColor);
  path1.setAttribute('stroke-width', '2.5');
  path1.setAttribute('stroke-linecap', 'round');
  path1.setAttribute('stroke-linejoin', 'round');

  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M2 22H22');
  path2.setAttribute('stroke', strokeColor);
  path2.setAttribute('stroke-width', '2.5');
  path2.setAttribute('stroke-linecap', 'round');
  path2.setAttribute('stroke-linejoin', 'round');

  svg.append(path1, path2);
  return svg;
}

function createToolbar(
  currentHeight: string,
  onUpdateHeight: (h: string) => void,
): HTMLDivElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'print:hidden';
  toolbar.style.cssText = `
    position: absolute; top: -36px; left: 50%; transform: translateX(-50%);
    background: #1e293b; color: white; padding: 4px 8px; border-radius: 6px;
    display: flex; align-items: center; gap: 8px; font-size: 11px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 50; white-space: nowrap;
  `;

  const label = document.createElement('span');
  label.textContent = 'Height:';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentHeight;
  input.style.cssText = `
    width: 45px; background: #334155; border: none; border-radius: 3px;
    color: white; padding: 2px 4px; font-size: 11px; text-align: center; outline: none;
  `;
  input.addEventListener('input', () => onUpdateHeight(input.value));
  input.addEventListener('click', (e) => e.stopPropagation());

  const btnPlus = document.createElement('button');
  btnPlus.textContent = '+';
  btnPlus.style.cssText = `
    background: #334155; border: none; color: white; border-radius: 3px;
    padding: 2px 6px; cursor: pointer;
  `;
  btnPlus.addEventListener('click', (e) => {
    e.stopPropagation();
    const num = parseInt(currentHeight) || 36;
    onUpdateHeight(`${num + 4}px`);
  });

  const btnMinus = document.createElement('button');
  btnMinus.textContent = '-';
  btnMinus.style.cssText = `
    background: #334155; border: none; color: white; border-radius: 3px;
    padding: 2px 6.5px; cursor: pointer;
  `;
  btnMinus.addEventListener('click', (e) => {
    e.stopPropagation();
    const num = parseInt(currentHeight) || 36;
    onUpdateHeight(`${Math.max(12, num - 4)}px`);
  });

  toolbar.append(label, input, btnPlus, btnMinus);
  toolbar.addEventListener('click', (e) => e.stopPropagation());
  return toolbar;
}

const deltaInlineContent = createInlineContentSpec(
  {
    type: 'delta' as const,
    content: 'none',
    propSchema: {
      height: { default: '36px' },
      strokeColor: { default: '#1e40af' },
    },
  },
  {
    render: (inlineContent, updateInlineContent) => {
      let showToolbar = false;
      let currentHeight = inlineContent.props.height;
      const currentColor = inlineContent.props.strokeColor;

      const container = document.createElement('span');
      container.style.cssText = `
        display: inline-flex; align-items: center; position: relative;
        padding: 2px; border-radius: 6px; transition: border 0.2s;
        vertical-align: middle;
      `;

      const svg = createDeltaSVG(currentHeight, currentColor);

      let toolbar: HTMLDivElement | null = null;

      const closeToolbar = () => {
        showToolbar = false;
        if (toolbar) { toolbar.remove(); toolbar = null; }
        container.style.border = '1px solid transparent';
      };

      const openToolbar = () => {
        showToolbar = true;
        container.style.border = '1px dashed #e2e8f0';
        toolbar = createToolbar(currentHeight, (h) => {
          currentHeight = h;
          svg.style.height = h;
          updateInlineContent({ type: 'delta', props: { height: h, strokeColor: currentColor } });
        });
        container.append(toolbar);
      };

      svg.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (showToolbar) { closeToolbar(); } else { openToolbar(); }
      });

      container.append(svg);

      const onDocClick = (e: MouseEvent) => {
        if (showToolbar && container && !container.contains(e.target as Node)) {
          closeToolbar();
        }
      };
      document.addEventListener('mousedown', onDocClick);

      return {
        dom: container,
        destroy: () => {
          document.removeEventListener('mousedown', onDocClick);
        },
      };
    },
  },
);

const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    delta: deltaInlineContent,
  },
});

const insertDeltaItem = (editor: any) => ({
  title: 'Delta Icon',
  onItemClick: () => {
    editor.insertInlineContent([
      { type: 'delta', props: { height: '36px', strokeColor: '#1e40af' } },
      ' ',
    ]);
  },
  aliases: ['delta', 'icon', 'brand', 'logo'],
  group: 'Custom Blocks',
  subtext: 'Insert a premium custom SVG brand mark.',
});

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
    schema,
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
        <BlockNoteView editor={editor} theme="light" onChange={handleChange} slashMenu={false}>
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(
                [
                  ...getDefaultReactSlashMenuItems(editor),
                  insertDeltaItem(editor),
                ],
                query
              )
            }
          />
        </BlockNoteView>
      </div>
    </div>
  );
}
