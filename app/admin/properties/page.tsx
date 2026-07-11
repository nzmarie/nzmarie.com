"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
import { getFixedImageUrl } from "@/lib/google-maps";

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
  realestate_url?: string | null;
  description?: string | null;
  postcode?: string | null;
  land_value?: number | null;
  improvement_value?: number | null;
  has_rental_history?: boolean | null;
  is_currently_rented?: boolean | null;
  status?: string | null;
  property_history?: string | null;
  normalized_address?: string | null;
  address_fingerprint?: string | null;
  land_area_numeric?: string | null;
  property_type?: string | null;
  sale_status?: string | null;
  sale_status_source?: string | null;
  sale_status_updated_at?: string | null;
  estimated_value_low?: number | null;
  estimated_value_high?: number | null;
  suburb_median_price?: number | null;
  suburb_median_rent?: number | null;
  suburb_days_on_market?: number | null;
  images?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
}

interface Filters {
  region: string;
  city: string;
  suburb: string;
  last_sold_min_years: string;
  last_sold_max_years: string;
  min_bedrooms: string;
  max_bedrooms: string;
  min_bathrooms: string;
  max_bathrooms: string;
  min_car_spaces: string;
  max_car_spaces: string;
  search: string;
}

const PropertyCard = ({ property, isLiked, onToggleLike }: { 
  property: Property;
  isLiked: boolean;
  onToggleLike: (property: Property) => void;
}) => {
  const [imageError, setImageError] = useState(false);

  const fixedImageUrl = getFixedImageUrl(property.image_url);

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

  const descriptionText = property.description?.trim() || "";
  const displayDescription = descriptionText || "No description";

  const aiChamberText = [
    '[AI-DATA-START]',
    `Address: ${property.address}`,
    `Suburb: ${property.suburb}`,
    property.city ? `City: ${property.city}` : null,
    property.region ? `Region: ${property.region}` : null,
    property.postcode ? `Postcode: ${property.postcode}` : null,
    property.build_year ? `Year Built: ${property.build_year}` : null,
    property.bedrooms != null ? `Bedrooms: ${property.bedrooms}` : null,
    property.bathrooms != null ? `Bathrooms: ${property.bathrooms}` : null,
    property.garages != null ? `Car Spaces: ${property.garages}` : null,
    property.floor_area ? `Floor Size: ${property.floor_area}` : null,
    property.land_area ? `Land Area: ${property.land_area}` : null,
    property.rv != null ? `Capital Value (RV): ${formatCurrency(property.rv)}` : null,
    property.land_value != null ? `Land Value: ${formatCurrency(property.land_value)}` : null,
    property.improvement_value != null ? `Improvement Value: ${formatCurrency(property.improvement_value)}` : null,
    property.estimated_value_low != null && property.estimated_value_high != null
      ? `Estimated Value: ${formatCurrency(property.estimated_value_low)} - ${formatCurrency(property.estimated_value_high)}` : null,
    property.last_sold_price != null ? `Last Sold Price: ${formatCurrency(property.last_sold_price)}` : null,
    property.last_sold_date ? `Last Sold Date: ${property.last_sold_date}` : null,
    property.property_type ? `Property Type: ${property.property_type}` : null,
    property.sale_status ? `Sale Status: ${property.sale_status}` : null,
    property.has_rental_history != null ? `Has Rental History: ${property.has_rental_history ? 'Yes' : 'No'}` : null,
    property.is_currently_rented != null ? `Currently Rented: ${property.is_currently_rented ? 'Yes' : 'No'}` : null,
    property.latitude != null && property.longitude != null
      ? `Coordinates: ${property.latitude}, ${property.longitude}` : null,
    property.property_url ? `Property URL: ${property.property_url}` : null,
    property.description ? `Description: ${property.description}` : null,
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
          href={property.property_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", height: "220px", textDecoration: "none", color: "inherit" }}
        >
          {fixedImageUrl && !imageError ? (
            <Image
              src={fixedImageUrl}
              alt={property.address}
              unoptimized
              onError={() => setImageError(true)}
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

        {property.suburb && (
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
            {property.suburb}
          </div>
        )}
        
        {/* Like Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleLike(property);
          }}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: isLiked ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255,255,255,0.85)',
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
            transition: 'all 0.2s ease',
            color: isLiked ? 'white' : '#64748b',
            zIndex: 2,
          }}
          title={isLiked ? 'Unlike' : 'Like'}
        >
          {isLiked ? '\u2764' : '\u2661'}
        </button>

        {/* Built Year Badge */}
        {property.build_year && (
          <div style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            backgroundColor: "rgba(59, 130, 246, 0.9)",
            color: "white",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>
            Built {property.build_year}
          </div>
        )}
        
        {/* Years Since Last Sold Badge */}
        {property.last_sold_date && (() => {
          const soldDate = new Date(property.last_sold_date);
          if (!Number.isNaN(soldDate.getTime())) {
            const today = new Date();
            const years = today.getFullYear() - soldDate.getFullYear();
            if (years > 0) {
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
            }
          }
          return null;
        })()}
      </div>

      <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <h3 style={{
            margin: 0,
            fontSize: "1.3rem",
            fontWeight: "700",
            color: "#2D3748",
            lineHeight: "1.3",
            flex: 1,
          }}>
            {property.address}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('open-edit-modal', { detail: property }));
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

        <div style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "12px",
          color: "#718096",
          fontSize: "0.95rem",
        }}>
          <FaMapMarkerAlt style={{ marginRight: "8px", fontSize: "1rem" }} />
          <span>{property.suburb}, {property.city}</span>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
          {property.realestate_url && (
            <a
              href={property.realestate_url}
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
                transition: "all 0.2s",
              }}
            >
              🏠 RealEstate
            </a>
          )}
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
              Last Sold
            </div>
            <div style={{ fontWeight: "700", color: "#2D3748", fontSize: "1.1rem", marginBottom: "4px" }}>
              {formatDate(property.last_sold_date)}
            </div>
            <div style={{ fontWeight: "600", color: "#4a5568", fontSize: "1rem" }}>
              {formatCurrency(property.last_sold_price)}
            </div>
            
            {/* Price Growth Indicator */}
            {property.last_sold_price && property.rv && property.last_sold_price > 0 && property.rv > 0 && (() => {
              const growth = ((property.rv - property.last_sold_price) / property.last_sold_price) * 100;
              const isPositive = growth > 0;
              return (
                <div style={{
                  marginTop: "6px",
                  fontSize: "0.75rem",
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
            <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: "4px" }}>
              RV (Rating Value)
            </div>
            <div style={{ fontWeight: "700", color: "#2D3748", fontSize: "1.2rem" }}>
              {formatCurrency(property.rv)}
            </div>
            
            {/* Build Year under RV */}
            {property.build_year && (
              <div style={{
                marginTop: "8px",
                fontSize: "0.75rem",
                color: "#718096",
                fontWeight: "500",
              }}>
                Built in {property.build_year}
              </div>
            )}
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
                {(() => {
                  // 优先显示 floor_area（室内面积），如果没有则显示 land_area（土地面积）
                  const area = property.floor_area || property.land_area;
                  if (area && area !== "0" && area !== 0 && area !== "-") {
                    return area;
                  }
                  return "-";
                })()}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>m²</div>
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

        <div style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          pointerEvents: 'none',
          userSelect: 'none',
          fontSize: '1px',
          opacity: 0,
        }}>
          {aiChamberText}
        </div>
      </div>
    </div>
  );
};

export default function PropertiesPage() {
  const { status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastPropertyElementRef = useRef<HTMLDivElement>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [filters, setFilters] = useState<Filters>({
    region: "Auckland",
    city: "North Shore City",
    suburb: "",
    last_sold_min_years: "5",
    last_sold_max_years: "10",
    min_bedrooms: "",
    max_bedrooms: "",
    min_bathrooms: "",
    max_bathrooms: "",
    min_car_spaces: "",
    max_car_spaces: "",
    search: "",
  });
  const [addressInput, setAddressInput] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<'house' | 'all' | 'townhouse'>('house');
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [lastSoldPreset, setLastSoldPreset] = useState('5-10');

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
  } = useInfiniteQuery<{ properties: Property[]; total: number }, Error>({
    queryKey: ["admin-properties", filters, propertyFilter, lastSoldPreset, showLikedOnly],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const pageNum = (pageParam as number) || 1;

      if (showLikedOnly) {
        const params = new URLSearchParams({
          status: 'liked',
          page: pageNum.toString(),
          limit: '18',
        });
        if (filters.suburb) params.append('suburb', filters.suburb);
        if (filters.city) params.append('city', filters.city);
        if (filters.region) params.append('region', filters.region);
        if (filters.search) params.append('search', filters.search);

        const response = await fetch(`/api/admin/outreach?${params}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to fetch liked properties');

        let mapped: Property[] = result.data.map((item: any) => ({
          id: item.joined_property_id || (item.property_id ? item.property_id.replace(/-/g, '') : item.id),
          address: item.property_address || '',
          suburb: item.suburb || '',
          city: item.city || '',
          region: item.region || '',
          bedrooms: item.bedrooms ?? null,
          bathrooms: item.bathrooms ?? null,
          garages: item.car_spaces ?? null,
          rv: item.capital_value ?? null,
          last_sold_price: item.last_sold_price ?? null,
          last_sold_date: item.last_sold_date ?? null,
          build_year: item.build_year ?? null,
          land_area: item.land_area ?? null,
          floor_area: item.floor_area ?? null,
          image_url: item.image_url || '',
          property_url: item.property_url || '',
          realestate_url: item.realestate_url || null,
          description: item.description || null,
          property_type: item.property_type || null,
        }));

        if (propertyFilter === 'house') {
          mapped = mapped.filter(p => {
            if (!p.property_type) return true;
            const t = p.property_type.toLowerCase();
            return !['townhouse', 'unit', 'apartment'].includes(t);
          });
        } else if (propertyFilter === 'townhouse') {
          mapped = mapped.filter(p => {
            if (!p.property_type) return false;
            const t = p.property_type.toLowerCase();
            return ['townhouse', 'unit'].includes(t);
          });
        }

        if (lastSoldPreset === 'none') {
          mapped = mapped.filter(p => !p.last_sold_date);
        } else {
          const minYears = filters.last_sold_min_years ? parseInt(filters.last_sold_min_years) : 0;
          const maxYears = filters.last_sold_max_years ? parseInt(filters.last_sold_max_years) : 999;
          if (minYears > 0 || maxYears < 999) {
            const now = new Date();
            mapped = mapped.filter(p => {
              if (!p.last_sold_date) return false;
              const sold = new Date(p.last_sold_date);
              if (isNaN(sold.getTime())) return false;
              const years = (now.getTime() - sold.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
              return years >= minYears && years <= maxYears;
            });
          }
        }

        if (filters.min_bedrooms) {
          const min = parseInt(filters.min_bedrooms);
          mapped = mapped.filter(p => p.bedrooms !== null && p.bedrooms >= min);
        }
        if (filters.max_bedrooms) {
          const max = parseInt(filters.max_bedrooms);
          mapped = mapped.filter(p => p.bedrooms !== null && p.bedrooms <= max);
        }
        if (filters.min_bathrooms) {
          const min = parseInt(filters.min_bathrooms);
          mapped = mapped.filter(p => p.bathrooms !== null && p.bathrooms >= min);
        }
        if (filters.max_bathrooms) {
          const max = parseInt(filters.max_bathrooms);
          mapped = mapped.filter(p => p.bathrooms !== null && p.bathrooms <= max);
        }
        if (filters.min_car_spaces) {
          const min = parseInt(filters.min_car_spaces);
          mapped = mapped.filter(p => p.garages !== null && p.garages >= min);
        }
        if (filters.max_car_spaces) {
          const max = parseInt(filters.max_car_spaces);
          mapped = mapped.filter(p => p.garages !== null && p.garages <= max);
        }

        return { properties: mapped, total: result.pagination.total };
      }

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "18",
      });

      if (filters.suburb) {
        params.append("suburb", filters.suburb);
      }
      if (filters.city) params.append("city", filters.city);
      if (filters.region) params.append("region", filters.region);
      if (filters.search) params.append("search", filters.search);
      if (lastSoldPreset === 'none') {
        params.append("last_sold_none", "true");
      } else {
        if (filters.last_sold_min_years) params.append("last_sold_min_years", filters.last_sold_min_years);
        if (filters.last_sold_max_years) params.append("last_sold_max_years", filters.last_sold_max_years);
      }
      if (filters.min_bedrooms) params.append("min_bedrooms", filters.min_bedrooms);
      if (filters.max_bedrooms) params.append("max_bedrooms", filters.max_bedrooms);
      if (filters.min_bathrooms) params.append("min_bathrooms", filters.min_bathrooms);
      if (filters.max_bathrooms) params.append("max_bathrooms", filters.max_bathrooms);
      if (filters.min_car_spaces) params.append("min_car_spaces", filters.min_car_spaces);
      if (filters.max_car_spaces) params.append("max_car_spaces", filters.max_car_spaces);
      if (propertyFilter === 'house') params.append("standalone_only", "true");
      if (propertyFilter === 'townhouse') params.append("townhouse_only", "true");

      const response = await fetch(`/api/admin/properties?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch properties");
      }

      return { properties: result.properties, total: result.pagination.total };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && lastPage.properties.length === 18) {
        return allPages.length + 1;
      }
      return undefined;
    },
    placeholderData: keepPreviousData,
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const propertiesData = data as { pages: { properties: Property[]; total: number }[] } | undefined;
  const properties: Property[] = propertiesData
    ? propertiesData.pages.flatMap((page) => page.properties)
    : [];
  const totalProperties = propertiesData?.pages[0]?.total || 0;

  const [likedPropertyIds, setLikedPropertyIds] = useState<Set<string>>(new Set());

  const displayProperties = properties;

  const propertyIds = !showLikedOnly ? properties.map(p => p.id).filter(Boolean).join(',') : '';

  useEffect(() => {
    if (!propertyIds) return;
    fetch(`/api/admin/outreach/like?property_ids=${propertyIds}`)
      .then(res => res.json())
      .then(data => {
        if (data.liked_ids) {
          setLikedPropertyIds(new Set(data.liked_ids));
        }
      })
      .catch(() => {});
  }, [propertyIds]);

  const handleToggleLike = async (property: Property) => {
    const wasLiked = likedPropertyIds.has(property.id);
    setLikedPropertyIds(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(property.id);
      else next.add(property.id);
      return next;
    });
    try {
      const res = await fetch('/api/admin/outreach/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: property.id,
          property_address: property.address,
          suburb: property.suburb,
          city: property.city,
          region: property.region || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.liked === undefined) {
        setLikedPropertyIds(prev => {
          const next = new Set(prev);
          if (wasLiked) next.add(property.id);
          else next.delete(property.id);
          return next;
        });
      }
    } catch {
      setLikedPropertyIds(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(property.id);
        else next.delete(property.id);
        return next;
      });
    }
  };

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

  const handleLastSoldPreset = (preset: string) => {
    setLastSoldPreset(preset);
    switch (preset) {
      case '5-10':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '5', last_sold_max_years: '10' }));
        break;
      case '3-5':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '3', last_sold_max_years: '5' }));
        break;
      case '0-3':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '0', last_sold_max_years: '3' }));
        break;
      case '15+':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '15', last_sold_max_years: '' }));
        break;
      case 'all':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '', last_sold_max_years: '' }));
        break;
      case 'none':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '', last_sold_max_years: '' }));
        break;
    }
  };

  const handleClearFilters = () => {
    setAddressInput("");
    setShowLikedOnly(false);
    setLastSoldPreset('5-10');
    setFilters({
      region: "Auckland",
      city: "North Shore City",
      suburb: "",
      last_sold_min_years: "5",
      last_sold_max_years: "10",
      min_bedrooms: "",
      max_bedrooms: "",
      min_bathrooms: "",
      max_bathrooms: "",
      min_car_spaces: "",
      max_car_spaces: "",
      search: "",
    });
  };

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const prop = (e as CustomEvent).detail as Property;
      setEditingProperty(prop);
      setEditFormData({
        address: prop.address || '',
        suburb: prop.suburb || '',
        city: prop.city || '',
        region: prop.region || '',
        postcode: '',
        bedrooms: prop.bedrooms?.toString() || '',
        bathrooms: prop.bathrooms?.toString() || '',
        car_spaces: prop.garages?.toString() || '',
        year_built: prop.build_year?.toString() || '',
        floor_size: prop.floor_area || '',
        land_area: prop.land_area?.toString() || '',
        last_sold_price: prop.last_sold_price?.toString() || '',
        last_sold_date: prop.last_sold_date || '',
        capital_value: prop.rv?.toString() || '',
        property_url: prop.property_url || '',
        cover_image_url: prop.image_url || '',
        description: prop.description || '',
      });
    };
    window.addEventListener('open-edit-modal', handler);
    return () => window.removeEventListener('open-edit-modal', handler);
  }, []);

  const handleEditFieldChange = (key: string, value: string) => {
    setEditFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingProperty) return;
    setSaving(true);
    try {
      const payload: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(editFormData)) {
        if (value !== '' && value !== undefined) {
          payload[key] = value;
        } else {
          payload[key] = null;
        }
      }
      const response = await fetch(`/api/admin/properties/${editingProperty.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update property');
      }
      const updatedProperty = result.property;
      if (updatedProperty) {
        queryClient.setQueryData(["admin-properties", filters, propertyFilter, lastSoldPreset, showLikedOnly], (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              properties: page.properties.map((p: Property) =>
                p.id === updatedProperty.id ? updatedProperty : p
              ),
            })),
          };
        });
      }
      showNotification('success', 'Property updated successfully');
      setEditingProperty(null);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to update property');
    } finally {
      setSaving(false);
    }
  };

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

      {/* Filters Section */}
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
            Displaying {displayProperties.length} of {totalProperties} properties • Scroll to load more
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

        {/* Quick Suburb Filter Buttons */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "10px" }}>
            Quick Filter by Suburb
          </label>
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "10px",
            alignItems: "center"
          }}>
            {['Northcross', 'Oteha', 'Torbay', 'Fairview Heights', 'Waiake', 'Browns Bay', 'Pinehill', 'Rothesay Bay', 'Murrays Bay', 'Albany'].map((suburb) => (
              <button
                key={suburb}
                onClick={() => {
                  setAddressInput('');
                  setFilters(prev => ({
                    ...prev,
                    search: '',
                    suburb: prev.suburb === suburb ? '' : suburb,
                  }));
                }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: filters.suburb === suburb ? '#3b82f6' : 'white',
                  color: filters.suburb === suburb ? 'white' : '#4a5568',
                  border: filters.suburb === suburb ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: filters.suburb === suburb ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: filters.suburb === suburb ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (filters.suburb !== suburb) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (filters.suburb !== suburb) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {suburb}
              </button>
            ))}
            {filters.suburb && (
              <button
                onClick={() => {
                  setAddressInput('');
                  setFilters(prev => ({ ...prev, search: '', suburb: '' }));
                }}
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

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
            Like Status
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setShowLikedOnly(!showLikedOnly)}
              style={{
                padding: '8px 18px',
                backgroundColor: showLikedOnly ? '#ef4444' : 'white',
                color: showLikedOnly ? 'white' : '#4a5568',
                border: showLikedOnly ? '2px solid #ef4444' : '2px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: showLikedOnly ? '600' : '500',
                transition: 'all 0.2s ease',
                boxShadow: showLikedOnly ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!showLikedOnly) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }
              }}
              onMouseLeave={(e) => {
                if (!showLikedOnly) {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }
              }}
            >
              {showLikedOnly ? '\u2665 Liked' : '\u2661 Liked'}
            </button>
            {showLikedOnly && (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#718096' }}>
                {displayProperties.length} liked
              </span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
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

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
            Last Sold
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            {(['all', '5-10', '3-5', '0-3', '15+', 'none'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handleLastSoldPreset(preset)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: lastSoldPreset === preset ? '#3b82f6' : 'white',
                  color: lastSoldPreset === preset ? 'white' : '#4a5568',
                  border: lastSoldPreset === preset ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: lastSoldPreset === preset ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: lastSoldPreset === preset ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
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
                {preset === 'all' ? 'All' : preset === '5-10' ? '5-10 years' : preset === '3-5' ? '3-5 years' : preset === '0-3' ? '0-3 years' : preset === '15+' ? '15+ years' : 'No Last Sold'}
              </button>
            ))}
            {lastSoldPreset !== 'none' && lastSoldPreset !== 'all' && (
              <>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "500", color: "#718096", marginBottom: "4px" }}>
                Min Years
              </label>
              <input
                type="number"
                value={filters.last_sold_min_years}
                onChange={(e) => { setLastSoldPreset(''); handleFilterChange("last_sold_min_years", e.target.value); }}
                min="0"
                placeholder="0"
                style={{
                  width: "90px",
                  padding: "8px 14px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "10px",
                  fontSize: "0.95rem",
                  backgroundColor: "white",
                  color: "#2D3748",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "500", color: "#718096", marginBottom: "4px" }}>
                Max Years
              </label>
              <input
                type="number"
                value={filters.last_sold_max_years}
                onChange={(e) => { setLastSoldPreset(''); handleFilterChange("last_sold_max_years", e.target.value); }}
                min="0"
                placeholder="No Max"
                style={{
                  width: "90px",
                  padding: "8px 14px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "10px",
                  fontSize: "0.95rem",
                  backgroundColor: "white",
                  color: "#2D3748",
                  boxSizing: "border-box",
                }}
              />
            </div>
            </>
            )}
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
                width: "90px",
                padding: "8px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
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
                width: "90px",
                padding: "8px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
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
                width: "90px",
                padding: "8px 14px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                backgroundColor: "white",
                color: "#2D3748",
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
                    width: "90px",
                    padding: "8px 14px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    backgroundColor: "white",
                    color: "#2D3748",
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
                    width: "90px",
                    padding: "8px 14px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
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
                    width: "90px",
                    padding: "8px 14px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    backgroundColor: "white",
                    color: "#2D3748",
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
                padding: "8px 18px",
                backgroundColor: "white",
                color: "#3b82f6",
                border: "2px dashed #93c5fd",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "600",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#93c5fd'; }}
            >
              {showMoreFilters ? "− Hide" : "+ More Filter Criteria"}
            </button>
          </div>
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
        {displayProperties.map((property, index) => {
          const isLast = index === displayProperties.length - 1;
          return (
            <div key={`${property.id}-${index}`} ref={isLast ? lastPropertyElementRef : null}>
              <PropertyCard 
                property={property}
                isLiked={showLikedOnly || likedPropertyIds.has(property.id)}
                onToggleLike={handleToggleLike}
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
      {!hasNextPage && displayProperties.length > 0 && !isFetchingNextPage && (
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

      {!hasNextPage && displayProperties.length > 0 && (
        <div style={{
          textAlign: "center",
          padding: "30px",
          color: "#718096",
          fontSize: "0.95rem",
        }}>
          You{"'"}ve reached the end! No more properties to load.
        </div>
      )}

      {/* Empty State */}
      {displayProperties.length === 0 && !isLoading && (
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
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2D3748', marginBottom: '24px' }}>
              Edit Property
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { key: 'address', label: 'Address', type: 'text' },
                { key: 'suburb', label: 'Suburb', type: 'text' },
                { key: 'city', label: 'City', type: 'text' },
                { key: 'region', label: 'Region', type: 'text' },
                { key: 'postcode', label: 'Postcode', type: 'text' },
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
