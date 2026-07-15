'use client';

interface ReportToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  status: string;
  docType: string;
  saving: boolean;
  onSaveNow: () => void;
  onExport: () => void;
  suburbName?: string;
  quarter?: string;
}

export default function ReportToolbar({
  title, onTitleChange, status, docType, saving, onSaveNow, onExport, suburbName, quarter,
}: ReportToolbarProps) {
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

        <button onClick={onExport} style={{
          padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
          border: '1px solid #1a73e8', background: '#1a73e8', cursor: 'pointer',
          color: 'white', fontWeight: 500,
        }}>
          Export PDF
        </button>

        <div style={{ fontSize: '0.75rem', color: '#999' }}>
          {docType === 'report' ? '📊' : docType === 'letter' ? '📬' : docType === 'suburb_intro' ? '📝' : '📄'}
        </div>
      </div>
    </div>
  );
}
