'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useReportStore } from '../stores/report-store';

interface SuburbOption {
  id: string;
  name: string;
}

interface ReportToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  status: string;
  docType: string;
  saving: boolean;
  onSaveNow: () => void;
  onExport: () => void;
  onDelete: () => void;
  onEditHeaderFooter?: () => void;
  suburbName?: string;
  quarter?: string;
  suburbId?: string;
  hideExtraButtons?: boolean;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function _singleQToSlug(q: string): string {
  const parts = q.split('-Q');
  if (parts.length === 2) {
    return `q${parts[1].toLowerCase()}-${parts[0]}`;
  }
  return q.toLowerCase();
}

function quarterToSlug(quarter: string): string {
  const parts = quarter.split('–');
  if (parts.length === 2) {
    return `${_singleQToSlug(parts[0].trim())}-to-${_singleQToSlug(parts[1].trim())}`;
  }
  return _singleQToSlug(quarter);
}

const SUBURB_ORDER = ['Northcross', 'Oteha', 'Torbay', 'Fairview Heights', 'Waiake',
  'Browns Bay', 'Pinehill', 'Rothesay Bay', 'Murrays Bay', 'Albany', 'Long Bay',
  'Forrest Hill', 'Schnapper Rock', 'Unsworth Heights', 'Sunnynook', 'Greenhithe',
  'Chatswood', 'Mairangi Bay', 'Campbells Bay', 'Castor Bay', 'Milford', 'Glenfield',
  'Hillcrest', 'Birkenhead', 'Hauraki'];

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

export default function ReportToolbar({
  title, onTitleChange, status, docType, saving, onSaveNow, onExport, onDelete, onEditHeaderFooter, suburbName, quarter, suburbId, hideExtraButtons,
}: ReportToolbarProps) {
  const router = useRouter();
  const slugMap = useReportStore(s => s.slugMap);
  const idToSlug = useReportStore(s => s.idToSlug);
  const setSlugMap = useReportStore(s => s.setSlugMap);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genReportQuarter, setGenReportQuarter] = useState(REPORT_QUARTERS[0]);
  const [genStartQuarter, setGenStartQuarter] = useState(REPORT_QUARTERS[0]);
  const [genEndQuarter, setGenEndQuarter] = useState(REPORT_QUARTERS[0]);
  const [genSuburbId, setGenSuburbId] = useState(suburbId || '');
  const [genSuburbName, setGenSuburbName] = useState(suburbName || '');
  const [genLoading, setGenLoading] = useState(false);
  const [suburbList, setSuburbList] = useState<SuburbOption[]>([]);
  const [genSearch, setGenSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (showGenerate && suburbList.length === 0) {
      fetch('/api/admin/reports/suburbs')
        .then(r => r.json())
        .then(data => { if (data.success) setSuburbList(data.suburbs); })
        .catch(() => {});
    }
  }, [showGenerate, suburbList.length]);

  const selectedSuburb = suburbList.find(s => s.id === genSuburbId) || null;

  if (!quarter) quarter = REPORT_QUARTERS[0];

  const handleGenerate = async () => {
    if (!genSuburbId) return;
    setGenLoading(true);
    try {
      const res = await fetch('/api/admin/reports/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suburb_id: genSuburbId,
          quarter: genReportQuarter,
          start_quarter: genStartQuarter,
          end_quarter: genEndQuarter,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const docId = data.id;
        const qSlug = quarterToSlug(genReportQuarter);
        const baseSlug = `${toSlug(genSuburbName)}-${qSlug}`;
        let slug = baseSlug;
        let counter = 2;
        while (slugMap[slug] && slugMap[slug] !== docId) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        const newSlugMap = { ...slugMap, [slug]: docId };
        const newIdToSlug = { ...idToSlug, [docId]: slug };
        setSlugMap(newSlugMap, newIdToSlug);
        router.push(`/admin/reports/${slug}`);
      }
    } catch {
      // silent
    } finally {
      setGenLoading(false);
      setShowGenerate(false);
    }
  };

  return (
    <div className="reports-toolbar" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 24px', borderBottom: '1px solid #eee', background: 'white',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          style={{
            border: 'none', outline: 'none', fontSize: '1.1rem', fontWeight: 600,
            color: '#333', background: 'transparent', width: '100%', maxWidth: 400,
          }}
          placeholder="Untitled"
        />
        {suburbName && quarter && (
          <span style={{ fontSize: '0.8rem', color: '#999', whiteSpace: 'nowrap' }}>
            {suburbName} · {quarter}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', color: '#999' }}>
          {saving ? 'Saving...' : status === 'draft' ? 'Draft' : 'Finalised'}
        </span>

        <button onClick={onSaveNow} style={{
          padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
          border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#555',
        }}>
          Save
        </button>

        {!hideExtraButtons && (
          <button onClick={() => { setGenSuburbId(suburbId || ''); setGenSuburbName(suburbName || ''); setShowGenerate(true); }} style={{
            padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
            border: '1px solid #059669', background: '#ecfdf5', cursor: 'pointer',
            color: '#059669', fontWeight: 500,
          }}>
            + Generate Report
          </button>
        )}

        {docType === 'report' && (
          <button onClick={onEditHeaderFooter} style={{
            padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
            border: '1px solid #d1d5db', background: 'white', cursor: 'pointer',
            color: '#555', fontWeight: 500,
          }}>
            Edit Header/Footer
          </button>
        )}

        <button onClick={onExport} style={{
          padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
          border: '1px solid #1a73e8', background: '#1a73e8', cursor: 'pointer',
          color: 'white', fontWeight: 500,
        }}>
          Export PDF
        </button>

        {!hideExtraButtons && (
          <button onClick={onDelete} style={{
            padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
            border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer',
            color: '#dc2626', fontWeight: 500,
          }}>
            Delete
          </button>
        )}

        <div style={{ fontSize: '0.75rem', color: '#999' }}>
          {docType === 'report' ? '📊' : docType === 'letter' ? '📬' : docType === 'suburb_intro' ? '📝' : '📄'}
        </div>
      </div>

      {showGenerate && (
        <div
          onClick={() => setShowGenerate(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl w-[380px] max-w-[90vw] shadow-2xl overflow-hidden"
          >
            <div className="p-6 pb-0">
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                Generate Report
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Select suburb and quarter to generate a new market report.
              </p>

              <div className="flex flex-col space-y-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Suburb</label>
                  <div className="relative">
                    <input
                      value={showDropdown ? genSearch : (selectedSuburb?.name || genSuburbName || '')}
                      onChange={(e) => { setGenSearch(e.target.value); setShowDropdown(true); }}
                      onFocus={() => { setGenSearch(''); setShowDropdown(true); }}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                      placeholder="Search suburb..."
                      className={fieldStyles}
                    />
                    {showDropdown && (
                      <div className="absolute top-full left-0 right-0 max-h-[200px] overflow-y-auto bg-white border border-slate-200 rounded-lg z-10 shadow-md">
                        {(genSearch
                          ? suburbList.filter(s => s.name.toLowerCase().includes(genSearch.toLowerCase()))
                          : SUBURB_ORDER.map(name => suburbList.find(s => s.name === name)).filter(Boolean) as SuburbOption[]
                        ).map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setGenSuburbId(s.id);
                              setGenSuburbName(s.name);
                              setGenSearch('');
                              setShowDropdown(false);
                            }}
                            className={`px-3 py-2 text-sm cursor-pointer ${
                              s.id === genSuburbId ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {s.name}
                          </div>
                        ))}
                        {genSearch && suburbList.filter(s => s.name.toLowerCase().includes(genSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-sm text-slate-400">
                            No suburbs found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-500 mb-1">Report Quarter</label>
                  <select
                    value={genReportQuarter}
                    onChange={(e) => {
                      setGenReportQuarter(e.target.value);
                      setGenEndQuarter(e.target.value);
                    }}
                    className={fieldStyles}
                  >
                    {REPORT_QUARTERS.map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-500 mb-1">Data Start Quarter</label>
                  <select
                    value={genStartQuarter}
                    onChange={(e) => setGenStartQuarter(e.target.value)}
                    className={fieldStyles}
                  >
                    {DATA_QUARTERS.map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-500 mb-1">Data End Quarter</label>
                  <select
                    value={genEndQuarter}
                    onChange={(e) => setGenEndQuarter(e.target.value)}
                    className={fieldStyles}
                  >
                    {DATA_QUARTERS.map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-6">
              <button
                onClick={() => setShowGenerate(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={genLoading || !genSuburbId}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                  genLoading || !genSuburbId ? 'bg-emerald-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {genLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
