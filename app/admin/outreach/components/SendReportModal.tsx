'use client';

import React, { useState, useEffect } from 'react';
import { FaFilePdf, FaPaperPlane, FaTimes, FaCheckCircle } from 'react-icons/fa';

interface PdfReport {
  id: string;
  suburb: string;
  quarter: string;
  year: number;
  doc_label?: string | null;
  file_url: string;
  file_name: string;
  title?: string;
}

interface SendReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  suburb: string;
  onSuccess: () => void;
}

export default function SendReportModal({
  isOpen,
  onClose,
  selectedIds,
  suburb,
  onSuccess,
}: SendReportModalProps) {
  const [reports, setReports] = useState<PdfReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [campaignKey, setCampaignKey] = useState<string>('2026_Q2');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingReports, setFetchingReports] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchReports = async () => {
      setFetchingReports(true);
      setError('');
      try {
        const querySuburb = suburb && suburb !== 'all-suburbs' ? suburb : '';
        const url = `/api/admin/pdf/reports?status=active${querySuburb ? `&suburb=${encodeURIComponent(querySuburb)}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
          if (data.reports && data.reports.length > 0) {
            setSelectedReportId(data.reports[0].id);
            setCustomTitle(`${data.reports[0].suburb} ${data.reports[0].year} ${data.reports[0].quarter} Market Report`);
            setCampaignKey(`${data.reports[0].year}_${data.reports[0].quarter}_${data.reports[0].suburb}`);
          } else {
            setCustomTitle(`${suburb || 'Suburbs'} 2026 Q2 Market Report`);
            setCampaignKey(`2026_Q2_${suburb || 'General'}`);
          }
        }
      } catch (err) {
        console.error('Error fetching PDF reports:', err);
      } finally {
        setFetchingReports(false);
      }
    };

    fetchReports();
  }, [isOpen, suburb]);

  if (!isOpen) return null;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const repId = e.target.value;
    setSelectedReportId(repId);
    const found = reports.find((r) => r.id === repId);
    if (found) {
      setCustomTitle(`${found.suburb} ${found.year} ${found.quarter} Market Report`);
      setCampaignKey(`${found.year}_${found.quarter}_${found.suburb}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_ids: selectedIds,
          suburb_report_id: selectedReportId || undefined,
          report_title: customTitle,
          campaign_key: campaignKey,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record send log');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 flex items-center justify-center text-blue-400">
              <FaPaperPlane className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Send Quarterly Report</h3>
              <p className="text-xs text-slate-400">Selected {selectedIds.length} target addresses</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Finalized PDF Report (from PDF Manager)
            </label>
            {fetchingReports ? (
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ) : reports.length > 0 ? (
              <select
                value={selectedReportId}
                onChange={handleSelectChange}
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.suburb} {r.year} {r.quarter} — {r.doc_label || 'Main Report'} — {r.file_name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2">
                <FaFilePdf className="text-amber-600 flex-shrink-0" />
                <span>No PDF report found for {suburb || 'this suburb'} in PDF Manager. Enter custom details below.</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Report Title
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Campaign Identifier
            </label>
            <input
              type="text"
              value={campaignKey}
              onChange={(e) => setCampaignKey(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Dispatch Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Printed 50 flyers for street distribution"
              className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Recording...</span>
              ) : (
                <>
                  <FaCheckCircle className="w-3.5 h-3.5" />
                  <span>Confirm Dispatch Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
