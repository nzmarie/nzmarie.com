'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { SkeletonOutreach, SkeletonOutreachCard, SkeletonOutreachListRow } from '@/components/admin/Skeleton';
import AddressAutocomplete from '@/components/property/AddressAutocomplete';
import { isAdmin } from '@/lib/permissions';
import { getFixedImageUrl } from '@/lib/google-maps';
import SendReportModal from './components/SendReportModal';
import DispatchHistoryDrawer from './components/DispatchHistoryDrawer';
import {
  FaBed,
  FaBath,
  FaCar,
  FaRulerCombined,
  FaHistory,
  FaPaperPlane,
} from 'react-icons/fa';

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
  status: 'pending' | 'sent' | 'interacted' | 'converted' | 'liked';
  sent_at?: string;
  last_sent_at?: string;
  total_send_count?: number;
  last_campaign?: string;
  interacted_at?: string;
  converted_at?: string;
  created_at: string;
  notes?: string;
  property_url?: string | null;
  realestate_url?: string | null;
  image_url?: string | null;
  description?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  car_spaces?: number | null;
  floor_area?: string | null;
  land_area?: string | number | null;
  last_sold_price?: number | null;
  last_sold_date?: string | null;
  capital_value?: number | null;
  build_year?: number | null;
  pv_url?: string | null;
  property_history?: string | null;
  joined_property_id?: string | null;
  has_rental_history?: boolean | null;
  is_currently_rented?: boolean | null;
  estimated_value_low?: number | null;
  estimated_value_high?: number | null;
  suburb_median_price?: number | null;
  suburb_days_on_market?: number | null;
  on_market_sale?: boolean;
  sale_listing_status?: string | null;
  sale_price?: string | null;
  sale_agent?: string | null;
  on_market_rent?: boolean;
  rent_listing_status?: string | null;
  rent_price?: string | null;
  latest_send_title?: string | null;
  latest_sent_at?: string | null;
  latest_campaign?: string | null;
  latest_send_quarter?: string | null;
  latest_send_year?: number | null;
  latest_send_report_suburb?: string | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  liked: 'Liked',
  pending: 'Pending',
  sent: 'Sent',
  interacted: 'Interacted',
  converted: 'Converted',
};

const STATUS_COLORS: Record<string, string> = {
  liked: 'bg-pink-50 text-pink-600 border-pink-200',
  pending: 'bg-blue-50 text-blue-600 border-blue-200',
  sent: 'bg-purple-50 text-purple-600 border-purple-200',
  interacted: 'bg-orange-50 text-orange-600 border-orange-200',
  converted: 'bg-green-50 text-green-600 border-green-200',
};

const PAGE_SIZE = 18;

interface PropertyHistoryRecord {
  date?: string;
  type?: string;
  price?: string;
  agent?: string;
  interval?: string;
}

function PropertyHistoryView({ raw }: { raw: string }) {
  if (!raw || !raw.trim()) {
    return (
      <div style={{
        padding: '10px 12px', border: '2px solid #e2e8f0', borderRadius: '8px',
        fontSize: '0.9rem', color: '#a0aec0', backgroundColor: '#f8fafc',
      }}>
        No property history available
      </div>
    );
  }

  let records: PropertyHistoryRecord[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) records = parsed as PropertyHistoryRecord[];
  } catch {
    records = [];
  }

  if (records.length === 0) {
    return (
      <div style={{
        padding: '10px 12px', border: '2px solid #e2e8f0', borderRadius: '8px',
        fontSize: '0.9rem', color: '#2D3748', whiteSpace: 'pre-wrap',
        fontFamily: 'monospace', backgroundColor: '#f8fafc',
      }}>
        {raw}
      </div>
    );
  }

  const typeColor: Record<string, string> = {
    SOLD: '#dc2626',
    Listed: '#2563eb',
    Rented: '#0891b2',
    Built: '#16a34a',
  };

  return (
    <div style={{
      border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden',
      fontSize: '0.85rem', backgroundColor: '#f8fafc',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 90px 1fr',
        backgroundColor: '#edf2f7', fontWeight: '700', color: '#4a5568',
        padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
      }}>
        <span>Date</span>
        <span>Type</span>
        <span>Price / Detail</span>
      </div>
      {records.map((rec, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '120px 90px 1fr',
          padding: '8px 12px', borderBottom: i < records.length - 1 ? '1px solid #edf2f7' : 'none',
          color: '#2D3748',
        }}>
          <span style={{ fontFamily: 'monospace' }}>{rec.date || '—'}</span>
          <span style={{ fontWeight: '600', color: typeColor[rec.type || ''] || '#4a5568' }}>
            {rec.type || '—'}
          </span>
          <span style={{ fontFamily: 'monospace' }}>
            {rec.price ? rec.price : '—'}
            {rec.interval ? <span style={{ color: '#a0aec0', marginLeft: '8px', fontFamily: 'inherit' }}>({rec.interval})</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function OutreachPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'liked' | 'pending' | 'sent'>('liked');
  const [items, setItems] = useState<OutreachProperty[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [paginationMode, setPaginationMode] = useState<'infinite' | 'classic'>('infinite');
  const [currentPage, setCurrentPage] = useState(1);
  const [classicItems, setClassicItems] = useState<OutreachProperty[]>([]);
  const [classicPagination, setClassicPagination] = useState<PaginationMeta | null>(null);
  const [classicLoading, setClassicLoading] = useState(false);

  // Tracks image load failures (e.g. /static/media/no-photo-available.png) so we can
  // fall back to the "No Image Available" placeholder, matching the Properties page.
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const handleImageError = useCallback((id: string) => {
    setImageErrors((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const [addressInput, setAddressInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [suburbFilter, setSuburbFilter] = useState('');
  const [streetFilter, setStreetFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [lastSoldPreset, setLastSoldPreset] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState<'house' | 'all' | 'townhouse'>('all');
  const [marketStatus, setMarketStatus] = useState<'all' | 'for_sale' | 'for_rent' | 'rented' | 'never_rented' | 'not_listed'>('all');

  const [reportSuburbFilter, setReportSuburbFilter] = useState('');
  const [reportQuarterFilter, setReportQuarterFilter] = useState('');
  const [sentStatusFilter, setSentStatusFilter] = useState<'all' | 'sent' | 'unsent'>('all');
  const [sortMode, setSortMode] = useState<'address' | 'time'>('address');
  const [availableReports, setAvailableReports] = useState<Array<{ suburb: string; quarter: string; year: number; id: string }>>([]);

  // Debounce filter changes: only trigger fetch after 300ms of filter stability
  const [debouncedFilterKey, setDebouncedFilterKey] = useState(0);
  const filterDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      setDebouncedFilterKey(k => k + 1);
    }, 300);
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, [activeTab, suburbFilter, streetFilter, campaignFilter, debouncedSearch, sortOrder, propertyFilter, marketStatus, lastSoldPreset, reportSuburbFilter, reportQuarterFilter, sentStatusFilter, sortMode]);

  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [collapsedStreets, setCollapsedStreets] = useState<Set<string>>(new Set());
  const [selectedByTab, setSelectedByTab] = useState<Record<string, Set<string>>>({
    liked: new Set(),
    pending: new Set(),
    sent: new Set(),
  });
  const selected = selectedByTab[activeTab];
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const canMarkAsSent = isAdmin(session?.user?.email ?? '');

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTargetIds, setSendTargetIds] = useState<string[]>([]);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyTargetId, setHistoryTargetId] = useState<string | null>(null);
  const [historyTargetAddress, setHistoryTargetAddress] = useState<string>('');

  const openSendModal = (ids?: string[]) => {
    const targets = ids || Array.from(selected);
    if (targets.length === 0) return;
    setSendTargetIds(targets);
    setSendModalOpen(true);
  };

  const openHistoryDrawer = (id: string, address: string) => {
    setHistoryTargetId(id);
    setHistoryTargetAddress(address);
    setHistoryDrawerOpen(true);
  };

  // Edit Property modal (edits the linked properties table record)
  const [editingProperty, setEditingProperty] = useState<OutreachProperty | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [saving, setSaving] = useState(false);
  const [sendHistory, setSendHistory] = useState<Array<{
    log_id: string; report_title: string; campaign_key: string;
    sent_at: string; sent_by: string; notes?: string;
    pdf_file_url?: string; pdf_file_name?: string; scan_count: number;
  }>>([]);
  const [sendHistoryLoading, setSendHistoryLoading] = useState(false);

  const openEditModal = async (prop: OutreachProperty) => {
    setEditingProperty(prop);
    setEditFormData({
      address: prop.property_address || '',
      suburb: prop.suburb || '',
      city: prop.city || '',
      region: prop.region || '',
      bedrooms: prop.bedrooms?.toString() || '',
      bathrooms: prop.bathrooms?.toString() || '',
      car_spaces: prop.car_spaces?.toString() || '',
      year_built: prop.build_year?.toString() || '',
      floor_size: prop.floor_area || '',
      land_area: prop.land_area?.toString() || '',
      last_sold_price: prop.last_sold_price?.toString() || '',
      last_sold_date: prop.last_sold_date ? prop.last_sold_date.split('T')[0] : '',
      capital_value: prop.capital_value?.toString() || '',
      property_url: prop.pv_url || prop.property_url || '',
      cover_image_url: prop.image_url || '',
      description: prop.description || '',
      property_history: prop.property_history || '',
    });
    setSendHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/outreach/${prop.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setSendHistory(data.history || []);
      } else {
        setSendHistory([]);
      }
    } catch {
      setSendHistory([]);
    } finally {
      setSendHistoryLoading(false);
    }
  };

  const handleEditFieldChange = (key: string, value: string) => {
    setEditFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingProperty?.joined_property_id) {
      showNotification('error', 'No linked property record to edit');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(editFormData)) {
        payload[key] = value === '' || value === undefined ? null : value;
      }
      const response = await fetch(`/api/admin/properties/${editingProperty.joined_property_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to update property');
      showNotification('success', 'Property updated successfully');
      setEditingProperty(null);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to update property');
    } finally {
      setSaving(false);
    }
  };

  const isClassic = paginationMode === 'classic';
  const displayItems = isClassic ? classicItems : items;
  const displayPagination = isClassic ? classicPagination : pagination;
  const totalPages = Math.max(1, Math.ceil((displayPagination?.total || 0) / PAGE_SIZE));
  const availableStreets = useMemo(() => {
    const streets = new Set<string>();
    displayItems.forEach(item => {
      if (item.street) streets.add(item.street);
    });
    return Array.from(streets).sort();
  }, [displayItems]);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const lastPropertyElementRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Client-side cache: keyed by filter signature + page number so that
  // infinite and classic modes share the same per-page cache. Switching between
  // modes for the same page hits the cache instantly (no network round-trip).
  interface CacheEntry {
    items: OutreachProperty[];
    pagination: PaginationMeta | null;
    hasMore: boolean;
  }
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const buildCacheKey = useCallback((page: number) => {
    return [
      activeTab, suburbFilter, streetFilter, campaignFilter,
      debouncedSearch, sortOrder, propertyFilter, marketStatus, lastSoldPreset,
      reportSuburbFilter, reportQuarterFilter, sentStatusFilter, sortMode,
      `p${page}`,
    ].join('|');
  }, [activeTab, suburbFilter, streetFilter, campaignFilter, debouncedSearch, sortOrder, propertyFilter, marketStatus, lastSoldPreset, reportSuburbFilter, reportQuarterFilter, sentStatusFilter, sortMode]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/admin/login');
  }, [status, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(addressInput), 500);
    return () => clearTimeout(t);
  }, [addressInput]);

  const fetchPageData = useCallback(async (pageNum: number): Promise<{ items: OutreachProperty[]; pagination: PaginationMeta | null }> => {
    // Cancel any in-flight request so a slower earlier request can't
    // overwrite the result of a newer filter/tab/page change.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({
      status: activeTab,
      page: pageNum.toString(),
      limit: PAGE_SIZE.toString(),
      sortOrder,
    });
    if (suburbFilter) params.set('suburb', suburbFilter);
    if (streetFilter) params.set('street', streetFilter);
    if (campaignFilter) params.set('campaign', campaignFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (propertyFilter === 'house') params.set('standalone_only', 'true');
    if (propertyFilter === 'townhouse') params.set('townhouse_only', 'true');
    if (marketStatus !== 'all') params.set('market_status', marketStatus);
    if (lastSoldPreset === 'none') {
      params.set('last_sold_none', 'true');
    } else if (lastSoldPreset !== 'all') {
      // Parse preset like '5-10', '3-5', '0-3', '10-15', '15+'
      const parts = lastSoldPreset.split('-');
      if (parts.length === 2) {
        params.set('last_sold_min_years', parts[0]);
        params.set('last_sold_max_years', parts[1]);
      } else if (lastSoldPreset === '15+') {
        params.set('last_sold_min_years', '15');
      }
    }
    if (sentStatusFilter !== 'all') params.set('sent_status', sentStatusFilter);
    if (reportQuarterFilter) params.set('report_quarter', reportQuarterFilter);
    if (sortMode === 'time') params.set('sort_mode', 'time');

    const res = await fetch(`/api/admin/outreach?${params}`, { signal: controller.signal });
    if (controller.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    return {
      items: (data.data ?? []).map((item: OutreachProperty) => ({
        ...item,
        status: normalizeStatus(item.status),
      })),
      pagination: data.pagination ?? null,
    };
  }, [activeTab, suburbFilter, streetFilter, campaignFilter, debouncedSearch, sortOrder, propertyFilter, marketStatus, lastSoldPreset, reportQuarterFilter, sentStatusFilter, sortMode]);

  const fetchItems = useCallback(async () => {
    if (isClassic) return;
    const key1 = buildCacheKey(1);
    const cached1 = cacheRef.current.get(key1);
    if (cached1) {
      // Accumulate all cached consecutive pages for infinite scroll
      const allItems = [...cached1.items];
      let page = 2;
      let lastTotal = cached1.pagination?.total ?? cached1.items.length;
      while (true) {
        const ck = buildCacheKey(page);
        const cp = cacheRef.current.get(ck);
        if (!cp) break;
        allItems.push(...cp.items);
        lastTotal = cp.pagination?.total ?? lastTotal;
        page++;
      }
      setItems(allItems);
      setPagination(cached1.pagination ? { ...cached1.pagination, total: lastTotal } : null);
      setHasMore(cached1.hasMore);
      hasMoreRef.current = cached1.hasMore;
      pageRef.current = page - 1;
      setLoading(false);
      return;
    }
    setLoading(true);
    pageRef.current = 1;
    setHasMore(true);
    hasMoreRef.current = true;
    try {
      const result = await fetchPageData(1);
      cacheRef.current.set(key1, {
        items: result.items,
        pagination: result.pagination,
        hasMore: result.items.length >= PAGE_SIZE,
      });
      setItems(result.items);
      setPagination(result.pagination);
      if (result.items.length < PAGE_SIZE) {
        setHasMore(false);
        hasMoreRef.current = false;
      }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Error fetching outreach:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchPageData, isClassic, buildCacheKey]);

  useEffect(() => {
    if (status === 'authenticated') fetchItems();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'authenticated' || debouncedFilterKey === 0) return;
    fetchItems();
  }, [debouncedFilterKey, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isClassic || status !== 'authenticated') return;
    const key = buildCacheKey(currentPage);
    const cached = cacheRef.current.get(key);
    if (cached) {
      // Instant restore from cache — no loading state, no network.
      setClassicItems(cached.items);
      setClassicPagination(cached.pagination);
      setClassicLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setClassicLoading(true);
      try {
        const result = await fetchPageData(currentPage);
        if (!cancelled) {
          cacheRef.current.set(key, {
            items: result.items,
            pagination: result.pagination,
            hasMore: result.items.length >= PAGE_SIZE,
          });
          setClassicItems(result.items);
          setClassicPagination(result.pagination);
        }
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          console.error('Error fetching outreach (classic):', error);
        }
      } finally {
        if (!cancelled) setClassicLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isClassic, currentPage, debouncedFilterKey, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const key = buildCacheKey(nextPage);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setItems((prev) => [...prev, ...cached.items]);
      pageRef.current = nextPage;
      setPagination(cached.pagination);
      setHasMore(cached.hasMore);
      hasMoreRef.current = cached.hasMore;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }
    try {
      const result = await fetchPageData(nextPage);
      cacheRef.current.set(key, {
        items: result.items,
        pagination: result.pagination,
        hasMore: result.items.length >= PAGE_SIZE,
      });
      setItems((prev) => [...prev, ...result.items]);
      pageRef.current = nextPage;
      if (result.items.length < PAGE_SIZE) {
        setHasMore(false);
        hasMoreRef.current = false;
      }
      setPagination(result.pagination);
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Error loading more:', error);
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPageData, buildCacheKey]);

  useEffect(() => {
    if (isClassic) return;
    const el = lastPropertyElementRef.current;
    if (!el || !hasMore || loadingMore || loading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
        loadMore();
      }
    }, { rootMargin: '400px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore, isClassic, viewMode]);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const normalizeStatus = (status?: unknown) => {
    const value = String(status ?? '').toLowerCase();
    if (value === 'liked' || value === 'pending' || value === 'sent' || value === 'interacted' || value === 'converted') {
      return value as OutreachProperty['status'];
    }
    return 'pending';
  };

  const handleMarkAsSentSuccess = () => {
    cacheRef.current.clear();
    if (isClassic) {
      setCurrentPage(currentPage);
    } else {
      fetchItems();
    }
  };

  const toggleStreet = (suburb: string, street: string) => {
    const key = `${suburb}::${street}`;
    setCollapsedStreets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedByTab((prev) => {
      const current = prev[activeTab];
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [activeTab]: next };
    });
  };

  const clearSelected = () => {
    setSelectedByTab((prev) => ({ ...prev, [activeTab]: new Set() }));
  };

  const markAsSent = () => {
    if (selected.size === 0) return;
    openSendModal();
  };

  const markAsPending = async () => {
    if (selected.size === 0) return;
    try {
      const results = await Promise.all(
        Array.from(selected).map(async (id) => {
          const response = await fetch(`/api/admin/outreach/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending' }),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok) throw new Error(data?.error || 'Failed to mark as pending');
          return data.data as OutreachProperty;
        })
      );
      if (results.length === 0) return;
      showNotification('success', `Moved ${selected.size} address${selected.size === 1 ? '' : 'es'} to Pending`);
      clearSelected();
      handleMarkAsSentSuccess();
    } catch {
      showNotification('error', 'Bulk update failed');
    }
  };

  const markAsLiked = async () => {
    if (selected.size === 0) return;
    try {
      const results = await Promise.all(
        Array.from(selected).map(async (id) => {
          const response = await fetch(`/api/admin/outreach/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'liked' }),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok) throw new Error(data?.error || 'Failed to move to Liked');
          return data.data as OutreachProperty;
        })
      );
      if (results.length === 0) return;
      showNotification('success', `Moved ${selected.size} address${selected.size === 1 ? '' : 'es'} to Liked`);
      clearSelected();
      handleMarkAsSentSuccess();
    } catch {
      showNotification('error', 'Bulk update failed');
    }
  };

  // Remove a property from the Liked tab: confirm, DELETE the outreach record,
  // and update the UI without a full page refresh (optimistic removal + rollback on error).
  const removeFromLiked = async (prop: OutreachProperty) => {
    if (activeTab !== 'liked') return;
    if (!window.confirm(`确定取消喜欢 "${prop.property_address}"？\nAre you sure you want to remove this from Liked?`)) {
      return;
    }
    const itemId = prop.id;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setClassicItems((prev) => prev.filter((item) => item.id !== itemId));
    try {
      const res = await fetch(`/api/admin/outreach/${prop.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      showNotification('success', '已从 Liked 移除 / Removed from Liked');
    } catch {
      setItems((prev) => [...prev, prop]);
      setClassicItems((prev) => [...prev, prop]);
      showNotification('error', '取消喜欢失败 / Failed to remove');
    }
  };

  const handleLastSoldPreset = (preset: string) => {
    setLastSoldPreset(preset);
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
      clearSelected();
      fetchItems();
    } catch (err) {
      console.error('Start new campaign failed:', err);
      showNotification('error', 'Failed to start new campaign');
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selected.size} address${selected.size === 1 ? '' : 'es'}? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    const idsToDelete = new Set(Array.from(selected));
    showNotification('success', `Deleted ${selected.size} address${selected.size === 1 ? '' : 'es'} successfully`);
    clearSelected();
    setItems((prev) => prev.filter((item) => !idsToDelete.has(item.id)));
    setClassicItems((prev) => prev.filter((item) => !idsToDelete.has(item.id)));

    try {
      await Promise.all(
        Array.from(idsToDelete).map((id) =>
          fetch(`/api/admin/outreach/${id}`, {
            method: 'DELETE',
          })
        )
      );
    } catch (err) {
      console.error('Delete failed:', err);
      showNotification('error', 'Some addresses may not have been deleted');
    }
  };

  function extractHouseNumber(address: string): { houseNumber: number; unitNumber: number } {
    const clean = address.trim();
    const unitMatch = clean.match(/^(\d+)\/(\d+)/);
    if (unitMatch) {
      return { houseNumber: parseInt(unitMatch[2], 10), unitNumber: parseInt(unitMatch[1], 10) };
    }
    const numMatch = clean.match(/^(\d+)/);
    return { houseNumber: numMatch ? parseInt(numMatch[1], 10) : 999999, unitNumber: 0 };
  }

  function extractStreetName(address: string): string {
    let s = address.replace(/^\d+\//, '');
    s = s.replace(/^\d+[A-Za-z]?\s*/, '');
    return s.trim() || 'Unknown Street';
  }

  const currentContentKey = useMemo(() => {
    return displayItems.map((i) => i.id).join(',') + '|' + sortOrder;
  }, [displayItems, sortOrder]);

  const groupedBySuburb = useMemo(() => {
    const groups = new Map<string, Map<string, OutreachProperty[]>>();
    
    displayItems.forEach((item) => {
      const suburb = item.suburb || 'Unknown';
      const street = item.street || extractStreetName(item.property_address);
      
      if (!groups.has(suburb)) {
        groups.set(suburb, new Map());
      }
      const streetMap = groups.get(suburb)!;
      
      if (!streetMap.has(street)) {
        streetMap.set(street, []);
      }
      streetMap.get(street)!.push(item);
    });
    
    return Array.from(groups.entries())
      .map(([suburb, streetMap]) => {
        const streets = Array.from(streetMap.entries())
          .map(([street, properties]) => ({
            street,
            properties: properties.sort((a, b) => {
              const houseA = extractHouseNumber(a.property_address);
              const houseB = extractHouseNumber(b.property_address);
              
              if (houseA.houseNumber !== houseB.houseNumber) {
                return houseA.houseNumber - houseB.houseNumber;
              }
              if (houseA.unitNumber !== houseB.unitNumber) {
                return houseA.unitNumber - houseB.unitNumber;
              }
              
              const dateCompare = sortOrder === 'asc' 
                ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              
              return dateCompare;
            }),
            totalCount: properties.length,
          }))
          .sort((a, b) => a.street.localeCompare(b.street, undefined, { sensitivity: 'base' }));
        
        return {
          suburb,
          streets,
          totalCount: streets.reduce((sum, s) => sum + s.totalCount, 0),
        };
      })
      .sort((a, b) => a.suburb.localeCompare(b.suburb, undefined, { sensitivity: 'base' }));
    }, [currentContentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchronously restore classic items from the shared per-page cache
  // when switching to classic mode. This avoids a loading flash when the
  // data was already fetched under infinite scroll (same cache key).
  if (isClassic && classicItems.length === 0) {
    const key = buildCacheKey(currentPage);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setClassicItems(cached.items);
      setClassicPagination(cached.pagination);
      if (classicLoading) setClassicLoading(false);
    }
  }

  if (status === 'loading') return <SkeletonOutreach />;

  return (
    <div style={{
      maxWidth: "1400px",
      margin: "0 auto",
      padding: "24px",
      "--input-border": "#e2e8f0",
      "--input-bg": "#ffffff",
      "--foreground": "#171717",
      "--card-bg": "#ffffff",
      "--card-border": "#e2e8f0",
      "--text-heading": "#2D3748",
      "--text-muted": "#718096",
      "--background": "#f8fafc",
    } as React.CSSProperties}>
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

      {/* Filters */}
      <div style={{
        marginBottom: "32px",
        padding: "24px",
        backgroundColor: "white",
        borderRadius: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        border: "1px solid #e2e8f0",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#2D3748" }}>
            Search Filters
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#718096" }}>
            {isClassic
              ? `Displaying ${Math.max(1, (currentPage - 1) * PAGE_SIZE + 1)} to ${Math.min(currentPage * PAGE_SIZE, displayPagination?.total || 0)} of ${displayPagination?.total || 0} properties`
              : `Displaying 1 to ${displayItems.length} of ${displayPagination?.total || 0} properties`}
          </p>
        </div>

        {/* Status Filter Buttons */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
            Status
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {(['liked', 'pending', 'sent'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setCurrentPage(1); setReportSuburbFilter(''); setReportQuarterFilter(''); setSentStatusFilter('all'); setSortMode('address'); }}
                style={{
                  padding: '8px 18px',
                  backgroundColor: activeTab === tab ? (tab === 'liked' ? '#ec4899' : tab === 'pending' ? '#3b82f6' : '#8b5cf6') : 'white',
                  color: activeTab === tab ? 'white' : '#4a5568',
                  border: activeTab === tab ? `2px solid ${tab === 'liked' ? '#ec4899' : tab === 'pending' ? '#3b82f6' : '#8b5cf6'}` : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: activeTab === tab ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: activeTab === tab ? `0 4px 12px ${tab === 'liked' ? 'rgba(236, 72, 153, 0.3)' : tab === 'pending' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(139, 92, 246, 0.3)'}` : 'none',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {tab === 'liked' ? '❤️ Liked' : tab === 'pending' ? '⏳ Pending' : '✓ Sent'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'pending' && (
          <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f8faff", borderRadius: "12px", border: "1px solid #dbeafe" }}>
            <ReportFilterSection
              availableReports={availableReports}
              setAvailableReports={setAvailableReports}
              reportSuburbFilter={reportSuburbFilter}
              setReportSuburbFilter={setReportSuburbFilter}
              reportQuarterFilter={reportQuarterFilter}
              setReportQuarterFilter={setReportQuarterFilter}
              sentStatusFilter={sentStatusFilter}
              setSentStatusFilter={setSentStatusFilter}
              setSuburbFilter={setSuburbFilter}
            />
          </div>
        )}

        {activeTab === 'sent' && (
          <div style={{ marginBottom: "20px", display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#4a5568" }}>Sort:</span>
            {([
              { value: 'address' as const, label: 'By Street' },
              { value: 'time' as const, label: 'By Time' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortMode(opt.value)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: sortMode === opt.value ? '#8b5cf6' : 'white',
                  color: sortMode === opt.value ? 'white' : '#4a5568',
                  border: sortMode === opt.value ? '2px solid #8b5cf6' : '2px solid #e2e8f0',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
                  fontWeight: sortMode === opt.value ? '600' : '500',
                  transition: 'all 0.2s ease',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
            Search by Address
          </label>
          <AddressAutocomplete
            value={addressInput}
            city={''}
            useGoogleMaps={true}
            onChange={(val) => {
              setAddressInput(val);
            }}
            onSelect={(suggestion) => {
              setAddressInput(suggestion.address);
              setSuburbFilter(suggestion.suburb || '');
            }}
            placeholder="🔍 Search by address..."
          />
        </div>

        {/* Quick Suburb Filter Buttons */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "10px" }}>
            Quick Filter by Suburb
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            {['Northcross', 'Oteha', 'Torbay', 'Fairview Heights', 'Waiake', 'Browns Bay', 'Pinehill', 'Rothesay Bay', 'Murrays Bay', 'Albany', 'Long Bay', 'Forrest Hill', 'Schnapper Rock', 'Unsworth Heights', 'Sunnynook', 'Greenhithe', 'Chatswood', 'Mairangi Bay', 'Campbells Bay', 'Castor Bay', 'Milford', 'Glenfield', 'Hillcrest', 'Birkenhead', 'Hauraki'].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setAddressInput('');
                  setSuburbFilter(prev => prev === s ? '' : s);
                }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: suburbFilter === s ? '#3b82f6' : 'white',
                  color: suburbFilter === s ? 'white' : '#4a5568',
                  border: suburbFilter === s ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: suburbFilter === s ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: suburbFilter === s ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (suburbFilter !== s) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (suburbFilter !== s) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {s}
              </button>
            ))}
            {suburbFilter && (
              <button
                onClick={() => { setAddressInput(''); setSuburbFilter(''); }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  border: '2px solid #fecaca',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fee2e2';
                  e.currentTarget.style.borderColor = '#fca5a5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fef2f2';
                  e.currentTarget.style.borderColor = '#fecaca';
                }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={streetFilter}
            onChange={(e) => { setStreetFilter(e.target.value); }}
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
            onChange={(e) => { setSortOrder(e.target.value as 'asc' | 'desc'); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">📅 Time: Oldest First</option>
            <option value="desc">📅 Time: Newest First</option>
          </select>
        </div>

        {/* Property Type & Market Status */}
        <div style={{ marginTop: "16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
              Property Type
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(['house', 'all', 'townhouse'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setPropertyFilter(type)}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: propertyFilter === type ? '#3b82f6' : 'white',
                    color: propertyFilter === type ? 'white' : '#4a5568',
                    border: propertyFilter === type ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: propertyFilter === type ? '600' : '500',
                    transition: 'all 0.2s ease',
                    boxShadow: propertyFilter === type ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (propertyFilter !== type) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (propertyFilter !== type) {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                >
                  {type === 'house' ? 'House' : type === 'all' ? 'All' : 'Townhouse/Unit'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px", textAlign: "right" }}>
              Market Status
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(['all', 'for_sale', 'for_rent', 'rented', 'never_rented', 'not_listed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setMarketStatus(status)}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: marketStatus === status ? (status === 'for_sale' ? '#22c55e' : status === 'for_rent' ? '#8b5cf6' : status === 'rented' ? '#f59e0b' : status === 'never_rented' ? '#0891b2' : status === 'not_listed' ? '#64748b' : '#3b82f6') : 'white',
                    color: marketStatus === status ? 'white' : '#4a5568',
                    border: marketStatus === status ? `2px solid ${status === 'for_sale' ? '#22c55e' : status === 'for_rent' ? '#8b5cf6' : status === 'rented' ? '#f59e0b' : status === 'never_rented' ? '#0891b2' : status === 'not_listed' ? '#64748b' : '#3b82f6'}` : '2px solid #e2e8f0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: marketStatus === status ? '600' : '500',
                    transition: 'all 0.2s ease',
                    boxShadow: marketStatus === status ? `0 4px 12px ${status === 'for_sale' ? 'rgba(34, 197, 94, 0.3)' : status === 'for_rent' ? 'rgba(139, 92, 246, 0.3)' : status === 'rented' ? 'rgba(245, 158, 11, 0.3)' : status === 'never_rented' ? 'rgba(8, 145, 178, 0.3)' : status === 'not_listed' ? 'rgba(100, 116, 139, 0.3)' : 'rgba(59, 130, 246, 0.3)'}` : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (marketStatus !== status) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (marketStatus !== status) {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                >
                  {status === 'all' ? 'All' : status === 'for_sale' ? 'For Sale' : status === 'for_rent' ? 'To Rent' : status === 'rented' ? 'Rented' : status === 'never_rented' ? 'Never Rented' : 'Not Listed'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Last Sold */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
            Last Sold
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            {(['all', '5-10', '3-5', '0-3', '10-15', '15+', 'none'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handleLastSoldPreset(preset)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: lastSoldPreset === preset ? (preset === '5-10' ? '#f59e0b' : '#3b82f6') : 'white',
                  color: lastSoldPreset === preset ? 'white' : '#4a5568',
                  border: lastSoldPreset === preset ? (preset === '5-10' ? '2px solid #f59e0b' : '2px solid #3b82f6') : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: lastSoldPreset === preset ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: lastSoldPreset === preset ? (preset === '5-10' ? '0 4px 12px rgba(245, 158, 11, 0.4)' : '0 4px 12px rgba(59, 130, 246, 0.3)') : 'none',
                }}
                onMouseEnter={(e) => {
                  if (lastSoldPreset !== preset) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (lastSoldPreset !== preset) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {preset === 'all' ? 'All' : preset === '5-10' ? '★ 5-10 years' : preset === '3-5' ? '3-5 years' : preset === '0-3' ? '0-3 years' : preset === '10-15' ? '10-15 years' : preset === '15+' ? '15+ years' : 'No Last Sold'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">          
          <button
            onClick={() => { 
              setAddressInput(''); 
              setSuburbFilter(''); 
              setStreetFilter('');
              setCampaignFilter(''); 
              setSortOrder('asc');
              setLastSoldPreset('all');
              setPropertyFilter('all');
              setMarketStatus('all');
              setActiveTab('liked');
              setReportSuburbFilter('');
              setReportQuarterFilter('');
              setSentStatusFilter('all');
              setSortMode('address');
            }}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors"
          >
            ✕ Clear All
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "20px", marginBottom: "12px", padding: "12px 16px", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <span style={{ fontSize: "0.9rem", color: "#4a5568" }}>
          {isClassic
            ? `Displaying ${Math.max(1, (currentPage - 1) * PAGE_SIZE + 1)} to ${Math.min(currentPage * PAGE_SIZE, displayPagination?.total || 0)} of ${displayPagination?.total || 0} properties`
            : `Displaying 1 to ${displayItems.length} of ${displayPagination?.total || 0} properties`}
        </span>
        <div style={{ display: "inline-flex", borderRadius: "10px", overflow: "hidden", border: "2px solid #e2e8f0" }}>
          <button
            onClick={() => setPaginationMode('infinite')}
            style={{
              padding: "8px 18px",
              backgroundColor: !isClassic ? '#3b82f6' : 'white',
              color: !isClassic ? 'white' : '#4a5568',
              border: 'none',
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600",
              transition: "all 0.2s",
            }}
          >
            Infinite Scroll
          </button>
          <button
            onClick={() => setPaginationMode('classic')}
            style={{
              padding: "8px 18px",
              backgroundColor: isClassic ? '#3b82f6' : 'white',
              color: isClassic ? 'white' : '#4a5568',
              border: 'none',
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600",
              transition: "all 0.2s",
            }}
          >
            Classic Pages
          </button>
        </div>
      </div>

      {isClassic && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}
            style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >≪</button>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >‹</button>
          <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "#4a5568", whiteSpace: "nowrap" }}>
            Page{' '}
            <input
              type="number"
              value={currentPage}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= totalPages) {
                  setCurrentPage(v);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!isNaN(v) && v >= 1 && v <= totalPages) {
                    setCurrentPage(v);
                  }
                }
              }}
              style={{ width: "52px", padding: "4px 6px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.9rem", fontWeight: "600", color: "#2D3748", textAlign: "center", outline: "none", MozAppearance: "textfield" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              min={1}
              max={totalPages}
            />{' '}
            of {totalPages}
          </span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >›</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}
            style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >≫</button>
        </div>
      )}

      {/* Bulk Actions */}
      {activeTab === 'liked' && selected.size > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-pink-800">
            {selected.size} address{selected.size === 1 ? '' : 'es'} selected
          </span>
          <button
            onClick={markAsPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <span aria-hidden="true">⇨</span>
            <span className="ml-1">Mark as Pending</span>
          </button>
          <button
            onClick={deleteSelected}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            🗑️ Delete
          </button>
          <button
            onClick={clearSelected}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            ✕ Clear Selection
          </button>
        </div>
      )}

      {activeTab === 'pending' && selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-blue-800">
            {selected.size} address{selected.size === 1 ? '' : 'es'} selected
          </span>
          <button
            onClick={markAsSent}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <span aria-hidden="true">✓</span>
            <span className="ml-1">Mark as Sent</span>
          </button>
          <button
            onClick={markAsLiked}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors"
          >
            <span aria-hidden="true">↩</span>
            <span className="ml-1">Return to Liked</span>
          </button>
          <button
            onClick={deleteSelected}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            🗑️ Delete
          </button>
          <button
            onClick={clearSelected}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            ✕ Clear Selection
          </button>
        </div>
      )}

      {activeTab === 'sent' && selected.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-purple-800">
            {selected.size} address{selected.size === 1 ? '' : 'es'} selected
          </span>
          <button
            onClick={async () => {
              if (selected.size === 0) return;
              try {
                const results = await Promise.all(
                  Array.from(selected).map(async (id) => {
                    const response = await fetch(`/api/admin/outreach/${id}/status`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'pending' }),
                    });
                    const data = await response.json().catch(() => null);
                    if (!response.ok) throw new Error(data?.error || 'Failed');
                    return data.data as OutreachProperty;
                  })
                );
                if (results.length === 0) return;
                showNotification('success', `Moved ${selected.size} address${selected.size === 1 ? '' : 'es'} to Pending`);
                clearSelected();
                handleMarkAsSentSuccess();
              } catch {
                showNotification('error', 'Bulk update failed');
              }
            }}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors"
          >
            <span aria-hidden="true">⇨</span>
            <span className="ml-1">Return to Pending</span>
          </button>
          <button
            onClick={startNewCampaign}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
          >
            ⟳ Start New Campaign
          </button>
          <button
            onClick={clearSelected}
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
            {activeTab === 'liked' ? '❤️ Liked' : activeTab === 'pending' ? '⏳ Pending' : '✓ Sent'} Addresses
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('card')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'card' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                title="Card View"
              >
                ⊞ Cards
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                title="List View"
              >
                ☰ List
              </button>
            </div>
          </div>
        </div>

        {(loading || (isClassic && classicLoading)) ? (
          <SkeletonOutreach />
        ) : displayItems.length === 0 && !loadingMore ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Properties Yet</h3>
            <p className="text-gray-500">
            </p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="p-4">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "20px",
            }}>
              {displayItems.map((prop) => (
                <div
                  key={prop.id}
                  style={{
                    border: selected.has(prop.id) ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    backgroundColor: 'white',
                    boxShadow: selected.has(prop.id) ? '0 4px 12px rgba(59,130,246,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  <a href={prop.pv_url || prop.property_url || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ position: 'relative', height: '220px', backgroundColor: '#f8fafc' }}>
                    {prop.image_url && !prop.image_url.includes('no-photo-available') && !imageErrors.has(prop.id) ? (
                      <Image
                        src={getFixedImageUrl(prop.image_url) || prop.image_url}
                        alt={prop.property_address}
                        width={400}
                        height={220}
                        unoptimized
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={() => handleImageError(prop.id)}
                      />
                    ) : (
                      <div style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                        color: '#4a5568',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                      }}>
                        <div style={{
                          backgroundColor: '#e2e8f0',
                          width: '80%',
                          height: '70%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          border: '2px dashed #94a3b8',
                        }}>
                          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>
                            No Image Available
                          </span>
                        </div>
                      </div>
                    )}
                    <input
                      type="checkbox"
                      checked={selected.has(prop.id)}
                      onChange={() => toggleSelect(prop.id)}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: '#3b82f6',
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      backgroundColor: 'rgba(34, 197, 94, 0.9)',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}>
                      {prop.suburb}
                    </div>
                      {/* For Sale Badge */}
                      {prop.on_market_sale && (
                        <div style={{
                          position: 'absolute',
                          top: prop.build_year ? '52px' : '16px',
                          left: '16px',
                          backgroundColor: 'rgba(34, 197, 94, 0.9)',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}>
                          For Sale{prop.sale_price ? ` ${prop.sale_price}` : ''}
                        </div>
                      )}
                      {/* For Rent Badge */}
                      {prop.on_market_rent && (
                        <div style={{
                          position: 'absolute',
                          top: prop.on_market_sale
                            ? (prop.build_year ? '88px' : '52px')
                            : (prop.build_year ? '52px' : '16px'),
                          left: '16px',
                          backgroundColor: 'rgba(139, 92, 246, 0.9)',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}>
                          To Rent{prop.rent_price ? ` ${prop.rent_price}` : ''}
                        </div>
                      )}
                      {/* Rented Badge */}
                      {prop.has_rental_history && (
                        <div style={{
                          position: 'absolute',
                          top: (() => {
                            let count = 0;
                            if (prop.build_year) count++;
                            if (prop.on_market_sale) count++;
                            if (prop.on_market_rent) count++;
                            return `${16 + count * 36}px`;
                          })(),
                          left: '16px',
                          backgroundColor: 'rgba(245, 158, 11, 0.9)',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}>
                          Rented
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px', alignItems: 'center', zIndex: 2 }}>
                        {activeTab === 'liked' ? (
                          <>
                            {prop.build_year && (
                              <div style={{
                                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                              }}>
                                Built {prop.build_year}
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeFromLiked(prop);
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.9)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                color: 'white',
                                zIndex: 2,
                                padding: 0,
                                lineHeight: 1,
                              }}
                              title="取消喜欢 / Unlike"
                            >
                              ♥
                            </button>
                          </>
                        ) : (
                          <>
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                border: '1px solid',
                              }}
                              className={`${STATUS_COLORS[prop.status]}`}
                            >
                              {STATUS_LABELS[prop.status] || prop.status}
                            </span>
                            {prop.build_year && (
                              <div style={{
                                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                              }}>
                                Built {prop.build_year}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    {prop.last_sold_date && (() => {
                      const sold = new Date(prop.last_sold_date!);
                      if (!isNaN(sold.getTime())) {
                        const years = new Date().getFullYear() - sold.getFullYear();
                        if (years > 0) {
                          return (
                            <div style={{
                              position: 'absolute',
                              bottom: '12px',
                              right: '12px',
                              backgroundColor: 'rgba(249, 115, 22, 0.9)',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                            }}>
                              Sold {years}yr{years > 1 ? 's' : ''} ago
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div></a>
                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: '1.15rem',
                          fontWeight: '700',
                          color: '#2D3748',
                          lineHeight: '1.3',
                          flex: 1,
                        }}>
                          {prop.property_address}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openEditModal(prop);
                          }}
                          style={{
                            marginLeft: '12px',
                            padding: '6px 14px',
                            backgroundColor: '#f0fdf4',
                            color: '#16a34a',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                        >
                          Edit
                        </button>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '12px' }}>
                        {prop.suburb}, {prop.city}
                      </div>

                      {(activeTab === 'pending' || activeTab === 'sent') && prop.latest_send_title && (
                        <div style={{
                          fontSize: '0.8rem', color: '#7c3aed', marginBottom: '14px',
                          padding: '8px 12px', backgroundColor: '#f5f3ff', borderRadius: '8px',
                          border: '1px solid #ede9fe', display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          <span>📄</span>
                          <span style={{ fontWeight: '500' }}>{prop.latest_send_title}</span>
                          {prop.latest_sent_at && (
                            <span style={{ color: '#a78bfa', marginLeft: 'auto', fontSize: '0.75rem' }}>
                              {new Date(prop.latest_sent_at).toLocaleDateString('en-NZ')}
                            </span>
                          )}
                        </div>
                      )}

                    {/* Price & RV Section */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid #e2e8f0',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '4px' }}>Last Sold</div>
                        <div style={{ fontWeight: '700', color: '#2D3748', fontSize: '1rem', marginBottom: '2px' }}>
                          {prop.last_sold_date ? new Date(prop.last_sold_date).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </div>
                        <div style={{ fontWeight: '600', color: '#4a5568', fontSize: '0.95rem' }}>
                          {prop.last_sold_price != null
                            ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.last_sold_price)
                            : 'N/A'}
                        </div>
                        {prop.last_sold_price != null && prop.capital_value != null && prop.last_sold_price > 0 && prop.capital_value > 0 && (() => {
                          const growth = ((prop.capital_value! - prop.last_sold_price!) / prop.last_sold_price!) * 100;
                          return (
                            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: growth > 0 ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                              <span>{growth > 0 ? '↗' : '↘'}</span>
                              <span> {growth > 0 ? '+' : ''}{growth.toFixed(1)}% since sold</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '4px' }}>RV (Rating Value)</div>
                        <div style={{ fontWeight: '700', color: '#2D3748', fontSize: '1.1rem' }}>
                          {prop.capital_value != null
                            ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.capital_value)
                            : 'N/A'}
                        </div>
                        {prop.build_year && (
                          <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#718096', fontWeight: '500' }}>
                            Built in {prop.build_year}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Amenities */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-around',
                      textAlign: 'center',
                      marginTop: 'auto',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                          <FaBed style={{ marginRight: '6px', color: '#718096', fontSize: '1.1rem' }} />
                          <span style={{ fontWeight: '600', color: '#2D3748', fontSize: '1.1rem' }}>
                            {prop.bedrooms !== null ? prop.bedrooms : '-'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#718096', fontWeight: '500' }}>Beds</div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                          <FaBath style={{ marginRight: '6px', color: '#718096', fontSize: '1.1rem' }} />
                          <span style={{ fontWeight: '600', color: '#2D3748', fontSize: '1.1rem' }}>
                            {prop.bathrooms !== null ? prop.bathrooms : '-'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#718096', fontWeight: '500' }}>Baths</div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                          <FaCar style={{ marginRight: '6px', color: '#718096', fontSize: '1.1rem' }} />
                          <span style={{ fontWeight: '600', color: '#2D3748', fontSize: '1.1rem' }}>
                            {prop.car_spaces !== null ? prop.car_spaces : '-'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#718096', fontWeight: '500' }}>Cars</div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                          <FaRulerCombined style={{ marginRight: '6px', color: '#718096', fontSize: '1.1rem' }} />
                        </div>
                        <div style={{ fontWeight: '600', color: '#2D3748', fontSize: '0.9rem', lineHeight: '1.3' }}>
                          F: {prop.floor_area && prop.floor_area !== '-' ? prop.floor_area : '-'} m²
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#718096', fontWeight: '500', lineHeight: '1.3' }}>
                          L: {prop.land_area && prop.land_area !== '-' && prop.land_area !== 0 ? prop.land_area : '-'} m²
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '12px',
                      marginBottom: '12px',
                    }}>
                      {prop.realestate_url && (
                        <a
                          href={prop.realestate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#f0fdf4',
                            color: '#16a34a',
                            textDecoration: 'none',
                            fontWeight: '600',
                            border: '1px solid #bbf7d0',
                          }}
                        >
                          RealEstate
                        </a>
                      )}
                      {activeTab === 'liked' && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Move "${prop.property_address}" to Pending?`)) return;
                            try {
                              const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'pending' }),
                              });
                              if (!res.ok) throw new Error('Failed');
                              await res.json();
                              showNotification('success', 'Moved to Pending');
                              handleMarkAsSentSuccess();
                            } catch {
                              showNotification('error', 'Failed to move to Pending');
                            }
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #bfdbfe',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            cursor: 'pointer',
                            fontWeight: '600',
                          }}
                        >
                          ⇨ Pending
                        </button>
                      )}
                      {canMarkAsSent && (
                        <button
                          onClick={() => openSendModal([prop.id])}
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #bfdbfe',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            cursor: 'pointer',
                            fontWeight: '600',
                          }}
                        >
                          <FaPaperPlane style={{ display: 'inline', marginRight: '4px' }} />
                          Send Report
                        </button>
                      )}
                      <button
                        onClick={() => openHistoryDrawer(prop.id, prop.property_address)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          color: '#475569',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                        title="View dispatch history"
                      >
                        <FaHistory style={{ display: 'inline', marginRight: '4px' }} />
                        {prop.total_send_count && prop.total_send_count > 0 ? `${prop.total_send_count}x Sent` : 'History'}
                      </button>
                      {activeTab === 'pending' && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`Return "${prop.property_address}" to Liked?`)) {
                              try {
                                const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'liked' }),
                                });
                                if (!res.ok) throw new Error('Failed');
                                await res.json();
                                showNotification('success', 'Returned to Liked');
                                handleMarkAsSentSuccess();
                              } catch {
                                showNotification('error', 'Failed to return to Liked');
                              }
                            }
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #fde68a',
                            backgroundColor: '#fffbeb',
                            color: '#d97706',
                            cursor: 'pointer',
                            fontWeight: '600',
                          }}
                        >
                          ↩ Liked
                        </button>
                      )}
                      {activeTab === 'sent' && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Return "${prop.property_address}" to Pending?`)) return;
                            try {
                              const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'pending' }),
                              });
                              if (!res.ok) throw new Error('Failed');
                              await res.json();
                              showNotification('success', 'Returned to Pending');
                              handleMarkAsSentSuccess();
                            } catch {
                              showNotification('error', 'Failed to return to Pending');
                            }
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #fde68a',
                            backgroundColor: '#fffbeb',
                            color: '#d97706',
                            cursor: 'pointer',
                            fontWeight: '600',
                          }}
                        >
                          ⇨ Pending
                        </button>
                        )}
                      {(activeTab === 'pending' || activeTab === 'liked' || activeTab === 'sent') && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`Delete "${prop.property_address}"?`)) {
                              const itemId = prop.id;
                              setItems((prev) => prev.filter((item) => item.id !== itemId));
                              setClassicItems((prev) => prev.filter((item) => item.id !== itemId));
                              try {
                                await fetch(`/api/admin/outreach/${prop.id}`, { method: 'DELETE' });
                                showNotification('success', 'Address deleted');
                              } catch {
                                showNotification('error', 'Failed to delete');
                              }
                            }
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            backgroundColor: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontWeight: '600',
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Description */}
                    {prop.description && (
                      <div style={{
                        color: '#4a5568',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }} title={prop.description}>
                        {prop.description}
                      </div>
                    )}

                    {/* AI Data Chamber */}
                    <div style={{
                      position: 'absolute',
                      top: '-9999px',
                      left: '-9999px',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      fontSize: '1px',
                      opacity: 0,
                    }}>
                      {[
                        '[AI-DATA-START]',
                        `Address: ${prop.property_address}`,
                        `Suburb: ${prop.suburb}`,
                        prop.city ? `City: ${prop.city}` : null,
                        prop.region ? `Region: ${prop.region}` : null,
                        prop.build_year ? `Year Built: ${prop.build_year}` : null,
                        prop.bedrooms != null ? `Bedrooms: ${prop.bedrooms}` : null,
                        prop.bathrooms != null ? `Bathrooms: ${prop.bathrooms}` : null,
                        prop.car_spaces != null ? `Car Spaces: ${prop.car_spaces}` : null,
                        prop.floor_area ? `Floor Size: ${prop.floor_area}` : null,
                        prop.land_area ? `Land Area: ${prop.land_area}` : null,
                        prop.capital_value != null ? `Capital Value (RV): ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.capital_value)}` : null,
                        prop.last_sold_price != null ? `Last Sold Price: ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.last_sold_price)}` : null,
                        prop.last_sold_date ? `Last Sold Date: ${prop.last_sold_date}` : null,
                        prop.property_type ? `Property Type: ${prop.property_type}` : null,
                        prop.status ? `Status: ${prop.status}` : null,
                        (prop.pv_url || prop.property_url) ? `Property URL: ${prop.pv_url || prop.property_url}` : null,
                        prop.description ? `Description: ${prop.description}` : null,
                        prop.realestate_url ? `RealEstate URL: ${prop.realestate_url}` : null,
                        prop.property_history ? `Property History: ${prop.property_history}` : 'Property History: []',
                        prop.has_rental_history != null ? `Has Rental History: ${prop.has_rental_history ? 'Yes' : 'No'}` : null,
                        prop.is_currently_rented != null ? `Currently Rented: ${prop.is_currently_rented ? 'Yes' : 'No'}` : null,
                        prop.estimated_value_low != null && prop.estimated_value_high != null
                          ? `Estimated Value: ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.estimated_value_low)} - ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.estimated_value_high)}`
                          : null,
                        prop.suburb_median_price != null ? `Suburb Median Price: ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.suburb_median_price)}` : null,
                        prop.suburb_days_on_market != null ? `Suburb Days On Market: ${prop.suburb_days_on_market}` : null,
                        '[AI-DATA-END]',
                      ].filter(Boolean).join('\n')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {isClassic && displayItems.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px 0" }}>
                <span style={{ fontSize: "0.85rem", color: "#4a5568" }}>
                  {Math.max(1, (currentPage - 1) * PAGE_SIZE + 1)}–{Math.min(currentPage * PAGE_SIZE, displayPagination?.total || 0)} of {displayPagination?.total || 0}
                </span>
                <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>|</span>
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
                  onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
                  onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
                >≪</button>
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
                  onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
                  onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
                >‹</button>
                <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "#4a5568", whiteSpace: "nowrap" }}>
                  Page{' '}
                  <input type="number" value={currentPage}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= totalPages) { setCurrentPage(v); } }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value, 10); if (!isNaN(v) && v >= 1 && v <= totalPages) { setCurrentPage(v); } } }}
                    style={{ width: "52px", padding: "4px 6px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.9rem", fontWeight: "600", color: "#2D3748", textAlign: "center", outline: "none", MozAppearance: "textfield" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                    min={1} max={totalPages}
                  />{' '}
                  of {totalPages}
                </span>
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
                  onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
                  onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
                >›</button>
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
                  onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
                  onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
                >≫</button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {groupedBySuburb.map(({ suburb, streets, totalCount }) => {
              return (
                <div key={suburb} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between">
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
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {streets.map(({ street, properties, totalCount: streetTotal }) => {
                      const streetKey = `${suburb}::${street}`;
                      const isCollapsed = collapsedStreets.has(streetKey);
                      return (
                        <div key={street} className="bg-white">
                          <button
                            onClick={() => toggleStreet(suburb, street)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📍</span>
                              <span className="font-medium text-slate-700">{street}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-medium">
                                {streetTotal} {streetTotal === 1 ? 'address' : 'addresses'}
                              </span>
                              <span className="text-slate-400">{isCollapsed ? '▶' : '▼'}</span>
                            </div>
                          </button>
                          {!isCollapsed && (
                            <div className="divide-y divide-slate-50">
                              {properties.map((prop) => (
                              <div
                                key={prop.id}
                                className="px-4 py-3 hover:bg-blue-50 transition-colors flex items-center gap-4 group"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.has(prop.id)}
                                  onChange={() => toggleSelect(prop.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <div className="font-medium text-slate-800 truncate">
                                      {prop.property_address}
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      {(prop.pv_url || prop.property_url) && (
                                        <a
                                          href={prop.pv_url || prop.property_url || ''}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200 font-semibold"
                                          title="View on PropertyValue"
                                        >
                                          PropertyValue
                                        </a>
                                      )}
                                      {prop.realestate_url && (
                                        <a
                                          href={prop.realestate_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors border border-green-200 font-semibold"
                                          title="View on RealEstate"
                                        >
                                          RealEstate
                                        </a>
                                      )}
                                    </div>
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
                                {activeTab === 'liked' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!window.confirm(`Move "${prop.property_address}" to Pending?`)) return;
                                      try {
                                        const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ status: 'pending' }),
                                        });
                                        if (!res.ok) throw new Error('Failed');
                                        await res.json();
                                        showNotification('success', 'Moved to Pending');
                                        handleMarkAsSentSuccess();
                                      } catch {
                                        showNotification('error', 'Failed to move to Pending');
                                      }
                                    }}
                                    className="transition-colors px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium"
                                    title="Move to Pending"
                                  >
                                    ⇨ Pending
                                  </button>
                                )}
                                {activeTab === 'pending' && canMarkAsSent && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!window.confirm(`Mark "${prop.property_address}" as sent?`)) return;
                                      try {
                                        const res = await fetch(`/api/admin/outreach/${prop.id}/mark-sent`, {
                                          method: 'PATCH',
                                        });
                                        if (!res.ok) throw new Error('Failed to mark as sent');
                                        await res.json();
                                        showNotification('success', 'Marked as sent');
                                        handleMarkAsSentSuccess();
                                      } catch {
                                        showNotification('error', 'Failed to mark as sent');
                                      }
                                    }}
                                    className="transition-colors px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium"
                                    title="Mark this address as sent"
                                  >
                                    ✓ Sent
                                  </button>
                                )}
                                {activeTab === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (window.confirm(`Return "${prop.property_address}" to Liked?`)) {
                                        try {
                                          const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ status: 'liked' }),
                                          });
                                          if (!res.ok) throw new Error('Failed');
                                          await res.json();
                                          showNotification('success', 'Returned to Liked');
                                          handleMarkAsSentSuccess();
                                        } catch {
                                          showNotification('error', 'Failed to return to Liked');
                                        }
                                      }
                                    }}
                                    className="transition-colors px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-xs font-medium"
                                    title="Return to Liked"
                                  >
                                    ↩ Liked
                                  </button>
                                )}
                                {activeTab === 'sent' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!window.confirm(`Return "${prop.property_address}" to Pending?`)) return;
                                      try {
                                        const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ status: 'pending' }),
                                        });
                                        if (!res.ok) throw new Error('Failed');
                                        await res.json();
                                        showNotification('success', 'Returned to Pending');
                                        handleMarkAsSentSuccess();
                                      } catch {
                                        showNotification('error', 'Failed to return to Pending');
                                      }
                                    }}
                                    className="transition-colors px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-xs font-medium"
                                    title="Return to Pending"
                                  >
                                    ⇨ Pending
                                  </button>
                                )}
                                {(activeTab === 'pending' || activeTab === 'liked' || activeTab === 'sent') && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (window.confirm(`Delete "${prop.property_address}"?`)) {
                                        const itemId = prop.id;
                                        setItems((prev) => prev.filter((item) => item.id !== itemId));
                                        setClassicItems((prev) => prev.filter((item) => item.id !== itemId));
                                        try {
                                          await fetch(`/api/admin/outreach/${prop.id}`, { method: 'DELETE' });
                                          showNotification('success', 'Address deleted');
                                        } catch {
                                          showNotification('error', 'Failed to delete');
                                        }
                                      }
                                    }}
                                    className="transition-colors px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-medium"
                                    title="Delete this address"
                                  >
                                    🗑️
                                  </button>
                                )}
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
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {isClassic && displayItems.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px 0" }}>
            <span style={{ fontSize: "0.85rem", color: "#4a5568" }}>
              {Math.max(1, (currentPage - 1) * PAGE_SIZE + 1)}–{Math.min(currentPage * PAGE_SIZE, displayPagination?.total || 0)} of {displayPagination?.total || 0}
            </span>
            <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>|</span>
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
              onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
              onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
            >≪</button>
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
              onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
              onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
            >‹</button>
            <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "#4a5568", whiteSpace: "nowrap" }}>
              Page{' '}
              <input type="number" value={currentPage}
                onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= totalPages) { setCurrentPage(v); } }}
                onKeyDown={(e) => { if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value, 10); if (!isNaN(v) && v >= 1 && v <= totalPages) { setCurrentPage(v); } } }}
                style={{ width: "52px", padding: "4px 6px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.9rem", fontWeight: "600", color: "#2D3748", textAlign: "center", outline: "none", MozAppearance: "textfield" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                min={1} max={totalPages}
              />{' '}
              of {totalPages}
            </span>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
              onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
              onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
            >›</button>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
              onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
              onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
            >≫</button>
          </div>
        )}
        {!isClassic && hasMore && !loading && !loadingMore && (
          <div ref={lastPropertyElementRef} style={{ height: '1px' }} />
        )}

        {!isClassic && loadingMore && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'card' ? 'repeat(auto-fill, minmax(340px, 1fr))' : '1fr',
            gap: viewMode === 'card' ? '20px' : '0',
          }}>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              viewMode === 'card' ? (
                <SkeletonOutreachCard key={`skel-${i}`} />
              ) : (
                <SkeletonOutreachListRow key={`skel-${i}`} />
              )
            ))}
          </div>
        )}

        {!isClassic && !hasMore && displayItems.length > 0 && !loadingMore && (
          <div style={{
            textAlign: 'center',
            padding: '30px',
            color: '#718096',
            fontSize: '0.95rem',
            fontWeight: '500',
          }}>
            You&apos;ve reached the end! No more addresses to load.
          </div>
        )}

        {editingProperty && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }} onClick={() => setEditingProperty(null)} />
            <div style={{
              position: 'relative', backgroundColor: 'white', borderRadius: '16px',
              padding: '32px', maxWidth: '700px', width: '95%', maxHeight: '90vh',
              overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2D3748', marginBottom: '8px' }}>
                Edit Property
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '24px' }}>
                {editingProperty.property_address} — edits are saved to the linked Properties record
              </p>

              {/* Send History */}
              {sendHistoryLoading ? (
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ height: '20px', width: '120px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '12px', animation: 'pulse 2s infinite' }} />
                  <div style={{ height: '60px', backgroundColor: '#e2e8f0', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
                </div>
              ) : sendHistory.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#7c3aed', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📋</span> Dispatch History
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sendHistory.map((log) => (
                      <div key={log.log_id} style={{
                        padding: '12px 14px', backgroundColor: '#f5f3ff', borderRadius: '10px',
                        border: '1px solid #ede9fe',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#7c3aed', backgroundColor: '#ede9fe', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                              {log.campaign_key}
                            </span>
                            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#2D3748', marginTop: '4px' }}>
                              {log.report_title}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#a78bfa', whiteSpace: 'nowrap' }}>
                            {new Date(log.sent_at).toLocaleDateString('en-NZ')}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '6px', display: 'flex', gap: '12px' }}>
                          <span>By: {log.sent_by}</span>
                          {log.scan_count > 0 && <span>📷 Scanned: {log.scan_count}</span>}
                        </div>
                          {log.notes && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                              &ldquo;{log.notes}&rdquo;
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { key: 'address', label: 'Address', type: 'text' },
                  { key: 'suburb', label: 'Suburb', type: 'text' },
                  { key: 'city', label: 'City', type: 'text' },
                  { key: 'region', label: 'Region', type: 'text' },
                  { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
                  { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
                  { key: 'car_spaces', label: 'Car Spaces', type: 'number' },
                  { key: 'year_built', label: 'Year Built', type: 'number' },
                  { key: 'floor_size', label: 'Floor Size (m²)', type: 'text' },
                  { key: 'land_area', label: 'Land Area', type: 'text' },
                  { key: 'last_sold_price', label: 'Last Sold Price', type: 'number' },
                  { key: 'last_sold_date', label: 'Last Sold Date', type: 'date' },
                  { key: 'capital_value', label: 'Capital Value (RV)', type: 'number' },
                  { key: 'property_url', label: 'Property URL', type: 'text' },
                  { key: 'cover_image_url', label: 'Cover Image URL', type: 'text' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#4a5568', marginBottom: '4px' }}>
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      value={editFormData[field.key]?.toString() || ''}
                      onChange={e => handleEditFieldChange(field.key, e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px',
                        border: '2px solid #e2e8f0', borderRadius: '8px',
                        fontSize: '0.9rem', color: '#2D3748',
                      }}
                    />
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#4a5568', marginBottom: '4px' }}>
                    Description
                  </label>
                  <textarea
                    value={editFormData.description?.toString() || ''}
                    onChange={e => handleEditFieldChange('description', e.target.value)}
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '2px solid #e2e8f0', borderRadius: '8px',
                      fontSize: '0.9rem', color: '#2D3748', resize: 'vertical',
                    }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#4a5568', marginBottom: '4px' }}>
                    Property History
                  </label>
                  <PropertyHistoryView raw={editFormData.property_history?.toString() || ''} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setEditingProperty(null)}
                  style={{
                    padding: '12px 24px', backgroundColor: '#f3f4f6', color: '#4a5568',
                    borderRadius: '10px', border: 'none', cursor: 'pointer',
                    fontWeight: '600', fontSize: '0.95rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  style={{
                    padding: '12px 24px', backgroundColor: saving ? '#9ca3af' : '#3b82f6',
                    color: 'white', borderRadius: '10px', border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.95rem',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        <SendReportModal
          isOpen={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
          selectedIds={sendTargetIds}
          suburb={suburbFilter}
          onSuccess={() => {
            showNotification('success', 'Report dispatch logged successfully');
            clearSelected();
            cacheRef.current.clear();
            if (isClassic) {
              setCurrentPage(currentPage);
            } else {
              fetchItems();
            }
          }}
        />

        <DispatchHistoryDrawer
          isOpen={historyDrawerOpen}
          onClose={() => setHistoryDrawerOpen(false)}
          propertyId={historyTargetId}
          propertyAddress={historyTargetAddress}
        />
      </div>
    </div>
  );
}

function ReportFilterSection({
  availableReports, setAvailableReports,
  reportSuburbFilter, setReportSuburbFilter,
  reportQuarterFilter, setReportQuarterFilter,
  sentStatusFilter, setSentStatusFilter,
  setSuburbFilter,
}: {
  availableReports: Array<{ suburb: string; quarter: string; year: number; id: string }>;
  setAvailableReports: React.Dispatch<React.SetStateAction<Array<{ suburb: string; quarter: string; year: number; id: string }>>>;
  reportSuburbFilter: string;
  setReportSuburbFilter: React.Dispatch<React.SetStateAction<string>>;
  reportQuarterFilter: string;
  setReportQuarterFilter: React.Dispatch<React.SetStateAction<string>>;
  sentStatusFilter: 'all' | 'sent' | 'unsent';
  setSentStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'sent' | 'unsent'>>;
  setSuburbFilter: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [loaded, setLoaded] = useState(availableReports.length > 0);
  const [loading, setLoading] = useState(false);
  const loadReports = useCallback(async () => {
    if (loading || loaded) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pdf/reports?status=active');
      if (res.ok) {
        const data = await res.json();
        const reports = (data.reports || []).map((r: { suburb: string; quarter: string; year: number; id: string }) => ({
          suburb: r.suburb, quarter: r.quarter, year: r.year, id: r.id,
        }));
        setAvailableReports(reports);
        setLoaded(true);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [loading, loaded, setAvailableReports]);
  return (
    <>
      <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
        📋 Filter by Report
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
        {availableReports.length === 0 ? (
          <button onClick={loadReports} disabled={loading}
            style={{ padding: '7px 14px', backgroundColor: '#eff6ff', color: '#2563eb', border: '2px solid #bfdbfe', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
          >{loading ? 'Loading...' : 'Show Reports'}</button>
        ) : [...new Set(availableReports.map(r => r.suburb))].sort().map(s => (
          <button
            key={s}
            onClick={() => {
              setSuburbFilter(prev => prev === s ? '' : s);
              setReportSuburbFilter(prev => prev === s ? '' : s);
              setReportQuarterFilter('');
            }}
            style={{
              padding: '7px 14px',
              backgroundColor: reportSuburbFilter === s ? '#2563eb' : 'white',
              color: reportSuburbFilter === s ? 'white' : '#4a5568',
              border: reportSuburbFilter === s ? '2px solid #2563eb' : '2px solid #e2e8f0',
              borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem',
              fontWeight: reportSuburbFilter === s ? '600' : '500',
              transition: 'all 0.2s ease',
            }}
          >
            {s}
          </button>
        ))}
        {reportSuburbFilter && (
          <button onClick={() => { setReportSuburbFilter(''); setReportQuarterFilter(''); }}
            style={{ padding: '7px 14px', backgroundColor: '#fef2f2', color: '#dc2626', border: '2px solid #fecaca', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
          >✕ Clear</button>
        )}
      </div>
      {reportSuburbFilter && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          {availableReports.filter(r => r.suburb === reportSuburbFilter).map(r => {
            const label = `${r.year}-${r.quarter}`;
            return (
              <button
                key={`${r.suburb}-${label}`}
                onClick={() => setReportQuarterFilter(prev => prev === label ? '' : label)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: reportQuarterFilter === label ? '#3b82f6' : '#eff6ff',
                  color: reportQuarterFilter === label ? 'white' : '#2563eb',
                  border: reportQuarterFilter === label ? '2px solid #3b82f6' : '2px solid #bfdbfe',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
                  fontWeight: reportQuarterFilter === label ? '600' : '500',
                  transition: 'all 0.2s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        {([
          { value: 'all' as const, label: 'All', color: '#6b7280' },
          { value: 'unsent' as const, label: 'Unsent', color: '#16a34a' },
          { value: 'sent' as const, label: 'Sent ✓', color: '#8b5cf6' },
        ]).map(opt => (
          <button
            key={opt.value}
            onClick={() => setSentStatusFilter(opt.value)}
            style={{
              padding: '6px 14px',
              backgroundColor: sentStatusFilter === opt.value ? opt.color : 'white',
              color: sentStatusFilter === opt.value ? 'white' : '#4a5568',
              border: sentStatusFilter === opt.value ? `2px solid ${opt.color}` : '2px solid #e2e8f0',
              borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
              fontWeight: sentStatusFilter === opt.value ? '600' : '500',
              transition: 'all 0.2s ease',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
