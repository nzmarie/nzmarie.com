'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SkeletonBookings } from '@/components/admin/Skeleton';

type BookingStatus = 'new' | 'contacted' | 'scheduled' | 'appraised' | 'converted' | 'lost';
type BookingPriority = 'high' | 'medium' | 'low';

interface Booking {
  id: string;
  client_name: string;
  email: string;
  phone?: string;
  property_address: string;
  suburb: string;
  timeline?: string;
  motivation?: string;
  contact_status: BookingStatus;
  priority: BookingPriority;
  created_at: string;
  next_follow_up_at?: string;
  agent_notes?: string;
  has_downloaded?: boolean;
  download_count?: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-purple-100 text-purple-700',
  appraised: 'bg-indigo-100 text-indigo-700',
  converted: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

const PRIORITY_STYLES: Record<BookingPriority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const SUBURBS = [
  'Albany', 'Bayview', 'Beach Haven', 'Birkenhead', 'Browns Bay', 'Campbells Bay',
  'Castor Bay', 'Devonport', 'Fairview Heights', 'Hauraki', 'Hillcrest', 'Long Bay',
  'Narrow Neck', 'Northcross', 'Okura', 'Oteha', 'Schnapper Rock', 'Takapuna',
  'Totara Vale', 'Waiake', 'Wairau Valley',
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  appraised: 'Appraised',
  converted: 'Converted',
  lost: 'Lost',
};

const PRIORITY_LABELS: Record<BookingPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function formatStatusLabel(value: BookingStatus) {
  return STATUS_LABELS[value] ?? value;
}

function formatPriorityLabel(value: BookingPriority) {
  return PRIORITY_LABELS[value] ?? value;
}

export default function BookingsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [suburbFilter, setSuburbFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');

  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [editStatus, setEditStatus] = useState<BookingStatus>('new');
  const [editPriority, setEditPriority] = useState<BookingPriority>('medium');
  const [editNotes, setEditNotes] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/admin/login');
  }, [status, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '50' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (suburbFilter) params.set('suburb', suburbFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const res = await fetch(`/api/admin/bookings?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setBookings(data.data ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, suburbFilter, statusFilter, priorityFilter]);

  useEffect(() => {
    if (status === 'authenticated') fetchBookings();
  }, [status, fetchBookings]);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const openDetail = (b: Booking) => {
    setDetailBooking(b);
    setEditStatus(b.contact_status);
    setEditPriority(b.priority);
    setEditNotes(b.agent_notes ?? '');
    setEditFollowUp(b.next_follow_up_at ? b.next_follow_up_at.slice(0, 10) : '');
  };

  const saveDetail = async () => {
    if (!detailBooking) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${detailBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_status: editStatus,
          priority: editPriority,
          agent_notes: editNotes,
          follow_up_at: editFollowUp || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      showNotification('success', 'Changes saved successfully');
      setDetailBooking(null);
      fetchBookings();
    } catch {
      showNotification('error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === bookings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(bookings.map(b => b.id)));
    }
  };

  const applyBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          fetch(`/api/admin/bookings/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact_status: bulkStatus }),
          })
        )
      );
      showNotification('success', `Updated ${selected.size} bookings`);
      setSelected(new Set());
      setBulkStatus('');
      fetchBookings();
    } catch {
      showNotification('error', 'Bulk update failed');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSuburbFilter('');
    setStatusFilter('');
    setPriorityFilter('');
    setPage(1);
  };

  const stats = useMemo(() => ({
    total: pagination?.total ?? bookings.length,
    high: bookings.filter(b => b.priority === 'high').length,
    followUp: bookings.filter(b => {
      if (!b.next_follow_up_at) return false;
      return new Date(b.next_follow_up_at).toDateString() === new Date().toDateString();
    }).length,
  }), [bookings, pagination]);

  if (status === 'loading') return <SkeletonBookings />;

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {notification.msg}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">📅 Bookings</h1>
        <p className="text-gray-600 mt-1">Manage appraisal requests and client appointments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Leads', value: stats.total, color: 'text-slate-800' },
          { label: 'High Priority', value: stats.high, color: 'text-red-600' },
          { label: 'Follow Up Today', value: stats.followUp, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            id="bookings-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, phone or address..."
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <select
            id="bookings-suburb"
            value={suburbFilter}
            onChange={e => { setSuburbFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">All Suburbs</option>
            {SUBURBS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            id="bookings-status"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            {(['new', 'contacted', 'scheduled', 'appraised', 'converted', 'lost'] as BookingStatus[]).map(s => (
              <option key={s} value={s}>{formatStatusLabel(s)}</option>
            ))}
          </select>
          <select
            id="bookings-priority"
            value={priorityFilter}
            onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            onClick={clearFilters}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-blue-800">Selected: {selected.size} leads</span>
          <select
            value={bulkStatus}
            onChange={e => setBulkStatus(e.target.value)}
            className="px-3 py-1.5 border border-blue-300 rounded-lg text-sm"
          >
            <option value="">Update Status...</option>
            {(['new', 'contacted', 'scheduled', 'appraised', 'converted', 'lost'] as BookingStatus[]).map(s => (
              <option key={s} value={s}>{formatStatusLabel(s)}</option>
            ))}
          </select>
          <button
            onClick={applyBulkStatus}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
          >
            ✕ Clear
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Appraisal Requests</h2>
          {pagination && (
            <span className="text-sm text-slate-500">
              {pagination.total} total · Page {page} of {pagination.totalPages}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bookings Found</h3>
            <p className="text-gray-500">Appraisal requests will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === bookings.length && bookings.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Address</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Suburb</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={() => toggleSelect(b.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{b.client_name}</div>
                      <div className="text-xs text-slate-500">{b.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{b.property_address}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{b.suburb}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[b.contact_status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {formatStatusLabel(b.contact_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_STYLES[b.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                        {formatPriorityLabel(b.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(b.created_at).toLocaleDateString('en-NZ')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetail(b)}
                        className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {pagination.totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {detailBooking && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailBooking(null)} />
          <div className="relative ml-auto w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Booking Details</h2>
              <button onClick={() => setDetailBooking(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Client Information</h3>
                <div className="space-y-2">
                  <div><span className="text-sm text-slate-500">Name: </span><span className="text-sm font-medium">{detailBooking.client_name}</span></div>
                  <div><span className="text-sm text-slate-500">Email: </span><span className="text-sm">{detailBooking.email}</span></div>
                  {detailBooking.phone && <div><span className="text-sm text-slate-500">Phone: </span><span className="text-sm">{detailBooking.phone}</span></div>}
                  <div><span className="text-sm text-slate-500">Address: </span><span className="text-sm">{detailBooking.property_address}</span></div>
                  <div><span className="text-sm text-slate-500">Suburb: </span><span className="text-sm">{detailBooking.suburb}</span></div>
                  {detailBooking.timeline && <div><span className="text-sm text-slate-500">Timeline: </span><span className="text-sm">{detailBooking.timeline}</span></div>}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Status Management</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value as BookingStatus)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      {(['new', 'contacted', 'scheduled', 'appraised', 'converted', 'lost'] as BookingStatus[]).map(s => (
                        <option key={s} value={s}>{formatStatusLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">Priority</label>
                    <select
                      value={editPriority}
                      onChange={e => setEditPriority(e.target.value as BookingPriority)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">Next Follow-up Date</label>
                    <input
                      type="date"
                      value={editFollowUp}
                      onChange={e => setEditFollowUp(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Agent Notes</h3>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this client..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </div>

              {detailBooking.has_downloaded && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700 font-medium">📄 Report Downloaded</p>
                  <p className="text-xs text-green-600">Downloaded {detailBooking.download_count} time(s)</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={saveDetail}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setDetailBooking(null)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
