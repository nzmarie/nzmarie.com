'use client';

import { useState, useEffect } from 'react';
import type { ReportSuburb } from '@/types/report';

interface TemplateSelectorProps {
  onGenerate: (suburbId: string, reportQuarter: string, startQuarter: string, endQuarter: string) => Promise<string | undefined>;
  open: boolean;
  onClose: () => void;
  preselectedSuburbId?: string | null;
  preselectedQuarter?: string;
}

const REPORT_QUARTERS = ['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4'];

function buildDataQuarters(): string[] {
  const result: string[] = [];
  for (let y = 2023; y <= 2027; y++) {
    for (let q = 1; q <= 4; q++) {
      result.push(`${y}-Q${q}`);
    }
  }
  return result;
}

const DATA_QUARTERS = buildDataQuarters();

const fieldStyles = 'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm';

export default function TemplateSelector({ onGenerate, open, onClose, preselectedSuburbId, preselectedQuarter }: TemplateSelectorProps) {
  const [suburbs, setSuburbs] = useState<ReportSuburb[]>([]);
  const [selectedSuburb, setSelectedSuburb] = useState(preselectedSuburbId || '');
  const [reportQuarter, setReportQuarter] = useState(preselectedQuarter || REPORT_QUARTERS[0]);
  const [startQuarter, setStartQuarter] = useState(preselectedQuarter || REPORT_QUARTERS[0]);
  const [endQuarter, setEndQuarter] = useState(preselectedQuarter || REPORT_QUARTERS[0]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedSuburb(preselectedSuburbId || '');
      const q = preselectedQuarter || REPORT_QUARTERS[0];
      setReportQuarter(q);
      setStartQuarter(q);
      setEndQuarter(q);
      fetch('/api/admin/reports/suburbs')
        .then((r) => r.json())
        .then((data) => { if (data.success) setSuburbs(data.suburbs); })
        .catch(() => {});
    }
  }, [open, preselectedSuburbId, preselectedQuarter]);

  const handleGenerate = async () => {
    if (!selectedSuburb || !reportQuarter || !startQuarter || !endQuarter) return;
    if (startQuarter > endQuarter) return;
    setGenerating(true);
    try {
      const id = await onGenerate(selectedSuburb, reportQuarter, startQuarter, endQuarter);
      if (id) onClose();
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  const btnDisabled = !selectedSuburb || !reportQuarter || !startQuarter || !endQuarter || startQuarter > endQuarter || generating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800 mb-5">
          Generate Market Report
        </h2>

        <div className="flex flex-col space-y-4">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Suburb</label>
            <select
              value={selectedSuburb}
              onChange={(e) => setSelectedSuburb(e.target.value)}
              className={fieldStyles}
            >
              <option value="">Select suburb...</option>
              {suburbs.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-500 mb-1">Report Quarter</label>
            <select
              value={reportQuarter}
              onChange={(e) => setReportQuarter(e.target.value)}
              className={fieldStyles}
            >
              {REPORT_QUARTERS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-500 mb-1">Data Start Quarter</label>
            <select
              value={startQuarter}
              onChange={(e) => setStartQuarter(e.target.value)}
              className={fieldStyles}
            >
              {DATA_QUARTERS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-500 mb-1">Data End Quarter</label>
            <select
              value={endQuarter}
              onChange={(e) => setEndQuarter(e.target.value)}
              className={fieldStyles}
            >
              {DATA_QUARTERS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={btnDisabled}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
              btnDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
