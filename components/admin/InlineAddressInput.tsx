'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { findLocationBySuburb } from '@/lib/geo-data';

const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;

interface GeoapifyProperties {
  formatted: string;
  state?: string;
  city?: string;
  suburb?: string;
  county?: string;
  district?: string;
}

interface DuplicateInfo {
  exists: boolean;
  duplicate?: {
    id: string;
    address: string;
    suburb: string;
    city: string;
    region: string;
    campaign: string;
    status: string;
    sent_at?: string;
  };
}

interface InlineAddressInputProps {
  campaign?: string;
  onAddSuccess: (property: unknown) => void;
  autoFocus?: boolean;
}

export default function InlineAddressInput({
  campaign = '2026_Q3_Report',
  onAddSuccess,
  autoFocus = true,
}: InlineAddressInputProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Address autocomplete search
  const searchAddresses = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
          value
        )}&filter=countrycode:nz&limit=8&apiKey=${GEOAPIFY_KEY}`
      );
      const data = await res.json();
      const results = (data.features ?? []).map(
        (f: { properties: GeoapifyProperties }) => f.properties.formatted
      );
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Address search failed:', error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Check for duplicates
  const checkDuplicate = useCallback(
    async (address: string) => {
      try {
        const res = await fetch('/api/admin/outreach/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, campaign }),
        });
        const data = await res.json();
        setDuplicateInfo(data);
      } catch (error) {
        console.error('Duplicate check failed:', error);
        setDuplicateInfo(null);
      }
    },
    [campaign]
  );

  // Handle input change
  const handleInputChange = (value: string) => {
    setInput(value);
    setSelectedAddress('');
    setDuplicateInfo(null);
    setSelectedIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddresses(value), 300);
  };

  // Handle address selection
  const handleSelectAddress = useCallback(
    (address: string) => {
      setInput(address);
      setSelectedAddress(address);
      setShowSuggestions(false);
      setSelectedIndex(-1);
      checkDuplicate(address);
    },
    [checkDuplicate]
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectAddress(suggestions[selectedIndex]);
      } else if (selectedAddress && !duplicateInfo?.exists) {
        handleSubmit();
      } else if (duplicateInfo?.exists) {
        // Shake animation on duplicate
        inputRef.current?.classList.add('animate-shake');
        setTimeout(() => inputRef.current?.classList.remove('animate-shake'), 400);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // Extract street name from address
  const extractStreetName = (fullAddress: string): string => {
    // Remove leading number and optional unit (e.g., "5 ", "15A ", "123/456 ")
    let street = fullAddress.replace(/^\d+[A-Za-z]?(?:\/\d+)?\s+/, '');
    
    // Take everything before the first comma (to remove suburb, city, etc.)
    street = street.split(',')[0].trim();
    
    return street || '';
  };

  // Submit new address
  const handleSubmit = async () => {
    if (!selectedAddress || duplicateInfo?.exists || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Extract location info
      const addressParts = selectedAddress.split(',').map((s) => s.trim());
      let suburb = '';
      let city = '';
      let region = '';

      // Try to find suburb in address
      for (const part of addressParts) {
        const location = findLocationBySuburb(part);
        if (location) {
          suburb = location.suburb;
          city = location.city;
          region = location.region;
          break;
        }
      }

      // If not found, try the second-to-last part
      if (!suburb && addressParts.length >= 2) {
        suburb = addressParts[addressParts.length - 2];
        const location = findLocationBySuburb(suburb);
        if (location) {
          city = location.city;
          region = location.region;
        }
      }

      // Extract street name
      const street = extractStreetName(selectedAddress);

      const res = await fetch('/api/admin/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_address: selectedAddress,
          suburb: suburb || 'Unknown',
          city: city || 'Auckland City',
          region: region || 'Auckland',
          street: street || null,
          campaign,
        }),
      });

      if (!res.ok) throw new Error('Failed to add address');

      const data = await res.json();
      
      // Success: clear and refocus
      setInput('');
      setSelectedAddress('');
      setDuplicateInfo(null);
      setSuggestions([]);
      inputRef.current?.focus();
      
      // Notify parent
      onAddSuccess(data.data);
    } catch (error) {
      console.error('Failed to add address:', error);
      alert('Failed to add address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine input border color
  const getBorderColor = () => {
    if (duplicateInfo?.exists) return 'border-yellow-400 ring-2 ring-yellow-200';
    if (selectedAddress && !duplicateInfo) return 'border-green-400 ring-2 ring-green-200';
    return 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Enter North Shore address (e.g., 5 Cottam Grove, Northcross...)"
          className={`w-full pl-12 pr-4 py-3 rounded-lg border-2 transition-all duration-200 text-base ${getBorderColor()}`}
          disabled={isSubmitting}
        />
        {isSearching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          </span>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-300 overflow-hidden max-h-80 overflow-y-auto">
          <li className="px-4 py-2 bg-blue-50 text-xs font-semibold text-blue-700 border-b border-blue-200">
            📍 Select an address:
          </li>
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelectAddress(s)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`px-4 py-3 text-sm cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${
                selectedIndex === i
                  ? 'bg-blue-100 text-blue-900 font-medium'
                  : 'text-slate-700 hover:bg-blue-50'
              }`}
            >
              <span className="mr-2 text-blue-500">📍</span>
              {s}
            </li>
          ))}
        </ul>
      )}

      {/* Status message */}
      <div className="mt-2 min-h-[24px]">
        {duplicateInfo?.exists && (
          <p className="text-sm text-yellow-700 font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>
              Already in {duplicateInfo.duplicate?.status === 'sent' ? 'Sent' : 'Pending'} list
              ({duplicateInfo.duplicate?.campaign})
            </span>
          </p>
        )}
        {selectedAddress && !duplicateInfo?.exists && (
          <p className="text-sm text-green-600 font-medium flex items-center gap-2">
            <span>✓</span>
            <span>Valid address, press Enter to add</span>
          </p>
        )}
        {!selectedAddress && input.length >= 3 && !isSearching && (
          <p className="text-sm text-slate-400">
            ↑↓ to select, Enter to confirm
          </p>
        )}
      </div>

      {/* Shake animation CSS */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.4s;
        }
      `}</style>
    </div>
  );
}
