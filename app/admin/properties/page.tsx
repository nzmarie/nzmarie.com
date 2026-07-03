"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import {
  FaBed,
  FaBath,
  FaCar,
  FaRulerCombined,
  FaMapMarkerAlt,
} from "react-icons/fa";
import Image from "next/image";
import AddressAutocomplete from "@/components/property/AddressAutocomplete";
import { SkeletonProperties } from "@/components/admin/Skeleton";
import { REGION_CITIES, CITY_SUBURBS } from "@/lib/geo-data";

interface Property {
  id: string;
  address: string;
  suburb: string;
  city: string;
  region?: string;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  rv: number | null;
  last_sold_price: number | null;
  last_sold_date: string | null;
  build_year: number | null;
  land_area: number | string | null;
  floor_area: string | null;
  image_url: string;
  property_url: string;
}

interface Filters {
  region: string;
  city: string;
  suburb: string;
  last_sold_years: string;
  min_bedrooms: string;
  max_bedrooms: string;
  min_bathrooms: string;
  max_bathrooms: string;
  min_car_spaces: string;
  max_car_spaces: string;
  search: string;
}

const PropertyCard = ({ property, selectMode, isSelected, onToggle }: { 
  property: Property; 
  selectMode: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) => {
  const [imageError, setImageError] = useState(false);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "N/A";
    if (amount === 0) return "$0";
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
        backgroundColor: selectMode && isSelected ? '#eff6ff' : 'white',
        transition: "all 0.3s ease",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        outline: selectMode && isSelected ? '3px solid #3b82f6' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!selectMode) {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-8px)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selectMode) {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)";
        }
      }}
    >
      {selectMode && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
        }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            style={{
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              accentColor: '#3b82f6',
            }}
          />
        </div>
      )}
      <div style={{ position: "relative" }}>
        <a
          href={property.property_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", height: "220px", textDecoration: "none", color: "inherit" }}
        >
          {property.image_url && !imageError ? (
            <Image
              src={property.image_url}
              alt={property.address}
              unoptimized
              onError={() => setImageError(true)}
              width={400}
              height={220}
              style={{ objectFit: "cover" }}
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

        {property.region && (
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
            {property.region}
          </div>
        )}
      </div>

      <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
        <h3 style={{
          margin: 0,
          fontSize: "1.3rem",
          fontWeight: "700",
          color: "#2D3748",
          marginBottom: "8px",
          lineHeight: "1.3",
        }}>
          {property.address}
        </h3>

        <div style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "18px",
          color: "#718096",
          fontSize: "0.95rem",
        }}>
          <FaMapMarkerAlt style={{ marginRight: "8px", fontSize: "1rem" }} />
          <span>{property.suburb}, {property.city}</span>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
          paddingBottom: "20px",
          borderBottom: "1px solid #e2e8f0",
        }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: "4px" }}>
              RV (Rating Value)
            </div>
            <div style={{ fontWeight: "700", color: "#2D3748", fontSize: "1.2rem" }}>
              {formatCurrency(property.rv)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: "4px" }}>
              Last Sold
            </div>
            <div style={{ fontWeight: "600", color: "#4a5568", fontSize: "1rem" }}>
              {formatCurrency(property.last_sold_price)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#718096" }}>
              {formatDate(property.last_sold_date)}
            </div>
          </div>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-around",
          textAlign: "center",
          marginTop: "auto",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaBed style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {property.bedrooms !== null ? property.bedrooms : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Beds</div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaBath style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {property.bathrooms !== null ? property.bathrooms : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Baths</div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaCar style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {property.garages !== null ? property.garages : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Cars</div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaRulerCombined style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {property.land_area && property.land_area !== "0" && property.land_area !== 0 ? property.land_area : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>m²</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PropertiesPage() {
  const { status } = useSession();
  const router = useRouter();
  const lastPropertyElementRef = useRef<HTMLDivElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set());
  const [selectedPropertiesInfo, setSelectedPropertiesInfo] = useState<Property[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [filters, setFilters] = useState<Filters>({
    region: "Auckland",
    city: "North Shore City",
    suburb: "",
    last_sold_years: "",
    min_bedrooms: "",
    max_bedrooms: "",
    min_bathrooms: "",
    max_bathrooms: "",
    min_car_spaces: "",
    max_car_spaces: "",
    search: "",
  });
  const [addressInput, setAddressInput] = useState("");

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
    isFetching,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<Property[], Error>({
    queryKey: ["admin-properties", filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const pageNum = (pageParam as number) || 1;
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "9",
      });

      if (filters.suburb) {
        params.append("suburb", filters.suburb);
      }
      if (filters.city) params.append("city", filters.city);
      if (filters.region) params.append("region", filters.region);
      if (filters.search) params.append("search", filters.search);
      if (filters.last_sold_years) params.append("last_sold_years", filters.last_sold_years);
      if (filters.min_bedrooms) params.append("min_bedrooms", filters.min_bedrooms);
      if (filters.max_bedrooms) params.append("max_bedrooms", filters.max_bedrooms);
      if (filters.min_bathrooms) params.append("min_bathrooms", filters.min_bathrooms);
      if (filters.max_bathrooms) params.append("max_bathrooms", filters.max_bathrooms);
      if (filters.min_car_spaces) params.append("min_car_spaces", filters.min_car_spaces);
      if (filters.max_car_spaces) params.append("max_car_spaces", filters.max_car_spaces);

      const response = await fetch(`/api/admin/properties?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch properties");
      }

      return result.properties;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && lastPage.length === 9) {
        return allPages.length + 1;
      }
      return undefined;
    },
    placeholderData: keepPreviousData,
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const propertiesData = data as { pages: Property[][] } | undefined;
  const properties: Property[] = propertiesData
    ? propertiesData.pages.flatMap((page) => page)
    : [];

  useEffect(() => {
    const currentElement = lastPropertyElementRef.current;
    if (!currentElement) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        console.log("Fetching next page...");
        fetchNextPage();
      }
    }, { threshold: 1.0 });

    observer.observe(currentElement);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, propertiesData]);

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

  const handleFilterChange = (key: keyof Filters, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setAddressInput("");
    setFilters({
      region: "Auckland",
      city: "North Shore City",
      suburb: "",
      last_sold_years: "",
      min_bedrooms: "",
      max_bedrooms: "",
      min_bathrooms: "",
      max_bathrooms: "",
      min_car_spaces: "",
      max_car_spaces: "",
      search: "",
    });
  };

  const toggleSelection = (property: Property) => {
    setSelectedProperties(prev => {
      const next = new Set(prev);
      if (next.has(property.id)) {
        next.delete(property.id);
        setSelectedPropertiesInfo(curr => curr.filter(p => p.id !== property.id));
      } else {
        next.add(property.id);
        setSelectedPropertiesInfo(curr => [...curr, property]);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedProperties(new Set(properties.map(p => p.id)));
    setSelectedPropertiesInfo([...properties]);
  };

  const clearSelection = () => {
    setSelectedProperties(new Set());
    setSelectedPropertiesInfo([]);
    setSelectMode(false);
  };

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const addToOutreach = async () => {
    if (selectedProperties.size === 0) return;
    
    const selectedData = selectedPropertiesInfo.map(p => ({
      louis_property_id: p.id,
      property_address: p.address,
      suburb: p.suburb,
      street: '',
      city: p.city,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      rv_value: p.rv,
    }));

    try {
      const response = await fetch('/api/admin/outreach/batch-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: selectedData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add properties');
      }

      const result = await response.json();
      showNotification('success', result.message || `Added ${selectedProperties.size} properties to outreach queue`);
      clearSelection();
      setShowAddModal(false);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to add properties');
    }
  };

  const groupedBySuburb = selectedPropertiesInfo.reduce((acc, p) => {
    acc[p.suburb] = (acc[p.suburb] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);


  // Show skeleton while session resolves or initial data loads — Navbar stays visible
  if (status === "loading" || (isLoading && properties.length === 0)) {
    return <SkeletonProperties />;
  }

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
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 100,
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          backgroundColor: notification.type === 'success' ? '#22c55e' : '#ef4444',
          color: 'white',
          fontWeight: '600',
          fontSize: '0.95rem',
        }}>
          {notification.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{
            fontSize: "2.5rem",
            fontWeight: "700",
            color: "#2D3748",
            background: "linear-gradient(135deg, #007bff, #00bcd4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "8px",
          }}>
            Properties from Louis DB
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#718096" }}>
            {properties.length} properties loaded • Scroll to load more
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setSelectMode(!selectMode)}
            style={{
              padding: '10px 20px',
              backgroundColor: selectMode ? '#3b82f6' : '#e2e8f0',
              color: selectMode ? 'white' : '#4a5568',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.95rem',
            }}
          >
            {selectMode ? '✓ Select Mode' : '📋 Select Mode'}
          </button>
          {selectMode && (
            <>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#4a5568' }}>
                Selected: {selectedProperties.size} properties
              </span>
              <button
                onClick={selectAll}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#4a5568',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                }}
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#4a5568',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                }}
              >
                Clear All
              </button>
              {selectedProperties.size > 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                  }}
                >
                  Add to Outreach
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filters Section */}
      <div style={{
        marginBottom: "32px",
        padding: "24px",
        backgroundColor: "white",
        borderRadius: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        border: "1px solid #e2e8f0",
      }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#2D3748", marginBottom: "20px" }}>
          Search Filters
        </h2>
        
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
            Search by Address
          </label>
          <AddressAutocomplete
            value={addressInput}
            city={filters.city}
            useGoogleMaps={true}
            onChange={(val) => {
              setAddressInput(val);
            }}
            onSelect={(suggestion) => {
              setAddressInput(suggestion.address);
              setFilters((prev) => ({
                ...prev,
                search: suggestion.address,
                suburb: suggestion.suburb || prev.suburb,
              }));
            }}
            placeholder={`Search by address in ${filters.city}...`}
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
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
                cursor: "pointer",
              }}
            >
              <option value="Auckland">Auckland</option>
              <option value="Wellington">Wellington</option>
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
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
                cursor: "pointer",
              }}
            >
              {(REGION_CITIES[filters.region as keyof typeof REGION_CITIES] || []).map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
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
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
                cursor: "pointer",
              }}
            >
              <option value="">All suburbs</option>
              {currentCitySuburbs.map((suburb) => (
                <option key={suburb} value={suburb}>
                  {suburb}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
              Last Sold Within
            </label>
            <select
              value={filters.last_sold_years}
              onChange={(e) => handleFilterChange("last_sold_years", e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
                cursor: "pointer",
              }}
            >
              <option value="">Any Time</option>
              <option value="1">1 year</option>
              <option value="3">3 years</option>
              <option value="5">5 years</option>
              <option value="10">10 years</option>
            </select>
          </div>

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
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
              }}
            />
          </div>

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
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
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
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
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
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
              Min Car Spaces
            </label>
            <input
              type="number"
              value={filters.min_car_spaces}
              onChange={(e) => handleFilterChange("min_car_spaces", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
              Max Car Spaces
            </label>
            <input
              type="number"
              value={filters.max_car_spaces}
              onChange={(e) => handleFilterChange("max_car_spaces", e.target.value)}
              min="0"
              placeholder="10"
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleClearFilters}
            style={{
              padding: "12px 24px",
              backgroundColor: "#e2e8f0",
              color: "#4a5568",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.95rem",
              transition: "all 0.2s",
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      {isError && (
        <div style={{
          padding: "16px",
          marginBottom: "24px",
          backgroundColor: "#fee2e2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          color: "#991b1b",
          textAlign: "center"
        }}>
          Error loading properties: {error?.message || "Unknown error occurred"}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "30px",
        marginBottom: "32px",
        opacity: isFetching && !isFetchingNextPage ? 0.6 : 1,
        transition: "opacity 0.2s ease-in-out",
      }}>
        {properties.map((property, index) => {
          const isLast = index === properties.length - 1;
          return (
            <div key={`${property.id}-${index}`} ref={isLast ? lastPropertyElementRef : null}>
              <PropertyCard 
                property={property} 
                selectMode={selectMode}
                isSelected={selectedProperties.has(property.id)}
                onToggle={() => toggleSelection(property)}
              />
            </div>
          );
        })}
      </div>

      {/* Loading More Indicator */}
      {isFetchingNextPage && (
        <div style={{
          textAlign: "center",
          padding: "30px",
          display: "flex",
          justifyContent: "center",
        }}>
          <div style={{
            width: "48px",
            height: "48px",
            border: "4px solid #f3f4f6",
            borderTop: "4px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}></div>
        </div>
      )}

      {/* No More Data Indicator */}
      {!hasNextPage && properties.length > 0 && !isFetchingNextPage && (
        <div style={{
          textAlign: "center",
          padding: "30px",
          color: "#718096",
          fontSize: "0.95rem",
          fontWeight: "500",
        }}>
          No more properties to load
        </div>
      )}

      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
            onClick={() => setShowAddModal(false)}
          />
          <div style={{
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#2D3748',
              marginBottom: '16px',
            }}>
              Add Properties to Outreach
            </h2>
            <p style={{
              fontSize: '1rem',
              color: '#4a5568',
              marginBottom: '24px',
            }}>
              You are about to add {selectedProperties.size} {selectedProperties.size === 1 ? 'property' : 'properties'} to your outreach list.
            </p>
            {Object.keys(groupedBySuburb).length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <p style={{
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#4a5568',
                  marginBottom: '12px',
                }}>
                  Selected suburbs:
                </p>
                <div style={{ paddingLeft: '12px' }}>
                  {Object.entries(groupedBySuburb).map(([suburb, count]) => (
                    <div key={suburb} style={{
                      fontSize: '0.9rem',
                      color: '#718096',
                      marginBottom: '6px',
                    }}>
                      • {suburb} ({count} {count === 1 ? 'property' : 'properties'})
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#f3f4f6',
                  color: '#4a5568',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={addToOutreach}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}
              >
                Confirm & Add
              </button>
            </div>
          </div>
        </div>
      )}

      {!hasNextPage && properties.length > 0 && (
        <div style={{
          textAlign: "center",
          padding: "30px",
          color: "#718096",
          fontSize: "0.95rem",
        }}>
          🎉 You{"'"}ve reached the end! No more properties to load.
        </div>
      )}

      {/* Empty State */}
      {properties.length === 0 && !isLoading && (
        <div style={{
          textAlign: "center",
          padding: "80px 30px",
          color: "#718096",
          backgroundColor: "white",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
        }}>
          <h3 style={{ fontSize: "1.8rem", marginBottom: "16px", color: "#2D3748" }}>
            No properties found
          </h3>
          <p style={{ fontSize: "1.1rem" }}>Try adjusting your search criteria</p>
        </div>
      )}

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
