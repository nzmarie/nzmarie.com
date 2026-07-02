'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import { SkeletonOutreach } from '@/components/admin/Skeleton';

interface OutreachItem {
  id: string;
  louis_property_id: string;
  property_address: string;
  suburb: string;
  street?: string;
  city?: string;
  bedrooms?: number;
  bathrooms?: number;
  rv_value?: number;
  status: 'PENDING' | 'SENT' | 'COMPLETED';
  tracking_code?: string;
  selected_by: string;
  selected_at: string;
  sent_by?: string;
  sent_at?: string;
  notes?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatCurrency(val?: number) {
  if (!val) return 'N/A';
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(val);
}

export default function OutreachPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'SENT'>('PENDING');
  const [items, setItems] = useState<OutreachItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [suburbs, setSuburbs] = useState<string[]>([]);
  const [suburbFilter, setSuburbFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const isSuperAdmin = session?.user?.email === 'nzlouis.com@gmail.com';

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/admin/login');
  }, [status, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCounts = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        fetch('/api/admin/outreach?status=PENDING&limit=1').then(r => r.json()),
        fetch('/api/admin/outreach?status=SENT&limit=1').then(r => r.json()),
      ]);
      if (p.pagination) setPendingCount(p.pagination.total);
      if (s.pagination) setSentCount(s.pagination.total);
    } catch {
      // non-critical
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: activeTab, page: page.toString(), limit: '50' });
      if (suburbFilter) params.set('suburb', suburbFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/outreach?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.data ?? []);
      setPagination(data.pagination ?? null);
      if (data.suburbs) setSuburbs(data.suburbs);
    } catch (error) {
      console.error('Error fetching outreach:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, suburbFilter, debouncedSearch]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchItems();
      fetchCounts();
    }
  }, [status, fetchItems, fetchCounts]);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const markAsSent = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/outreach/${id}/mark-sent`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed');
      showNotification('success', 'Marked as sent');
      fetchItems();
      fetchCounts();
    } catch {
      showNotification('error', 'Failed to mark as sent');
    }
  };

  if (status === 'loading') return <SkeletonOutreach />;

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {notification.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📬 Outreach</h1>
          <p className="text-gray-600 mt-1">Manage direct mail campaigns and track delivery status</p>
        </div>
        <a
          href="/admin/properties"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          + Add from Properties
        </a>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {([['PENDING', pendingCount], ['SENT', sentCount]] as const).map(([tab, count]) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              {tab === 'PENDING' ? 'Pending' : 'Sent'}
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                activeTab === tab ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          id="outreach-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by address or tracking code"
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
        <select
          id="outreach-suburb"
          value={suburbFilter}
          onChange={e => { setSuburbFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">All Suburbs</option>
          {suburbs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || suburbFilter) && (
          <button
            onClick={() => { setSearch(''); setSuburbFilter(''); setPage(1); }}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {activeTab === 'PENDING' ? 'No Properties Selected' : 'No Properties Sent Yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {activeTab === 'PENDING'
                ? 'Go to Properties page to add some'
                : 'Mark pending properties as sent'}
            </p>
            {activeTab === 'PENDING' && (
              <a href="/admin/properties" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                Browse Properties
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Address</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Suburb</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      {activeTab === 'PENDING' ? 'Added' : 'Sent'}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">RV</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Beds</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Tracking</th>
                    {isSuperAdmin && activeTab === 'PENDING' && (
                      <th className="px-4 py-3"></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 text-sm">{item.property_address}</div>
                        {item.city && <div className="text-xs text-slate-400">{item.city}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.suburb}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatRelativeTime(activeTab === 'PENDING' ? item.selected_at : (item.sent_at ?? item.selected_at))}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(item.rv_value)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.bedrooms ?? '-'}</td>
                      <td className="px-4 py-3">
                        {item.tracking_code ? (
                          <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{item.tracking_code}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      {isSuperAdmin && activeTab === 'PENDING' && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => markAsSent(item.id)}
                            className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            Mark as Sent
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
          </>
        )}
      </div>
    </div>
  );
}
