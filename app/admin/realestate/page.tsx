"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { FaBed, FaBath, FaMapMarkerAlt, FaRulerCombined, FaUser, FaExpand } from "react-icons/fa";
import Image from "next/image";
import { SkeletonProperties } from "@/components/admin/Skeleton";
import AddressAutocomplete from "@/components/property/AddressAutocomplete";
import { REGION_CITIES, CITY_SUBURBS, REGIONS as GEO_REGIONS } from "@/lib/geo-data";
import { getFixedImageUrl } from "@/lib/google-maps";

interface Listing {
  id: string;
  address: string;
  status: string | null;
  data: string | null;
  listing_date: string | null;
  listing_date_raw: string | null;
  price_display: string | null;
  agent_name: string | null;
  bedroom_count: number | null;
  bathroom_count: number | null;
  land_area: number | null;
  floor_area: number | null;
  property_url: string | null;
  original_link: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_image_url: string | null;
  images: string | null;
  normalized_lead_address: string | null;
  address_fingerprint: string | null;
  property_type: string | null;
  description: string | null;
  listing_number: string | null;
  listing_date_parsed: string | null;
}

interface Filters {
  search: string;
  region: string;
  city: string;
  suburb: string;
  min_bedrooms: string;
  max_bedrooms: string;
  min_bathrooms: string;
  max_bathrooms: string;
  property_type: string;
}

const ListingCard = ({ listing }: { listing: Listing }) => {
  const [imageError, setImageError] = useState(false);

  const imageSrc = getFixedImageUrl(listing.cover_image_url);
  const imageCount = (() => {
    if (!listing.images) return null;
    try {
      const parsed = JSON.parse(listing.images);
      return Array.isArray(parsed) ? parsed.length : null;
    } catch { return null; }
  })();

  const descriptionText = listing.description?.trim() || "";
  const displayDescription = descriptionText || "No description";

  const aiChamberText = [
    '[AI-DATA-START]',
    `Address: ${listing.address}`,
    listing.normalized_lead_address ? `Normalized Address: ${listing.normalized_lead_address}` : null,
    listing.address_fingerprint ? `Address Fingerprint: ${listing.address_fingerprint}` : null,
    listing.status ? `Status: ${listing.status}` : null,
    listing.price_display ? `Price: ${listing.price_display}` : null,
    listing.agent_name ? `Agent: ${listing.agent_name}` : null,
    listing.listing_date_raw ? `Listed: ${listing.listing_date_raw}` : null,
    listing.listing_date ? `Listing Date: ${listing.listing_date}` : null,
    listing.listing_date_parsed ? `Listing Date Parsed: ${listing.listing_date_parsed}` : null,
    listing.data ? `Data Timestamp: ${listing.data}` : null,
    listing.property_type ? `Property Type: ${listing.property_type}` : null,
    listing.bedroom_count != null ? `Bedrooms: ${listing.bedroom_count}` : null,
    listing.bathroom_count != null ? `Bathrooms: ${listing.bathroom_count}` : null,
    listing.land_area != null ? `Land Area: ${listing.land_area}m²` : null,
    listing.floor_area != null ? `Floor Area: ${listing.floor_area}m²` : null,
    listing.region ? `Region: ${listing.region}` : null,
    listing.listing_number ? `Listing Number: ${listing.listing_number}` : null,
    listing.description ? `Description: ${listing.description}` : null,
    listing.cover_image_url ? `Cover Image: ${listing.cover_image_url}` : null,
    imageCount != null ? `Image Count: ${imageCount}` : null,
    listing.property_url ? `Property URL: ${listing.property_url}` : null,
    listing.latitude != null && listing.longitude != null
      ? `Coordinates: ${listing.latitude}, ${listing.longitude}` : null,
    '[AI-DATA-END]',
  ].filter(Boolean).join('\n');

  return (
    <div
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
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-8px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)";
      }}
    >
      <div style={{ position: "relative" }}>
        <a
          href={listing.original_link || listing.property_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", height: "220px", textDecoration: "none", color: "inherit" }}
        >
          {imageSrc && !imageError ? (
            <Image
              src={imageSrc}
              alt={listing.address}
              unoptimized
              onError={() => setImageError(true)}
              width={400}
              height={220}
              style={{ objectFit: "cover", width: "100%", height: "220px" }}
            />
          ) : (
            <div style={{
              height: "220px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
            }}>
              <div style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                padding: "16px 24px",
                borderRadius: "12px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "4px" }}>
                  {listing.bedroom_count != null ? `${listing.bedroom_count}` : '-'}
                  <span style={{ fontSize: "1rem", fontWeight: "400", marginLeft: "4px" }}>bed</span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem" }}>
                  {listing.bathroom_count != null ? `${listing.bathroom_count} bath` : ''}
                  {listing.land_area != null ? ` | ${listing.land_area}m²` : ''}
                </div>
              </div>
            </div>
          )}
        </a>

        {listing.status && (
          <div style={{
            position: "absolute", top: "16px", left: "16px",
            backgroundColor: listing.status.toLowerCase().includes('sold')
              ? 'rgba(239, 68, 68, 0.9)'
              : listing.status.toLowerCase().includes('under') || listing.status.toLowerCase().includes('offer')
                ? 'rgba(245, 158, 11, 0.9)'
                : 'rgba(34, 197, 94, 0.9)',
            color: "white", padding: "6px 12px", borderRadius: "20px",
            fontSize: "0.85rem", fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>
            {listing.status}
          </div>
        )}

        {listing.region && (
          <div style={{
            position: "absolute", bottom: "16px", left: "16px",
            backgroundColor: "rgba(34, 197, 94, 0.9)", color: "white",
            padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem",
            fontWeight: "600", boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            textTransform: "capitalize",
          }}>
            {listing.region}
          </div>
        )}

        <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", gap: "6px", flexDirection: "column", alignItems: "flex-end" }}>
          {listing.listing_date_raw && (
            <div style={{
              backgroundColor: "rgba(59, 130, 246, 0.9)", color: "white",
              padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem",
              fontWeight: "600", boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}>
              {listing.listing_date_raw}
            </div>
          )}
          {listing.property_type && (
            <div style={{
              backgroundColor: "rgba(139, 92, 246, 0.9)", color: "white",
              padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem",
              fontWeight: "600", boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}>
              {listing.property_type}
            </div>
          )}
        </div>

        {imageCount != null && (
          <div style={{
            position: "absolute", bottom: "16px", right: "16px",
            backgroundColor: "rgba(0,0,0,0.6)", color: "white",
            padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem",
            fontWeight: "500",
          }}>
            {imageCount} photo{imageCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <h3 style={{
            margin: 0, fontSize: "1.3rem", fontWeight: "700", color: "#2D3748",
            lineHeight: "1.3", flex: 1,
          }}>
            {listing.address}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('open-edit-modal', { detail: listing }));
            }}
            style={{
              marginLeft: '12px', padding: '6px 14px',
              backgroundColor: '#f0fdf4', color: '#16a34a',
              border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer',
              fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
          >
            Edit
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", color: "#718096", fontSize: "0.95rem" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <FaMapMarkerAlt style={{ marginRight: "8px", fontSize: "1rem" }} />
            <span>{listing.region ? listing.region.charAt(0).toUpperCase() + listing.region.slice(1) : ''}</span>
          </div>
          {listing.listing_date_raw && (
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
              Listed: {listing.listing_date_raw}
            </span>
          )}
        </div>

        {listing.price_display && (
          <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#059669", marginBottom: "16px" }}>
            {listing.price_display}
          </div>
        )}

        <div style={{
          display: "flex", justifyContent: "space-around", textAlign: "center",
          marginBottom: "12px",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaBed style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {listing.bedroom_count != null ? listing.bedroom_count : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Beds</div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaBath style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {listing.bathroom_count != null ? listing.bathroom_count : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Baths</div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaRulerCombined style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {listing.floor_area != null ? listing.floor_area : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Floor</div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaExpand style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {listing.land_area != null ? listing.land_area : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Land</div>
          </div>
        </div>

        <div style={{
          width: "100%",
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: "1px solid #e2e8f0",
          color: "#4a5568",
          fontSize: "0.9rem",
          lineHeight: 1.5,
          cursor: descriptionText ? "help" : "default",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }} title={descriptionText || undefined}>
          {displayDescription}
        </div>

        {listing.agent_name && (
          <div style={{ fontSize: "0.83rem", color: "#94a3b8", marginTop: "auto" }}>
            <FaUser style={{ marginRight: "4px", display: "inline", fontSize: "0.75rem" }} /> {listing.agent_name}
          </div>
        )}

        <div style={{
          position: "absolute", top: "-9999px", left: "-9999px",
          opacity: 0, pointerEvents: "none", userSelect: "none", fontSize: "1px",
        }}>
          {aiChamberText}
        </div>
      </div>
    </div>
  );
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  region: "Auckland",
  city: "North Shore City",
  suburb: "",
  min_bedrooms: "",
  max_bedrooms: "",
  min_bathrooms: "",
  max_bathrooms: "",
  property_type: "House",
};

export default function RealestatePage() {
  const router = useRouter();
  const { status } = useSession();
  const lastPropertyElementRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [addressInput, setAddressInput] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === addressInput) return prev;
        return { ...prev, search: addressInput };
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [addressInput]);

  const {
    data,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<{ listings: Listing[]; total: number }, Error>({
    queryKey: ["admin-realestate", filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const pageNum = (pageParam as number) || 1;
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "18",
      });

      if (filters.search) params.append("search", filters.search);
      if (filters.region) params.append("region", filters.region);
      if (filters.city) params.append("city", filters.city);
      if (filters.suburb) params.append("suburb", filters.suburb);
      if (filters.min_bedrooms) params.append("min_bedrooms", filters.min_bedrooms);
      if (filters.max_bedrooms) params.append("max_bedrooms", filters.max_bedrooms);
      if (filters.min_bathrooms) params.append("min_bathrooms", filters.min_bathrooms);
      if (filters.max_bathrooms) params.append("max_bathrooms", filters.max_bathrooms);
      if (filters.property_type && filters.property_type !== 'All') params.append("property_type", filters.property_type);

      const response = await fetch(`/api/admin/realestate?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch listings");
      }

      return { listings: result.listings, total: result.pagination.total };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && lastPage.listings.length === 18) {
        return allPages.length + 1;
      }
      return undefined;
    },
    placeholderData: keepPreviousData,
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const listingsData = data as { pages: { listings: Listing[]; total: number }[] } | undefined;
  const listings: Listing[] = listingsData
    ? listingsData.pages.flatMap((page) => page.listings)
    : [];
  const totalListings = listingsData?.pages[0]?.total || 0;

  useEffect(() => {
    const currentElement = lastPropertyElementRef.current;
    if (!currentElement) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { threshold: 1.0 });

    observer.observe(currentElement);
    return () => { observer.disconnect(); };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, listingsData]);

  const currentCitySuburbs = CITY_SUBURBS[filters.city] || [];

  const handleRegionChange = (region: string) => {
    const cities = REGION_CITIES[region as keyof typeof REGION_CITIES] || [];
    const defaultCity = cities[0] || "";
    setFilters((prev) => ({
      ...prev,
      region,
      city: defaultCity,
      suburb: "",
    }));
  };

  const handleCityChange = (city: string) => {
    setFilters((prev) => ({
      ...prev,
      city,
      suburb: "",
    }));
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setAddressInput("");
    setFilters(DEFAULT_FILTERS);
  };

  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Listing;
      setEditingListing(detail);
      setEditFormData({
        address: detail.address || '',
        region: detail.region || '',
        status: detail.status || '',
        price_display: detail.price_display || '',
        agent_name: detail.agent_name || '',
        property_url: detail.property_url || '',
        cover_image_url: detail.cover_image_url || '',
        bedroom_count: detail.bedroom_count?.toString() || '',
        bathroom_count: detail.bathroom_count?.toString() || '',
        land_area: detail.land_area?.toString() || '',
        floor_area: detail.floor_area?.toString() || '',
        property_type: detail.property_type || '',
        description: detail.description || '',
        listing_number: detail.listing_number || '',
      });
    };
    window.addEventListener('open-edit-modal', handler);
    return () => window.removeEventListener('open-edit-modal', handler);
  }, []);

  const handleEditFieldChange = (key: string, value: string) => {
    setEditFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!editingListing) return;
    setSaving(true);

    const body: Record<string, string> = {};
    for (const key of ['price_display', 'agent_name', 'status', 'property_url', 'cover_image_url', 'address', 'region', 'bedroom_count', 'bathroom_count', 'land_area', 'floor_area', 'property_type', 'description', 'listing_number'] as const) {
      const val = editFormData[key];
      if (typeof val === 'string' && val !== '' && val !== (editingListing as unknown as Record<string, string>)[key]?.toString()) {
        body[key] = val;
      }
    }

    if (Object.keys(body).length === 0) {
      setSaving(false);
      setEditingListing(null);
      return;
    }

    try {
      const res = await fetch(`/api/admin/realestate/${editingListing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.success) {
        showNotification('success', 'Listing updated successfully');
      } else {
        showNotification('error', result.error || 'Update failed');
      }
    } catch {
      showNotification('error', 'Update failed');
    }

    setSaving(false);
    setEditingListing(null);
  };

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  if (status === "loading") {
    return (
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
        <SkeletonProperties />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div style={{
      maxWidth: "1400px", margin: "0 auto", padding: "24px",
      "--input-border": "#e2e8f0",
      "--input-bg": "#ffffff",
      "--foreground": "#171717",
      "--card-bg": "#ffffff",
      "--card-border": "#e2e8f0",
      "--text-heading": "#2D3748",
      "--text-muted": "#718096",
    } as React.CSSProperties}>
      {notification && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 100,
          padding: "16px 24px", borderRadius: "12px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          backgroundColor: notification.type === 'success' ? '#22c55e' : '#ef4444',
          color: "white", fontWeight: "600", fontSize: "0.95rem",
        }}>
          {notification.msg}
        </div>
      )}

      <div style={{
        marginBottom: "32px", padding: "24px", backgroundColor: "white",
        borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#2D3748", margin: 0 }}>
            Search Filters
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#718096", margin: 0 }}>
            Displaying {listings.length} of {totalListings} listings
          </p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
            Search by Address
          </label>
          <AddressAutocomplete
            value={addressInput}
            city={filters.city}
            useGoogleMaps={true}
            onChange={(val) => { setAddressInput(val); }}
            onSelect={(suggestion) => {
              const parts = suggestion.address.split(',').map((s: string) => s.trim());
              const shortAddress = parts.slice(0, 2).join(', ');
              setAddressInput(shortAddress);
              setFilters((prev) => ({
                ...prev,
                search: shortAddress,
                suburb: suggestion.suburb || prev.suburb,
              }));
            }}
            placeholder="Search by address..."
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
              Region
            </label>
            <select
              value={filters.region}
              onChange={(e) => handleRegionChange(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", border: "2px solid #e2e8f0",
                borderRadius: "10px", fontSize: "0.95rem", backgroundColor: "white", color: "#2D3748",
                cursor: "pointer",
              }}
            >
              {GEO_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
              City / District
            </label>
            <select
              value={filters.city}
              onChange={(e) => handleCityChange(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", border: "2px solid #e2e8f0",
                borderRadius: "10px", fontSize: "0.95rem", backgroundColor: "white", color: "#2D3748",
                cursor: "pointer",
              }}
            >
              {(REGION_CITIES[filters.region as keyof typeof REGION_CITIES] || []).map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
              Suburb
            </label>
            <select
              value={filters.suburb}
              onChange={(e) => handleFilterChange("suburb", e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", border: "2px solid #e2e8f0",
                borderRadius: "10px", fontSize: "0.95rem", backgroundColor: "white", color: "#2D3748",
                cursor: "pointer",
              }}
            >
              <option value="">All suburbs</option>
              {currentCitySuburbs.map((suburb) => (
                <option key={suburb} value={suburb}>{suburb}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
            Property Type
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(['All', 'House', 'Townhouse', 'Unit', 'Apartment', 'Retirement Living'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleFilterChange("property_type", type)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: filters.property_type === type ? '#3b82f6' : 'white',
                  color: filters.property_type === type ? 'white' : '#4a5568',
                  border: filters.property_type === type ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: filters.property_type === type ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: filters.property_type === type ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (filters.property_type !== type) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (filters.property_type !== type) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
              Min Bedrooms
            </label>
            <input
              type="number"
              value={filters.min_bedrooms}
              onChange={(e) => handleFilterChange("min_bedrooms", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "90px", padding: "8px 14px", border: "2px solid #e2e8f0",
                borderRadius: "10px", fontSize: "0.95rem", backgroundColor: "white", color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
              Min Bathrooms
            </label>
            <input
              type="number"
              value={filters.min_bathrooms}
              onChange={(e) => handleFilterChange("min_bathrooms", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "90px", padding: "8px 14px", border: "2px solid #e2e8f0",
                borderRadius: "10px", fontSize: "0.95rem", backgroundColor: "white", color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          {showMoreFilters && (
            <>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
                  Max Bedrooms
                </label>
                <input
                  type="number"
                  value={filters.max_bedrooms}
                  onChange={(e) => handleFilterChange("max_bedrooms", e.target.value)}
                  min="0"
                  placeholder="10"
                  style={{
                    width: "90px", padding: "8px 14px", border: "2px solid #e2e8f0",
                    borderRadius: "10px", fontSize: "0.95rem", backgroundColor: "white", color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
                  Max Bathrooms
                </label>
                <input
                  type="number"
                  value={filters.max_bathrooms}
                  onChange={(e) => handleFilterChange("max_bathrooms", e.target.value)}
                  min="0"
                  placeholder="10"
                  style={{
                    width: "90px", padding: "8px 14px", border: "2px solid #e2e8f0",
                    borderRadius: "10px", fontSize: "0.95rem", backgroundColor: "white", color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </>
          )}

          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              style={{
                padding: "8px 18px", backgroundColor: "white", color: "#3b82f6",
                border: "2px dashed #93c5fd", borderRadius: "10px", cursor: "pointer",
                fontSize: "0.9rem", fontWeight: "600", transition: "all 0.2s", whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#93c5fd'; }}
            >
              {showMoreFilters ? "− Hide" : "+ More Filter Criteria"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleClearFilters}
            style={{
              padding: "12px 24px", backgroundColor: "#e2e8f0", color: "#4a5568",
              borderRadius: "10px", border: "none", cursor: "pointer", fontWeight: "600",
              fontSize: "0.95rem", transition: "all 0.2s",
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      {isError && (
        <div style={{
          padding: "16px", marginBottom: "24px", backgroundColor: "#fee2e2",
          border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b",
        }}>
          Error: {(error as Error)?.message || "Failed to load listings"}
        </div>
      )}

      {isLoading ? (
        <SkeletonProperties />
      ) : (
        <>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "24px",
          }}>
            {listings.map((listing, index) => (
              <div
                key={listing.id}
                ref={index === listings.length - 1 ? lastPropertyElementRef : undefined}
              >
                <ListingCard listing={listing} />
              </div>
            ))}
          </div>

          {isFetchingNextPage && (
            <div style={{ textAlign: "center", padding: "24px", color: "#718096" }}>
              Loading more listings...
            </div>
          )}

          {listings.length === 0 && !isLoading && (
            <div style={{
              textAlign: "center", padding: "48px 24px", color: "#718096",
              backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0",
            }}>
              No listings found matching your criteria.
            </div>
          )}
        </>
      )}

      {editingListing && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          }} onClick={() => setEditingListing(null)} />
          <div style={{
            position: "relative", backgroundColor: "white", borderRadius: "16px", padding: "32px",
            maxWidth: "700px", width: "95%", maxHeight: "90vh",
            overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#2D3748", marginBottom: "24px" }}>
              Edit Listing
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {[
                { key: 'address', label: 'Address', type: 'text' },
                { key: 'region', label: 'Region', type: 'text' },
                { key: 'status', label: 'Status', type: 'select', options: ['', 'for Sale', 'under Offer', 'sold', 'withdrawn'] },
                { key: 'price_display', label: 'Price Display', type: 'text' },
                { key: 'agent_name', label: 'Agent Name', type: 'text' },
                { key: 'property_url', label: 'Property URL', type: 'text' },
                { key: 'cover_image_url', label: 'Cover Image URL', type: 'text' },
                { key: 'bedroom_count', label: 'Bedrooms', type: 'number' },
                { key: 'bathroom_count', label: 'Bathrooms', type: 'number' },
                { key: 'land_area', label: 'Land Area (m²)', type: 'number' },
                { key: 'floor_area', label: 'Floor Area (m²)', type: 'number' },
                { key: 'property_type', label: 'Property Type', type: 'select', options: ['', 'House', 'Townhouse', 'Unit', 'Apartment', 'Retirement Living'] },
                { key: 'listing_number', label: 'Listing Number', type: 'text' },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#4a5568', marginBottom: '4px' }}>
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={(editFormData[field.key] as string) || ''}
                      onChange={(e) => handleEditFieldChange(field.key, e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px',
                        border: '2px solid #e2e8f0', borderRadius: '8px',
                        fontSize: '0.9rem', color: '#2D3748', backgroundColor: 'white',
                      }}
                    >
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt || 'Select status'}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={(editFormData[field.key] as string) || ''}
                      onChange={(e) => handleEditFieldChange(field.key, e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px',
                        border: '2px solid #e2e8f0', borderRadius: '8px',
                        fontSize: '0.9rem', color: '#2D3748',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: "16px" }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#4a5568', marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                value={(editFormData.description as string) || ''}
                onChange={(e) => handleEditFieldChange('description', e.target.value)}
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '2px solid #e2e8f0', borderRadius: '8px',
                  fontSize: '0.9rem', color: '#2D3748', resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingListing(null)}
                style={{
                  padding: '12px 24px', backgroundColor: '#f3f4f6', color: '#4a5568',
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontWeight: '600', fontSize: '0.95rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
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
    </div>
  );
}
