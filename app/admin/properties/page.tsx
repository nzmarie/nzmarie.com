"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, useQueryClient, useQuery, keepPreviousData } from "@tanstack/react-query";
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
  on_market_sale?: boolean;
  sale_listing_status?: string | null;
  sale_price?: string | null;
  sale_agent?: string | null;
  on_market_rent?: boolean;
  rent_listing_status?: string | null;
  rent_price?: string | null;
}

interface Filters {
  region: string;
  city: string;
  suburb: string;
  last_sold_min_years: string;
  last_sold_max_years: string;
  build_year_min: string;
  build_year_max: string;
  min_bedrooms: string;
  max_bedrooms: string;
  min_bathrooms: string;
  max_bathrooms: string;
  min_car_spaces: string;
  max_car_spaces: string;
  rv_min: string;
  rv_max: string;
  min_floor_area: string;
  min_land_area: string;
  max_land_area: string;
  market_premium: string;
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
    property.realestate_url ? `Realestate URL: ${property.realestate_url}` : null,
    property.on_market_sale ? `For Sale: ${property.sale_listing_status || 'Yes'}${property.sale_price ? ` ${property.sale_price}` : ''}${property.sale_agent ? ` (${property.sale_agent})` : ''}` : null,
    property.on_market_rent ? `For Rent: ${property.rent_listing_status || 'Yes'}${property.rent_price ? ` ${property.rent_price}` : ''}` : null,
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

        {/* For Sale Badge */}
        {property.on_market_sale && (
          <div style={{
            position: "absolute",
            top: property.build_year ? "52px" : "16px",
            left: "16px",
            backgroundColor: "rgba(34, 197, 94, 0.9)",
            color: "white",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>
            For Sale{property.sale_price ? ` ${property.sale_price}` : ''}
          </div>
        )}

        {/* For Rent Badge */}
        {property.on_market_rent && (
          <div style={{
            position: "absolute",
            top: property.on_market_sale
              ? (property.build_year ? "88px" : "52px")
              : (property.build_year ? "52px" : "16px"),
            left: "16px",
            backgroundColor: "rgba(139, 92, 246, 0.9)",
            color: "white",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>
            To Rent{property.rent_price ? ` ${property.rent_price}` : ''}
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
            </div>
            <div style={{ fontWeight: "600", color: "#2D3748", fontSize: "0.9rem", lineHeight: "1.3" }}>
              F: {property.floor_area && property.floor_area !== "-" ? property.floor_area : "-"} m²
            </div>
            <div style={{ fontSize: "0.7rem", color: "#718096", fontWeight: "500", lineHeight: "1.3" }}>
              L: {property.land_area && property.land_area !== "-" && property.land_area !== 0 ? property.land_area : "-"} m²
            </div>
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
    suburb: "Northcross",
    last_sold_min_years: "5",
    last_sold_max_years: "10",
    build_year_min: "",
    build_year_max: "",
    min_bedrooms: "",
    max_bedrooms: "",
    min_bathrooms: "",
    max_bathrooms: "",
    min_car_spaces: "",
    max_car_spaces: "",
    rv_min: "",
    rv_max: "",
    min_floor_area: "",
    min_land_area: "",
    max_land_area: "",
    market_premium: "",
    search: "",
  });
  const [addressInput, setAddressInput] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<'house' | 'all' | 'townhouse'>('house');
  const [marketStatus, setMarketStatus] = useState<'all' | 'for_sale' | 'for_rent' | 'not_listed'>('all');
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [lastSoldPreset, setLastSoldPreset] = useState('5-10');
  const [buildYearPreset, setBuildYearPreset] = useState('all');
  const [paginationMode, setPaginationMode] = useState<'infinite' | 'classic'>('infinite');
  const [currentPage, setCurrentPage] = useState(1);

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

  const fetchPageData = async (pageNum: number): Promise<{ properties: Property[]; total: number }> => {
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

      let mapped: Property[] = result.data.map((item: Record<string, unknown>) => ({
        id: (item.joined_property_id as string) || ((item.property_id as string) ? (item.property_id as string).replace(/-/g, '') : (item.id as string)),
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
        on_market_sale: item.on_market_sale ?? false,
        on_market_rent: item.on_market_rent ?? false,
        sale_listing_status: item.sale_listing_status ?? null,
        sale_price: item.sale_price ?? null,
        sale_agent: item.sale_agent ?? null,
        rent_listing_status: item.rent_listing_status ?? null,
        rent_price: item.rent_price ?? null,
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

      if (filters.build_year_min) {
        const min = parseInt(filters.build_year_min);
        mapped = mapped.filter(p => p.build_year !== null && p.build_year >= min);
      }
      if (filters.build_year_max) {
        const max = parseInt(filters.build_year_max);
        mapped = mapped.filter(p => p.build_year !== null && p.build_year <= max);
      }
      if (filters.rv_min) {
        const min = parseInt(filters.rv_min);
        mapped = mapped.filter(p => p.rv !== null && p.rv >= min);
      }
      if (filters.rv_max) {
        const max = parseInt(filters.rv_max);
        mapped = mapped.filter(p => p.rv !== null && p.rv <= max);
      }
      if (filters.min_floor_area) {
        const min = parseFloat(filters.min_floor_area);
        mapped = mapped.filter(p => {
          const fa = p.floor_area ? parseFloat(p.floor_area) : null;
          return fa !== null && !isNaN(fa) && fa >= min;
        });
      }
      if (filters.min_land_area) {
        const min = parseFloat(filters.min_land_area);
        mapped = mapped.filter(p => {
          const la = typeof p.land_area === 'string' ? parseFloat(p.land_area) : (p.land_area as number);
          return la !== null && !isNaN(la) && la >= min;
        });
      }
      if (filters.max_land_area) {
        const max = parseFloat(filters.max_land_area);
        mapped = mapped.filter(p => {
          const la = typeof p.land_area === 'string' ? parseFloat(p.land_area) : (p.land_area as number);
          return la !== null && !isNaN(la) && la <= max;
        });
      }
      if (filters.market_premium) {
        const threshold = parseFloat(filters.market_premium) / 100.0;
        mapped = mapped.filter(p => {
          if (!p.last_sold_price || !p.rv || p.rv <= 0) return false;
          return (p.last_sold_price / p.rv) > threshold;
        });
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
    if (filters.build_year_min) params.append("build_year_min", filters.build_year_min);
    if (filters.build_year_max) params.append("build_year_max", filters.build_year_max);
    if (filters.rv_min) params.append("rv_min", filters.rv_min);
    if (filters.rv_max) params.append("rv_max", filters.rv_max);
    if (filters.min_floor_area) params.append("min_floor_area", filters.min_floor_area);
    if (filters.min_land_area) params.append("min_land_area", filters.min_land_area);
    if (filters.max_land_area) params.append("max_land_area", filters.max_land_area);
    if (filters.market_premium) params.append("market_premium", filters.market_premium);
    if (propertyFilter === 'house') params.append("standalone_only", "true");
    if (propertyFilter === 'townhouse') params.append("townhouse_only", "true");
    if (marketStatus !== 'all') params.append("market_status", marketStatus);

    const response = await fetch(`/api/admin/properties?${params}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch properties");
    }

    return { properties: result.properties, total: result.pagination.total };
  };

  const {
    data: infiniteData,
    isFetchingNextPage,
    isLoading,
    isFetching,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<{ properties: Property[]; total: number }, Error>({
    queryKey: ["admin-properties", "infinite", filters, propertyFilter, lastSoldPreset, buildYearPreset, showLikedOnly, marketStatus],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => fetchPageData((pageParam as number) || 1),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && lastPage.properties.length === 18) {
        return allPages.length + 1;
      }
      return undefined;
    },
    placeholderData: keepPreviousData,
    enabled: paginationMode === 'infinite' && status === "authenticated",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: classicData,
    isLoading: classicLoading,
    isFetching: classicFetching,
  } = useQuery<{ properties: Property[]; total: number }, Error>({
    queryKey: ["admin-properties", "classic", filters, propertyFilter, lastSoldPreset, buildYearPreset, showLikedOnly, currentPage, marketStatus],
    queryFn: async () => fetchPageData(currentPage),
    placeholderData: keepPreviousData,
    enabled: paginationMode === 'classic' && status === "authenticated",
    staleTime: 5 * 60 * 1000,
  });

  const isClassic = paginationMode === 'classic';
  const propertiesData = infiniteData as { pages: { properties: Property[]; total: number }[] } | undefined;
  const allInfiniteProperties: Property[] = propertiesData ? propertiesData.pages.flatMap((page) => page.properties) : [];
  const properties: Property[] = isClassic ? (classicData?.properties ?? []) : allInfiniteProperties;
  const displayProperties = properties;
  const [likedPropertyIds, setLikedPropertyIds] = useState<Set<string>>(new Set());
  const totalProperties = isClassic ? (classicData?.total ?? 0) : (propertiesData?.pages[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalProperties / 18));

  useEffect(() => {
    if (isClassic) return;
    if (!propertiesData) return;
    setCurrentPage(propertiesData.pages.length);
  }, [isClassic, propertiesData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, propertyFilter, lastSoldPreset, showLikedOnly]);

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
    if (isClassic) return;
    const currentElement = lastPropertyElementRef.current;
    if (!currentElement) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        console.log("Fetching next page...");
        fetchNextPage();
      }
    }, { threshold: 0, rootMargin: "200px" });

    observer.observe(currentElement);

    return () => {
      observer.disconnect();
    };
  }, [isClassic, hasNextPage, isFetchingNextPage, fetchNextPage, propertiesData]);

  const currentCitySuburbs = CITY_SUBURBS[filters.city] || [];
  const SUBURB_ORDER = ['Northcross', 'Oteha', 'Torbay', 'Fairview Heights', 'Waiake', 'Browns Bay', 'Pinehill', 'Rothesay Bay', 'Murrays Bay', 'Albany', 'Long Bay', 'Forrest Hill', 'Schnapper Rock', 'Unsworth Heights', 'Sunnynook', 'Greenhithe', 'Chatswood', 'Mairangi Bay', 'Campbells Bay', 'Castor Bay', 'Milford', 'Glenfield', 'Hillcrest', 'Birkenhead', 'Hauraki'];
  const sortedSuburbs = [...currentCitySuburbs].sort((a, b) => {
    const ai = SUBURB_ORDER.indexOf(a);
    const bi = SUBURB_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

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

  const handleBuildYearPreset = (preset: string) => {
    setBuildYearPreset(preset);
    const currentYear = new Date().getFullYear();
    switch (preset) {
      case '<5':
        setFilters((prev) => ({ ...prev, build_year_min: (currentYear - 5 + 1).toString(), build_year_max: '' }));
        break;
      case '5-10':
        setFilters((prev) => ({ ...prev, build_year_min: (currentYear - 10).toString(), build_year_max: (currentYear - 5).toString() }));
        break;
      case '10-20':
        setFilters((prev) => ({ ...prev, build_year_min: (currentYear - 20).toString(), build_year_max: (currentYear - 10 - 1).toString() }));
        break;
      case '20+':
        setFilters((prev) => ({ ...prev, build_year_min: '', build_year_max: (currentYear - 20 - 1).toString() }));
        break;
      case 'all':
        setFilters((prev) => ({ ...prev, build_year_min: '', build_year_max: '' }));
        break;
    }
  };

  const handleClearFilters = () => {
    setAddressInput("");
    setShowLikedOnly(false);
    setLastSoldPreset('5-10');
    setBuildYearPreset('all');
    setMarketStatus('all');
    setFilters({
      region: "Auckland",
      city: "North Shore City",
      suburb: "Northcross",
      last_sold_min_years: "5",
      last_sold_max_years: "10",
      build_year_min: "",
      build_year_max: "",
      min_bedrooms: "",
      max_bedrooms: "",
      min_bathrooms: "",
      max_bathrooms: "",
      min_car_spaces: "",
      max_car_spaces: "",
      rv_min: "",
      rv_max: "",
      min_floor_area: "",
      min_land_area: "",
      max_land_area: "",
      market_premium: "",
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
        last_sold_date: prop.last_sold_date ? prop.last_sold_date.split('T')[0] : '',
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
      if (result.property) {
        queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
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
            Displaying {displayProperties.length} of {totalProperties} properties
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
            {['Northcross', 'Oteha', 'Torbay', 'Fairview Heights', 'Waiake', 'Browns Bay', 'Pinehill', 'Rothesay Bay', 'Murrays Bay', 'Albany', 'Long Bay', 'Forrest Hill', 'Schnapper Rock', 'Unsworth Heights', 'Sunnynook', 'Greenhithe', 'Chatswood', 'Mairangi Bay', 'Campbells Bay', 'Castor Bay', 'Milford', 'Glenfield', 'Hillcrest', 'Birkenhead', 'Hauraki'].map((suburb) => (
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

        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
              {(['all', 'for_sale', 'for_rent', 'not_listed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setMarketStatus(status)}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: marketStatus === status ? (status === 'for_sale' ? '#22c55e' : status === 'for_rent' ? '#8b5cf6' : status === 'not_listed' ? '#64748b' : '#3b82f6') : 'white',
                    color: marketStatus === status ? 'white' : '#4a5568',
                    border: marketStatus === status ? `2px solid ${status === 'for_sale' ? '#22c55e' : status === 'for_rent' ? '#8b5cf6' : status === 'not_listed' ? '#64748b' : '#3b82f6'}` : '2px solid #e2e8f0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: marketStatus === status ? '600' : '500',
                    transition: 'all 0.2s ease',
                    boxShadow: marketStatus === status ? `0 4px 12px ${status === 'for_sale' ? 'rgba(34, 197, 94, 0.3)' : status === 'for_rent' ? 'rgba(139, 92, 246, 0.3)' : status === 'not_listed' ? 'rgba(100, 116, 139, 0.3)' : 'rgba(59, 130, 246, 0.3)'}` : 'none',
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
                  {status === 'all' ? 'All' : status === 'for_sale' ? 'For Sale' : status === 'for_rent' ? 'To Rent' : 'Not Listed'}
                </button>
              ))}
            </div>
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
                {preset === 'all' ? 'All' : preset === '5-10' ? '★ 5-10 years' : preset === '3-5' ? '3-5 years' : preset === '0-3' ? '0-3 years' : preset === '15+' ? '15+ years' : 'No Last Sold'}
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

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
            Built Year
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            {(['all', '<5', '5-10', '10-20', '20+'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handleBuildYearPreset(preset)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: buildYearPreset === preset ? (preset === '5-10' ? '#f59e0b' : '#3b82f6') : 'white',
                  color: buildYearPreset === preset ? 'white' : '#4a5568',
                  border: buildYearPreset === preset ? (preset === '5-10' ? '2px solid #f59e0b' : '2px solid #3b82f6') : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: buildYearPreset === preset ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: buildYearPreset === preset ? (preset === '5-10' ? '0 4px 12px rgba(245, 158, 11, 0.4)' : '0 4px 12px rgba(59, 130, 246, 0.3)') : 'none',
                }}
                onMouseEnter={(e) => {
                  if (buildYearPreset !== preset) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (buildYearPreset !== preset) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {preset === 'all' ? 'All' : preset === '<5' ? '< 5 years' : preset === '5-10' ? '★ 5-10 years' : preset === '10-20' ? '10-20 years' : '20+ years'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Min Beds
            </label>
            <input
              type="number"
              value={filters.min_bedrooms}
              onChange={(e) => handleFilterChange("min_bedrooms", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "70px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Min RV ($)
            </label>
            <input
              type="number"
              value={filters.rv_min}
              onChange={(e) => handleFilterChange("rv_min", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "100px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Max RV ($)
            </label>
            <input
              type="number"
              value={filters.rv_max}
              onChange={(e) => handleFilterChange("rv_max", e.target.value)}
              min="0"
              placeholder="No Max"
              style={{
                width: "100px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Min Floor (m²)
            </label>
            <input
              type="number"
              value={filters.min_floor_area}
              onChange={(e) => handleFilterChange("min_floor_area", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "90px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Min Land (m²)
            </label>
            <input
              type="number"
              value={filters.min_land_area}
              onChange={(e) => handleFilterChange("min_land_area", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "90px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Market Premium
            </label>
            <select
              value={filters.market_premium}
              onChange={(e) => handleFilterChange("market_premium", e.target.value)}
              style={{
                width: "110px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: filters.market_premium ? "#2D3748" : "#9ca3af",
                cursor: "pointer",
              }}
            >
              <option value="">Any</option>
              <option value="100">Sale &gt; RV</option>
              <option value="110">Sale &gt; 110% RV</option>
            </select>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              style={{
                padding: "7px 16px",
                backgroundColor: "white",
                color: "#3b82f6",
                border: "2px dashed #93c5fd",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "600",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#93c5fd'; }}
            >
              {showMoreFilters ? "− Hide" : "+ More"}
            </button>
          </div>
        </div>

        {showMoreFilters && (
          <div style={{
            marginBottom: "16px",
            padding: "16px",
            backgroundColor: "#fafafa",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Max Bedrooms
                </label>
                <input
                  type="number"
                  value={filters.max_bedrooms}
                  onChange={(e) => handleFilterChange("max_bedrooms", e.target.value)}
                  min="0"
                  placeholder="10"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Min Bathrooms
                </label>
                <input
                  type="number"
                  value={filters.min_bathrooms}
                  onChange={(e) => handleFilterChange("min_bathrooms", e.target.value)}
                  min="0"
                  placeholder="0"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Max Bathrooms
                </label>
                <input
                  type="number"
                  value={filters.max_bathrooms}
                  onChange={(e) => handleFilterChange("max_bathrooms", e.target.value)}
                  min="0"
                  placeholder="10"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Min Car Spaces
                </label>
                <input
                  type="number"
                  value={filters.min_car_spaces}
                  onChange={(e) => handleFilterChange("min_car_spaces", e.target.value)}
                  min="0"
                  placeholder="0"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Max Car Spaces
                </label>
                <input
                  type="number"
                  value={filters.max_car_spaces}
                  onChange={(e) => handleFilterChange("max_car_spaces", e.target.value)}
                  min="0"
                  placeholder="10"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Max Land (m²)
                </label>
                <input
                  type="number"
                  value={filters.max_land_area}
                  onChange={(e) => handleFilterChange("max_land_area", e.target.value)}
                  min="0"
                  placeholder="No Max"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Region
                </label>
                <select
                  value={filters.region}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
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
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  City / District
                </label>
                <select
                  value={filters.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
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
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Suburb
                </label>
                <select
                  value={filters.suburb}
                  onChange={(e) => handleFilterChange("suburb", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    cursor: "pointer",
                  }}
                >
                  <option value="">All suburbs</option>
                  {sortedSuburbs.map((suburb) => (
                    <option key={suburb} value={suburb}>
                      {suburb}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        )}
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button
              onClick={handleClearFilters}
              style={{
                padding: "10px 20px",
                backgroundColor: "#e2e8f0",
                color: "#4a5568",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.9rem",
                transition: "all 0.2s",
              }}
            >
              Clear All
            </button>
          </div>
        </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "20px", marginBottom: "12px", padding: "12px 16px", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <span style={{ fontSize: "0.9rem", color: "#4a5568" }}>
          {isClassic
            ? `Displaying ${Math.max(1, (currentPage - 1) * 18 + 1)} to ${Math.min(currentPage * 18, totalProperties)} of ${totalProperties} properties`
            : `Displaying 1 to ${displayProperties.length} of ${totalProperties} properties`}
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
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568',
              cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >≪</button>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568',
              cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
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
              style={{
                width: "52px",
                padding: "4px 6px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: "600",
                color: "#2D3748",
                textAlign: "center",
                outline: "none",
                MozAppearance: "textfield",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              min={1}
              max={totalPages}
            />{' '}
            of {totalPages}
          </span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568',
              cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >›</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568',
              cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >≫</button>
        </div>
      )}

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
        opacity: isClassic ? (classicFetching && !isFetchingNextPage ? 0.6 : 1) : (isFetching && !isFetchingNextPage ? 0.6 : 1),
        transition: "opacity 0.2s ease-in-out",
      }}>
        {displayProperties.map((property, index) => {
          const isLast = index === displayProperties.length - 1;
          return (
            <div key={`${property.id}-${index}`} ref={(!isClassic && isLast) ? lastPropertyElementRef : null}>
              <PropertyCard 
                property={property}
                isLiked={showLikedOnly || likedPropertyIds.has(property.id)}
                onToggleLike={handleToggleLike}
              />
            </div>
          );
        })}
      </div>

      {isClassic && displayProperties.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px 0" }}>
          <span style={{ fontSize: "0.85rem", color: "#4a5568" }}>
            {Math.max(1, (currentPage - 1) * 18 + 1)}–{Math.min(currentPage * 18, totalProperties)} of {totalProperties}
          </span>
          <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>|</span>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568',
              cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >≪</button>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568',
              cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
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
              style={{
                width: "52px",
                padding: "4px 6px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: "600",
                color: "#2D3748",
                textAlign: "center",
                outline: "none",
                MozAppearance: "textfield",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              min={1}
              max={totalPages}
            />{' '}
            of {totalPages}
          </span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568',
              cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >›</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568',
              cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
          >≫</button>
        </div>
      )}

      {classicFetching && isClassic && (
        <div style={{ textAlign: "center", padding: "20px", color: "#718096" }}>
          Loading...
        </div>
      )}

      {!isClassic && isFetchingNextPage && (
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

      {!isClassic && !hasNextPage && displayProperties.length > 0 && !isFetchingNextPage && (
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

      {!isClassic && !hasNextPage && displayProperties.length > 0 && (
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
      {displayProperties.length === 0 && !isLoading && !classicLoading && (
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
