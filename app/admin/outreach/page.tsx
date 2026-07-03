'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SkeletonOutreach } from '@/components/admin/Skeleton';
import InlineAddressInput from '@/components/admin/InlineAddressInput';
import { getAllSuburbs } from '@/lib/geo-data';

interface OutreachProperty {
  id: string;
  property_address: string;
  suburb: string;
  city: string;
  region: string;
  street?: string;
  owner_name?: string;
  property_type?: string;
  campaign: string;
  status: 'pending' | 'sent' | 'interacted' | 'converted';
  sent_at?: string;
  interacted_at?: string;
  converted_at?: string;
  created_at: string;
  notes?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  sent: 'Sent',
  interacted: 'Interacted',
  converted: 'Converted',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-50 text-blue-600 border-blue-200',
  sent: 'bg-purple-50 text-purple-600 border-purple-200',
  interacted: 'bg-orange-50 text-orange-600 border-orange-200',
  converted: 'bg-green-50 text-green-600 border-green-200',
};

export default function OutreachPage() {
  const { status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'pending' | 'sent'>('pending');
  const [items, setItems] = useState<OutreachProperty[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [suburbFilter, setSuburbFilter] = useState('');
  const [streetFilter, setStreetFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  
  const [expandedSuburbs, setExpandedSuburbs] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [availableStreets, setAvailableStreets] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/admin/login');
  }, [status, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: activeTab,
        page: page.toString(),
        limit: '200',
        sortOrder,
      });
      if (suburbFilter) params.set('suburb', suburbFilter);
      if (streetFilter) params.set('street', streetFilter);
      if (campaignFilter) params.set('campaign', campaignFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/outreach?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setItems(data.data ?? []);
      setPagination(data.pagination ?? null);
    } catch (error) {
      console.error('Error fetching outreach:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, suburbFilter, streetFilter, campaignFilter, debouncedSearch, sortOrder]);

  useEffect(() => {
    if (status === 'authenticated') fetchItems();
  }, [status, fetchItems]);

  // 获取当前过滤条件下的可用街道
  useEffect(() => {
    const streets = new Set<string>();
    items.forEach(item => {
      if (item.street) streets.add(item.street);
    });
    setAvailableStreets(Array.from(streets).sort());
  }, [items]);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddSuccess = (newProperty: unknown) => {
    showNotification('success', 'Address added successfully');
    const prop = newProperty as OutreachProperty;
    setItems((prev) => [prop, ...prev]);
    if (pagination) {
      setPagination({ ...pagination, total: pagination.total + 1 });
    }
  };

  const toggleSuburb = (suburb: string) => {
    setExpandedSuburbs((prev) => {
      const next = new Set(prev);
      if (next.has(suburb)) next.delete(suburb);
      else next.add(suburb);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markAsSent = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/admin/outreach/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
          })
        )
      );
      showNotification('success', `Marked ${selected.size} address${selected.size === 1 ? '' : 'es'} as sent`);
      setSelected(new Set());
      fetchItems();
    } catch {
      showNotification('error', 'Bulk update failed');
    }
  };

  const startNewCampaign = async () => {
    if (selected.size === 0) return;
    const name = window.prompt('New campaign name (e.g. 2027_Calendar)');
    if (!name) return;
    try {
      const res = await fetch('/api/admin/outreach/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_ids: Array.from(selected), new_campaign: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to copy');
      showNotification('success', `Copied ${data.added || 0} address(es) to ${name}`);
      setSelected(new Set());
      fetchItems();
    } catch (err) {
      console.error('Start new campaign failed:', err);
      showNotification('error', 'Failed to start new campaign');
    }
  };

  // Extract house number helper
  function extractHouseNumber(address: string): number {
    const match = address.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 999999;
  }

  // Group by suburb and street with smart sorting
  const groupedBySuburb = useMemo(() => {
    const groups = new Map<string, Map<string, OutreachProperty[]>>();
    
    items.forEach((item) => {
      const suburb = item.suburb || 'Unknown';
      const street = item.street || 'Unknown Street';
      
      if (!groups.has(suburb)) {
        groups.set(suburb, new Map());
      }
      const streetMap = groups.get(suburb)!;
      
      if (!streetMap.has(street)) {
        streetMap.set(street, []);
      }
      streetMap.get(street)!.push(item);
    });
    
    // Convert to array and sort
    return Array.from(groups.entries())
      .map(([suburb, streetMap]) => {
        const streets = Array.from(streetMap.entries())
          .map(([street, properties]) => ({
            street,
            properties: properties.sort((a, b) => {
              // Within same street: sort by created_at then house number
              const dateCompare = sortOrder === 'asc' 
                ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              
              // If dates are the same, sort by house number
              if (Math.abs(dateCompare) < 1000) { // within 1 second, consider same batch
                return extractHouseNumber(a.property_address) - 
                       extractHouseNumber(b.property_address);
              }
              
              return dateCompare;
            }),
            totalCount: properties.length,
          }))
          .sort((a, b) => a.street.localeCompare(b.street));
        
        return {
          suburb,
          streets,
          totalCount: streets.reduce((sum, s) => sum + s.totalCount, 0),
        };
      })
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [items, sortOrder]);

  const stats = useMemo(() => {
    const totalPending = items.filter((i) => i.status === 'pending').length;
    const totalSent = items.filter((i) => i.status === 'sent').length;
    const totalInteracted = items.filter((i) => i.status === 'interacted').length;
    return { totalPending, totalSent, totalInteracted, total: pagination?.total ?? items.length };
  }, [items, pagination]);

  const allSuburbs = getAllSuburbs();

  if (status === 'loading') return <SkeletonOutreach />;

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {notification.msg}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">📬 Outreach</h1>
        <p className="text-gray-600 mt-1">Direct Mail Campaign Management</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('pending'); setPage(1); }}
          className={`px-6 py-3 font-semibold transition-colors relative ${
            activeTab === 'pending'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-blue-600'
          }`}
        >
          Pending
          {stats.totalPending > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
              {stats.totalPending}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('sent'); setPage(1); }}
          className={`px-6 py-3 font-semibold transition-colors relative ${
            activeTab === 'sent'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-slate-600 hover:text-purple-600'
          }`}
        >
          Sent
          {stats.totalSent > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
              {stats.totalSent}
            </span>
          )}
        </button>
      </div>

      {/* Smart Inline Input */}
      {activeTab === 'pending' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <span>📍</span>
            <span>Quick Add to Current Campaign (2026 Q3 Report)</span>
          </h3>
          <InlineAddressInput campaign="2026_Q3_Report" onAddSuccess={handleAddSuccess} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search by address..."
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <select
            value={suburbFilter}
            onChange={(e) => { 
              setSuburbFilter(e.target.value); 
              setStreetFilter(''); // 重置街道过滤
              setPage(1); 
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Suburbs</option>
            {allSuburbs.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={streetFilter}
            onChange={(e) => { 
              setStreetFilter(e.target.value); 
              setPage(1); 
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={availableStreets.length === 0}
          >
            <option value="">All Streets</option>
            {availableStreets.map((street) => (
              <option key={street} value={street}>{street}</option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={(e) => { 
              setSortOrder(e.target.value as 'asc' | 'desc'); 
              setPage(1); 
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">📅 Time: Oldest First</option>
            <option value="desc">📅 Time: Newest First</option>
          </select>
          
          <button
            onClick={() => { 
              setSearch(''); 
              setSuburbFilter(''); 
              setStreetFilter('');
              setCampaignFilter(''); 
              setSortOrder('asc');
              setPage(1);
            }}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors"
          >
            ✕ Clear All
          </button>
        </div>

        {/* Active Filters Display */}
        {(suburbFilter || streetFilter || search || sortOrder === 'desc') && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Active Filters:</span>
            {suburbFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                Suburb: {suburbFilter}
                <button onClick={() => setSuburbFilter('')} className="hover:text-blue-900">✕</button>
              </span>
            )}
            {streetFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                Street: {streetFilter}
                <button onClick={() => setStreetFilter('')} className="hover:text-purple-900">✕</button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                Search: {search}
                <button onClick={() => setSearch('')} className="hover:text-green-900">✕</button>
              </span>
            )}
            {sortOrder === 'desc' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded-full">
                Newest First
                <button onClick={() => setSortOrder('asc')} className="hover:text-orange-900">✕</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {activeTab === 'pending' && selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-blue-800">
            {selected.size} address{selected.size === 1 ? '' : 'es'} selected
          </span>
          <button
            onClick={markAsSent}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Mark as Sent
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {activeTab === 'sent' && selected.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-purple-800">
            {selected.size} address{selected.size === 1 ? '' : 'es'} selected
          </span>
          <button
            onClick={startNewCampaign}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
          >
            ⟳ Start New Campaign
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {activeTab === 'pending' ? 'Pending' : 'Sent'} Addresses
          </h2>
          {pagination && (
            <span className="text-sm text-slate-500">{pagination.total} total</span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Properties Yet</h3>
            <p className="text-gray-500">
              {activeTab === 'pending'
                ? 'Use the input above to add addresses'
                : 'Mark properties as sent to see them here'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {groupedBySuburb.map(({ suburb, streets, totalCount }) => {
              const isExpanded = expandedSuburbs.has(suburb);
              return (
                <div key={suburb} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSuburb(suburb)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📂</span>
                      <div className="text-left">
                        <div className="font-semibold text-slate-800">{suburb}</div>
                        <div className="text-xs text-slate-500">
                          {streets.length} {streets.length === 1 ? 'street' : 'streets'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-600">
                        {totalCount} {totalCount === 1 ? 'address' : 'addresses'}
                      </span>
                      <span className="text-slate-400">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-slate-100">
                      {streets.map(({ street, properties, totalCount: streetTotal }) => (
                        <div key={street} className="bg-white">
                          <div className="px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">📍</span>
                                <span className="font-medium text-slate-700">{street}</span>
                              </div>
                              <span className="text-xs text-slate-500 font-medium">
                                {streetTotal} {streetTotal === 1 ? 'address' : 'addresses'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="divide-y divide-slate-50">
                            {properties.map((prop) => (
                              <div
                                key={prop.id}
                                className="px-4 py-3 hover:bg-blue-50 transition-colors flex items-center gap-4"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.has(prop.id)}
                                  onChange={() => toggleSelect(prop.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-slate-800 truncate">
                                    {prop.property_address}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                    {prop.property_type && (
                                      <span className="px-2 py-0.5 bg-slate-100 rounded">
                                        {prop.property_type}
                                      </span>
                                    )}
                                    <span>Added {new Date(prop.created_at).toLocaleDateString('en-NZ')}</span>
                                    <span className="text-slate-400">
                                      {new Date(prop.created_at).toLocaleTimeString('en-NZ', { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                      })}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                    STATUS_COLORS[prop.status]
                                  }`}
                                >
                                  {STATUS_LABELS[prop.status]}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
