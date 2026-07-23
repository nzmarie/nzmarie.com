'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { isAdmin } from '@/lib/permissions';
import { getFixedImageUrl } from '@/lib/google-maps';
import { FaBed, FaBath, FaCar, FaRulerCombined, FaMapMarkerAlt } from 'react-icons/fa';
import { LeadEditModal } from '@/components/admin/LeadEditModal';
import { PropertyEditModal } from '@/components/admin/PropertyEditModal';

interface Lead {
  id: string;
  property_address: string;
  street?: string;
  suburb?: string;
  city?: string;
  region?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  source: string;
  source_outreach_id?: string;
  status: string;
  priority: string;
  summary?: string;
  notes?: string;
  next_action?: string;
  next_action_at?: string;
  last_contacted_at?: string;
  created_at: string;
  updated_at: string;
  // Joined from properties table
  image_url?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  garages?: number | null;
  rv?: number | null;
  build_year?: number | null;
  floor_area?: string | null;
  land_area?: number | string | null;
  last_sold_price?: number | null;
  last_sold_date?: string | null;
  property_url?: string | null;
  description?: string | null;
  joined_property_id?: string | null;
  has_rental_history?: boolean | null;
  is_currently_rented?: boolean | null;
  estimated_value_low?: number | null;
  estimated_value_high?: number | null;
  property_history?: string | null;
  realestate_url?: string | null;
  on_market_sale?: boolean;
  sale_listing_status?: string | null;
  sale_price?: string | null;
  sale_agent?: string | null;
  on_market_rent?: boolean;
  rent_listing_status?: string | null;
  rent_price?: string | null;
}

interface LeadEvent {
  id: string;
  lead_id: string;
  event_type: string;
  title: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  appointment_scheduled: 'Appt. Scheduled',
  appraised: 'Appraised',
  converted: 'Converted',
  lost: 'Lost',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  appointment_scheduled: 'bg-purple-100 text-purple-700',
  appraised: 'bg-indigo-100 text-indigo-700',
  converted: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-700',
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  phone_call: '📞',
  email: '📧',
  sms: '💬',
  note: '📝',
  appointment: '📅',
  appraisal: '📋',
  status_change: '🔄',
};

export default function LeadsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Lead>>({});

  const [leadEditOpen, setLeadEditOpen] = useState(false);
  const [leadEditData, setLeadEditData] = useState<Partial<Lead>>({});
  const [leadEditLoading, setLeadEditLoading] = useState(false);

  const [propertyEditOpen, setPropertyEditOpen] = useState(false);
  const [propertyEditData, setPropertyEditData] = useState<Partial<Lead>>({});
  const [propertyEditLoading, setPropertyEditLoading] = useState(false);

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ event_type: 'note', title: '', description: '' });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const notify = useCallback((type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '50');

      const res = await fetch(`/api/admin/leads?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setLeads(json.data || []);
      setPagination(json.pagination || null);
    } catch {
      notify('error', 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, sourceFilter, search, page, notify]);

  useEffect(() => {
    if (session?.user && isAdmin(session.user.email)) {
      fetchLeads();
    }
  }, [session, fetchLeads]);

  if (!session?.user) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading...</div>;
  }
  if (!isAdmin(session.user.email)) {
    router.push('/');
    return null;
  }

  const openDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/events`);
      const json = await res.json();
      setEvents(json.data || []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const openEdit = (lead: Lead) => {
    setEditData({ ...lead });
    setEditOpen(true);
  };

  const openLeadEdit = (lead: Lead) => {
    setLeadEditData({ ...lead });
    setLeadEditOpen(true);
  };

  const openPropertyEdit = (lead: Lead) => {
    setPropertyEditData({ ...lead });
    setPropertyEditOpen(true);
  };

  // Listen for global edit/convert events to maintain consistency with properties page
  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent).detail as any;
      // payload may be a Lead or Property-like object; treat it as the selected lead
      setSelectedLead(payload);
      setPropertyEditData({ ...payload });
      setPropertyEditOpen(true);
    };
    window.addEventListener('open-edit-modal', handler);
    return () => window.removeEventListener('open-edit-modal', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent).detail as any;
      // Open the lead edit modal for the given payload
      setSelectedLead(payload);
      setLeadEditData({ ...payload });
      setLeadEditOpen(true);
    };
    window.addEventListener('open-convert-modal', handler);
    return () => window.removeEventListener('open-convert-modal', handler);
  }, []);

  const handleLeadEditDataChange = (key: string, value: string | number | boolean) => {
    setLeadEditData(prev => ({ ...prev, [key]: value }));
  };

  const handlePropertyEditDataChange = (key: string, value: string | number | boolean) => {
    setPropertyEditData(prev => ({ ...prev, [key]: value }));
  };

  const saveLeadEdit = async () => {
    if (!selectedLead) return;
    setLeadEditLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadEditData),
      });
      if (!res.ok) throw new Error('Failed to update');
      const json = await res.json();
      setSelectedLead(json.data);
      setLeads(prev => prev.map(l => l.id === json.data.id ? json.data : l));
      setLeadEditOpen(false);
      notify('success', 'Lead updated');
    } catch {
      notify('error', 'Failed to update lead');
    } finally {
      setLeadEditLoading(false);
    }
  };

  const savePropertyEdit = async () => {
    if (!selectedLead || !selectedLead.joined_property_id) return;
    setPropertyEditLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {};
      
      const fieldMappings: Record<string, string> = {
        address: 'address',
        suburb: 'suburb',
        city: 'city',
        region: 'region',
        postcode: 'postcode',
        bedrooms: 'bedrooms',
        bathrooms: 'bathrooms',
        car_spaces: 'garages',
        year_built: 'build_year',
        floor_size: 'floor_area',
        land_area: 'land_area',
        last_sold_price: 'last_sold_price',
        last_sold_date: 'last_sold_date',
        capital_value: 'rv',
        property_url: 'property_url',
        cover_image_url: 'image_url',
        description: 'description',
      };

      Object.entries(fieldMappings).forEach(([editKey, dbKey]) => {
        if (propertyEditData[editKey as keyof typeof propertyEditData] !== undefined) {
          const value = propertyEditData[editKey as keyof typeof propertyEditData];
          payload[dbKey] = value === '' ? null : value;
        }
      });

      const res = await fetch(`/api/admin/properties/${selectedLead.joined_property_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) throw new Error('Failed to update property');
      
      const updated = await res.json();
      setLeads(prev => prev.map(l => 
        l.joined_property_id === selectedLead.joined_property_id 
          ? { ...l, ...updated.data }
          : l
      ));
      setPropertyEditOpen(false);
      notify('success', 'Property updated');
    } catch {
      notify('error', 'Failed to update property');
    } finally {
      setPropertyEditLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedLead) return;
    try {
      const res = await fetch(`/api/admin/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (!res.ok) throw new Error('Failed to update');
      const json = await res.json();
      setSelectedLead(json.data);
      setLeads(prev => prev.map(l => l.id === json.data.id ? json.data : l));
      setEditOpen(false);
      notify('success', 'Lead updated');
    } catch {
      notify('error', 'Failed to update lead');
    }
  };

  const addEvent = async () => {
    if (!selectedLead || !eventForm.title) return;
    try {
      const res = await fetch(`/api/admin/leads/${selectedLead.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventForm),
      });
      if (!res.ok) throw new Error('Failed to add event');
      const json = await res.json();
      setEvents(prev => [json.data, ...prev]);
      setEventModalOpen(false);
      setEventForm({ event_type: 'note', title: '', description: '' });
      notify('success', 'Event added');
    } catch {
      notify('error', 'Failed to add event');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'card' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              ⊞ Cards
            </button>
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              ☰ List
            </button>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!statusFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          All
        </button>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => { setStatusFilter(key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input type="text" placeholder="Search address, name, email, phone..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Sources</option>
          <option value="outreach">Outreach</option>
          <option value="phone">Phone</option>
          <option value="email">Email</option>
          <option value="manual">Manual</option>
        </select>
        {(statusFilter || priorityFilter || sourceFilter || search) && (
          <button onClick={() => { setStatusFilter(''); setPriorityFilter(''); setSourceFilter(''); setSearch(''); setPage(1); }}
            className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900">
            Clear
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-200 rounded w-1/3 mb-4" />
              <div className="h-8 bg-slate-200 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Card View */}
      {!loading && viewMode === 'card' && (
        <>
          {leads.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg font-medium mb-1">No leads found</p>
              <p className="text-sm">Convert an outreach or property to create a lead.</p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: "24px",
            }}>
              {leads.map(lead => {
                const fixedImageUrl = lead.image_url ? getFixedImageUrl(lead.image_url) : null;
                const formatCurrency = (amount: number | null | undefined) => {
                  if (amount === null || amount === undefined) return "N/A";
                  if (amount === 0) return "$0";
                  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 }).format(amount);
                };
                const formatDate = (dateString: string | null | undefined) => {
                  if (!dateString) return "N/A";
                  const date = new Date(dateString);
                  if (Number.isNaN(date.getTime())) return "N/A";
                  return date.toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" });
                };

                return (
                  <div
                    key={lead.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      overflow: "hidden",
                      boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
                      backgroundColor: 'white',
                      transition: "all 0.3s ease",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-8px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)";
                    }}
                    onClick={() => openDetail(lead)}
                  >
                    {/* Image section */}
                    <div style={{ position: "relative" }}>
                      <a
                        href={lead.property_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", height: "220px", textDecoration: "none", color: "inherit" }}
                        onClick={e => e.stopPropagation()}
                      >
                        {fixedImageUrl ? (
                          <Image
                            src={fixedImageUrl}
                            alt={lead.property_address}
                            unoptimized
                            width={400}
                            height={220}
                            style={{ objectFit: "cover", width: "100%", height: "220px" }}
                          />
                        ) : (
                          <div style={{
                            height: "220px",
                            background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#4a5568",
                            fontSize: "16px",
                            fontWeight: "600",
                          }}>
                            <div style={{
                              backgroundColor: "#e2e8f0",
                              width: "80%",
                              height: "70%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "8px",
                              border: "2px dashed #94a3b8",
                            }}>
                              <span style={{ color: "#64748b", fontSize: "14px", fontWeight: "500" }}>
                                No Image Available
                              </span>
                            </div>
                          </div>
                        )}
                      </a>

                      {/* Suburb badge */}
                      {lead.suburb && (
                        <div style={{
                          position: "absolute",
                          bottom: "16px",
                          left: "16px",
                          backgroundColor: "rgba(34, 197, 94, 0.9)",
                          color: "white",
                          padding: "6px 12px",
                          borderRadius: "20px",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                          textTransform: "capitalize",
                        }}>
                          {lead.suburb}
                        </div>
                      )}

                      {/* Status badge (replaces Like button) */}
                      <div style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: "12px",
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        color: ({
                          new: '#2563eb', contacted: '#d97706', appointment_scheduled: '#7c3aed', appraised: '#6366f1', converted: '#16a34a', lost: '#dc2626',
                        } as Record<string, string>)[lead.status] || '#64748b',
                      }}>
                        {STATUS_LABELS[lead.status] || lead.status}
                      </div>

                      {/* Priority badge */}
                      <div style={{
                        position: "absolute",
                        top: "12px",
                        left: "12px",
                        background: lead.priority === 'high' ? 'rgba(239, 68, 68, 0.9)' : lead.priority === 'medium' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(100, 116, 139, 0.9)',
                        color: "white",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        textTransform: "capitalize",
                      }}>
                        {lead.priority}
                      </div>

                      {/* Built year */}
                      {lead.build_year && (
                        <div style={{
                          position: "absolute",
                          top: "52px",
                          left: "12px",
                          backgroundColor: "rgba(59, 130, 246, 0.9)",
                          color: "white",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        }}>
                          Built {lead.build_year}
                        </div>
                      )}

                      {/* For Sale badge */}
                      {lead.on_market_sale && (
                        <div style={{
                          position: "absolute",
                          top: lead.build_year ? "88px" : "52px",
                          left: "12px",
                          backgroundColor: "rgba(34, 197, 94, 0.9)",
                          color: "white",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        }}>
                          For Sale{lead.sale_price ? ` ${lead.sale_price}` : ''}
                        </div>
                      )}

                      {/* For Rent badge */}
                      {lead.on_market_rent && (
                        <div style={{
                          position: "absolute",
                          top: (() => {
                            let count = 0;
                            if (lead.build_year) count++;
                            if (lead.on_market_sale) count++;
                            return `${16 + count * 36}px`;
                          })(),
                          left: "12px",
                          backgroundColor: "rgba(139, 92, 246, 0.9)",
                          color: "white",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        }}>
                          To Rent{lead.rent_price ? ` ${lead.rent_price}` : ''}
                        </div>
                      )}

                      {/* Years since last sold */}
                      {(() => {
                        if (!lead.last_sold_date) return null;
                        const soldDate = new Date(lead.last_sold_date);
                        if (Number.isNaN(soldDate.getTime())) return null;
                        const today = new Date();
                        const years = today.getFullYear() - soldDate.getFullYear();
                        if (years <= 0) return null;
                        return (
                          <div style={{
                            position: "absolute",
                            bottom: "16px",
                            right: "16px",
                            backgroundColor: "rgba(249, 115, 22, 0.9)",
                            color: "white",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                          }}>
                            Sold {years}yr{years > 1 ? 's' : ''} ago
                          </div>
                        );
                      })()}
                    </div>

                    {/* Body */}
                    <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
                      {/* Address + Actions */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "12px" }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: "1.1rem",
                          fontWeight: "700",
                          color: "#2D3748",
                          lineHeight: "1.3",
                          flex: 1,
                        }}>
                          {lead.property_address}
                        </h3>
                        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              // dispatch global convert-modal event for consistency with properties page
                              window.dispatchEvent(new CustomEvent('open-convert-modal', { detail: lead }));
                            }}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: '#f5f3ff',
                              color: '#a78bfa',
                              border: '1px solid #c4b5fd',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ede9fe'; e.currentTarget.style.borderColor = '#a78bfa'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f5f3ff'; e.currentTarget.style.borderColor = '#c4b5fd'; }}
                          >
                            Lead
                          </button>
                          {lead.joined_property_id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                // dispatch global edit-modal event for consistency with properties page
                                window.dispatchEvent(new CustomEvent('open-edit-modal', { detail: lead }));
                              }}
                              style={{
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
                          )}
                        </div>
                      </div>

                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "4px",
                        color: "#718096",
                        fontSize: "0.85rem",
                      }}>
                        <FaMapMarkerAlt style={{ marginRight: "6px", fontSize: "0.85rem" }} />
                        <span>{lead.suburb || 'Unknown'}{lead.city ? `, ${lead.city}` : ''}</span>
                        <span style={{ margin: '0 8px', color: '#cbd5e1' }}>·</span>
                        <span style={{ textTransform: 'capitalize' }}>{lead.source}</span>
                      </div>

                      {/* RealEstate link */}
                      {Boolean(lead.realestate_url) && (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                          <a
                            href={lead.realestate_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "0.75rem",
                              color: "#16a34a",
                              backgroundColor: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontWeight: "600",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            🏠 RealEstate
                          </a>
                        </div>
                      )}

                      {/* Last Sold + RV */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "16px",
                        paddingBottom: "16px",
                        borderBottom: "1px solid #e2e8f0",
                      }}>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: "4px" }}>Last Sold</div>
                          <div style={{ fontWeight: "700", color: "#2D3748", fontSize: "1rem", marginBottom: "4px" }}>
                            {formatDate(lead.last_sold_date)}
                          </div>
                          <div style={{ fontWeight: "600", color: "#4a5568", fontSize: "0.9rem" }}>
                            {formatCurrency(lead.last_sold_price)}
                          </div>
                          {lead.last_sold_price && lead.rv && lead.last_sold_price > 0 && lead.rv > 0 && (() => {
                            const growth = ((lead.rv - lead.last_sold_price) / lead.last_sold_price) * 100;
                            const isPositive = growth > 0;
                            return (
                              <div style={{
                                marginTop: "4px",
                                fontSize: "0.7rem",
                                color: isPositive ? "#16a34a" : "#dc2626",
                                fontWeight: "600",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}>
                                <span>{isPositive ? "↗" : "↘"}</span>
                                <span>{isPositive ? "+" : ""}{growth.toFixed(1)}% since sold</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: "4px" }}>RV (Rating Value)</div>
                          <div style={{ fontWeight: "700", color: "#2D3748", fontSize: "1.1rem" }}>
                            {formatCurrency(lead.rv)}
                          </div>
                          {Boolean(lead.build_year) && (
                            <div style={{ marginTop: "6px", fontSize: "0.7rem", color: "#718096", fontWeight: "500" }}>
                              Built in {lead.build_year}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bed/Bath/Car stats */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-around",
                        textAlign: "center",
                        marginBottom: "12px",
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
                            <FaBed style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
                            <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                              {lead.bedrooms !== null && lead.bedrooms !== undefined ? lead.bedrooms : "-"}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Beds</div>
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
                            <FaBath style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
                            <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                              {lead.bathrooms !== null && lead.bathrooms !== undefined ? lead.bathrooms : "-"}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Baths</div>
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
                            <FaCar style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
                            <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                              {lead.garages !== null && lead.garages !== undefined ? lead.garages : "-"}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Cars</div>
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
                            <FaRulerCombined style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
                          </div>
                          <div style={{ fontWeight: "600", color: "#2D3748", fontSize: "0.85rem", lineHeight: "1.3" }}>
                            F: {lead.floor_area && lead.floor_area !== "-" ? lead.floor_area : "-"} m²
                          </div>
                          <div style={{ fontSize: "0.65rem", color: "#718096", fontWeight: "500", lineHeight: "1.3" }}>
                            L: {lead.land_area && lead.land_area !== "-" && lead.land_area !== 0 ? lead.land_area : "-"} m²
                          </div>
                        </div>
                      </div>

                      {/* Owner + Summary section */}
                      <div style={{
                        marginTop: "auto",
                        paddingTop: "12px",
                        borderTop: "1px solid #e2e8f0",
                      }}>
                        {lead.owner_name && (
                          <div style={{ fontSize: "0.85rem", color: "#4a5568", fontWeight: "600", marginBottom: "4px" }}>
                            👤 {lead.owner_name}
                          </div>
                        )}
                        {(lead.owner_email || lead.owner_phone) && (
                          <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: "6px" }}>
                            {lead.owner_email && <span>✉️ {lead.owner_email}  </span>}
                            {lead.owner_phone && <span>📞 {lead.owner_phone}</span>}
                          </div>
                        )}
                        {lead.summary && (
                          <div style={{
                            fontSize: "0.8rem",
                            color: "#64748b",
                            marginBottom: "8px",
                            lineHeight: "1.4",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}>
                            {lead.summary}
                          </div>
                        )}
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.7rem",
                          color: "#94a3b8",
                        }}>
                          <span>Created {new Date(lead.created_at).toLocaleDateString()}</span>
                          {lead.next_action_at && (
                            <span style={{ color: "#ea580c", fontWeight: "600" }}>
                              Next: {new Date(lead.next_action_at).toLocaleDateString()}
                            </span>
                          )}
                          {!lead.next_action_at && lead.last_contacted_at && (
                            <span>Contacted {new Date(lead.last_contacted_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Address</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Owner</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No leads found</td></tr>
              ) : (
                leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(lead)}>
                    <td className="px-4 py-3 font-medium text-slate-900">{lead.property_address}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.owner_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[lead.priority] || 'bg-slate-100 text-slate-600'}`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{lead.source}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(lead.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm text-slate-600">
          <span>Showing {((page - 1) * pagination.limit) + 1}-{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}</span>
          <div className="flex items-center space-x-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 text-xs font-medium">Previous</button>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 text-xs font-medium">Next</button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setDetailOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mt-10 mb-10 overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">{selectedLead.property_address}</h3>
                {selectedLead.owner_name && <p className="text-xs text-slate-400 mt-0.5">{selectedLead.owner_name}</p>}
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => openEdit(selectedLead)} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 text-xs">Edit</button>
                <button onClick={() => setDetailOpen(false)} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Key Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Status</p>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[selectedLead.status] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABELS[selectedLead.status] || selectedLead.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Priority</p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[selectedLead.priority] || 'bg-slate-100 text-slate-600'}`}>
                    {selectedLead.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Source</p>
                  <p className="text-sm font-medium text-slate-700">{selectedLead.source}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Suburb</p>
                  <p className="text-sm font-medium text-slate-700">{selectedLead.suburb || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Email</p>
                  <p className="text-sm font-medium text-slate-700">{selectedLead.owner_email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Phone</p>
                  <p className="text-sm font-medium text-slate-700">{selectedLead.owner_phone || '-'}</p>
                </div>
              </div>

              {/* Summary */}
              {selectedLead.summary && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Summary</p>
                  <p className="text-sm text-slate-700">{selectedLead.summary}</p>
                </div>
              )}

              {/* Notes */}
              {selectedLead.notes && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedLead.notes}</p>
                </div>
              )}

              {/* Next Action */}
              {selectedLead.next_action && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-orange-700 mb-0.5">Next Action</p>
                  <p className="text-sm text-orange-800">{selectedLead.next_action}</p>
                  {selectedLead.next_action_at && (
                    <p className="text-xs text-orange-600 mt-1">Due: {new Date(selectedLead.next_action_at).toLocaleDateString()}</p>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Timeline</p>
                  <button onClick={() => setEventModalOpen(true)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700">+ Add Event</button>
                </div>
                {eventsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse flex space-x-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-slate-200 rounded w-1/3" />
                          <div className="h-3 bg-slate-200 rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : events.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No events recorded yet</p>
                ) : (
                  <div className="space-y-4">
                    {events.map(event => (
                      <div key={event.id} className="flex space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm shrink-0">
                          {EVENT_TYPE_ICONS[event.event_type] || '📌'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-900">{event.title}</p>
                            <span className="text-xs text-slate-400">{new Date(event.created_at).toLocaleDateString()}</span>
                          </div>
                          {event.description && (
                            <p className="text-xs text-slate-600 mt-0.5">{event.description}</p>
                          )}
                          {event.created_by && (
                            <p className="text-xs text-slate-400 mt-0.5">{event.created_by}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 bg-slate-900 text-white">
              <h3 className="text-base font-semibold">Edit Lead</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select value={editData.status || ''} onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
                <select value={editData.priority || 'medium'} onChange={e => setEditData(p => ({ ...p, priority: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Owner Email</label>
                <input type="email" value={editData.owner_email || ''} onChange={e => setEditData(p => ({ ...p, owner_email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Owner Phone</label>
                <input type="text" value={editData.owner_phone || ''} onChange={e => setEditData(p => ({ ...p, owner_phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Summary</label>
                <textarea value={editData.summary || ''} onChange={e => setEditData(p => ({ ...p, summary: e.target.value }))} rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Next Action</label>
                <input type="text" value={editData.next_action || ''} onChange={e => setEditData(p => ({ ...p, next_action: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Next Action Date</label>
                <input type="date" value={editData.next_action_at ? editData.next_action_at.split('T')[0] : ''}
                  onChange={e => setEditData(p => ({ ...p, next_action_at: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button onClick={() => setEditOpen(false)} className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                <button onClick={saveEdit} className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {eventModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEventModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 bg-slate-900 text-white">
              <h3 className="text-base font-semibold">Add Event</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                <select value={eventForm.event_type} onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="phone_call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="note">Note</option>
                  <option value="appointment">Appointment</option>
                  <option value="appraisal">Appraisal</option>
                  <option value="status_change">Status Change</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                <input type="text" value={eventForm.title} onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g., Called owner about..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description (optional)</label>
                <textarea value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button onClick={() => setEventModalOpen(false)} className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                <button onClick={addEvent} className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LeadEditModal
        isOpen={leadEditOpen}
        data={leadEditData}
        onClose={() => setLeadEditOpen(false)}
        onDataChange={handleLeadEditDataChange}
        onSave={saveLeadEdit}
        loading={leadEditLoading}
        leadAddress={selectedLead?.property_address || ''}
      />
      
      <PropertyEditModal
        isOpen={propertyEditOpen}
        data={propertyEditData}
        onClose={() => setPropertyEditOpen(false)}
        onDataChange={handlePropertyEditDataChange}
        onSave={savePropertyEdit}
        loading={propertyEditLoading}
        propertyAddress={selectedLead?.property_address || ''}
      />

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {notification.msg}
        </div>
      )}
    </div>
  );
}
