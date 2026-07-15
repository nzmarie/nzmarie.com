'use client';

import { useState, useEffect } from 'react';
import type { ReportSuburb } from '@/types/report';

interface TemplateSelectorProps {
  onGenerate: (suburbId: string, quarter: string) => Promise<string | undefined>;
  open: boolean;
  onClose: () => void;
  preselectedSuburbId?: string | null;
  preselectedQuarter?: string;
}

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export default function TemplateSelector({ onGenerate, open, onClose, preselectedSuburbId, preselectedQuarter }: TemplateSelectorProps) {
  const [suburbs, setSuburbs] = useState<ReportSuburb[]>([]);
  const [selectedSuburb, setSelectedSuburb] = useState(preselectedSuburbId || '');
  const [selectedQuarter, setSelectedQuarter] = useState(preselectedQuarter || getCurrentQuarter());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedSuburb(preselectedSuburbId || '');
      setSelectedQuarter(preselectedQuarter || getCurrentQuarter());
      fetch('/api/admin/reports/suburbs')
        .then((r) => r.json())
        .then((data) => { if (data.success) setSuburbs(data.suburbs); })
        .catch(() => {});
    }
  }, [open, preselectedSuburbId, preselectedQuarter]);

  const quarters = [];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
    const q = `Q${Math.ceil((d.getMonth() + 1) / 3)}`;
    quarters.push(`${d.getFullYear()}-${q}`);
  }

  const handleGenerate = async () => {
    if (!selectedSuburb || !selectedQuarter) return;
    setGenerating(true);
    try {
      const id = await onGenerate(selectedSuburb, selectedQuarter);
      if (id) {
        onClose();
      }
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, width: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 600, color: '#333' }}>
          Generate Market Report
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: 4 }}>
            Suburb
          </label>
          <select
            value={selectedSuburb}
            onChange={(e) => setSelectedSuburb(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: '0.9rem' }}
          >
            <option value="">Select suburb...</option>
            {suburbs.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: 4 }}>
            Quarter
          </label>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: '0.9rem' }}
          >
            <option value="">Select quarter...</option>
            {quarters.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd',
            background: 'white', cursor: 'pointer', color: '#555',
          }}>
            Cancel
          </button>
          <button onClick={handleGenerate} disabled={!selectedSuburb || !selectedQuarter || generating} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: !selectedSuburb || !selectedQuarter || generating ? '#ccc' : '#1a73e8',
            cursor: !selectedSuburb || !selectedQuarter || generating ? 'not-allowed' : 'pointer',
            color: 'white', fontWeight: 500,
          }}>
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
