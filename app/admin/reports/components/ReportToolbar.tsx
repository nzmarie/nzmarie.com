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
  suburbName?: string;
  quarter?: string;
  suburbId?: string;
  hideExtraButtons?: boolean;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function quarterToSlug(quarter: string): string {
  const parts = quarter.split('-Q');
  if (parts.length === 2) {
    return `q${parts[1].toLowerCase()}-${parts[0]}`;
  }
  return quarter.toLowerCase();
}

const SUBURB_ORDER = ['Northcross', 'Oteha', 'Torbay', 'Fairview Heights', 'Waiake',
  'Browns Bay', 'Pinehill', 'Rothesay Bay', 'Murrays Bay', 'Albany', 'Long Bay',
  'Forrest Hill', 'Schnapper Rock', 'Unsworth Heights', 'Sunnynook', 'Greenhithe',
  'Chatswood', 'Mairangi Bay', 'Campbells Bay', 'Castor Bay', 'Milford', 'Glenfield',
  'Hillcrest', 'Birkenhead', 'Hauraki'];

function getCurrentYear() { return new Date().getFullYear(); }
function getCurrentQuarter(): string {
  const m = new Date().getMonth() + 1;
  return `${getCurrentYear()}-Q${Math.ceil(m / 3)}`;
}
function quartersForYear(year: number): string[] {
  return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];
}

export default function ReportToolbar({
  title, onTitleChange, status, docType, saving, onSaveNow, onExport, onDelete, suburbName, quarter, suburbId, hideExtraButtons,
}: ReportToolbarProps) {
  const router = useRouter();
  const slugMap = useReportStore(s => s.slugMap);
  const idToSlug = useReportStore(s => s.idToSlug);
  const setSlugMap = useReportStore(s => s.setSlugMap);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genQuarter, setGenQuarter] = useState(getCurrentQuarter());
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

  if (!quarter) quarter = getCurrentQuarter();

  const currentYear = getCurrentYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const quarterOptions = years.flatMap(y => quartersForYear(y));

  const handleGenerate = async () => {
    if (!genSuburbId) return;
    setGenLoading(true);
    try {
      const res = await fetch('/api/admin/reports/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb_id: genSuburbId, quarter: genQuarter }),
      });
      const data = await res.json();
      if (data.success) {
        const docId = data.id;
        const qSlug = quarterToSlug(genQuarter);
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
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 12, padding: 0,
              width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '24px 24px 8px' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700, color: '#111' }}>
                Generate Report
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#666' }}>
                Select suburb and quarter to generate a new market report.
              </p>

              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>
                Suburb
              </label>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <input
                  value={showDropdown ? genSearch : (selectedSuburb?.name || genSuburbName || '')}
                  onChange={(e) => { setGenSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => { setGenSearch(''); setShowDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Search suburb..."
                  style={{
                    width: '100%', padding: '8px 10px', fontSize: '0.9rem',
                    border: '1px solid #d1d5db', borderRadius: 8,
                    outline: 'none', background: 'white', boxSizing: 'border-box',
                  }}
                />
                {showDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    maxHeight: 200, overflowY: 'auto', background: 'white',
                    border: '1px solid #d1d5db', borderRadius: 8, zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}>
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
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem',
                          background: s.id === genSuburbId ? '#e8f0fe' : 'white',
                          color: s.id === genSuburbId ? '#1a73e8' : '#333',
                          fontWeight: s.id === genSuburbId ? 600 : 400,
                        }}
                        onMouseEnter={(e) => { if (s.id !== genSuburbId) e.currentTarget.style.background = '#f5f5f5'; }}
                        onMouseLeave={(e) => { if (s.id !== genSuburbId) e.currentTarget.style.background = 'white'; }}
                      >
                        {s.name}
                      </div>
                    ))}
                    {genSearch && suburbList.filter(s => s.name.toLowerCase().includes(genSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#999' }}>
                        No suburbs found
                      </div>
                    )}
                  </div>
                )}
              </div>

              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>
                Quarter
              </label>
              <select
                value={genQuarter}
                onChange={(e) => setGenQuarter(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', fontSize: '0.9rem',
                  border: '1px solid #d1d5db', borderRadius: 8,
                  outline: 'none', background: 'white',
                }}
              >
                {quarterOptions.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px' }}>
              <button
                onClick={() => setShowGenerate(false)}
                style={{
                  padding: '8px 16px', fontSize: '0.85rem', borderRadius: 8,
                  border: '1px solid #d1d5db', background: 'white', cursor: 'pointer',
                  color: '#374151', fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={genLoading || !genSuburbId}
                style={{
                  padding: '8px 16px', fontSize: '0.85rem', borderRadius: 8,
                  border: 'none', background: genLoading || !genSuburbId ? '#6ee7b7' : '#059669',
                  cursor: genLoading || !genSuburbId ? 'not-allowed' : 'pointer',
                  color: 'white', fontWeight: 600,
                }}
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
