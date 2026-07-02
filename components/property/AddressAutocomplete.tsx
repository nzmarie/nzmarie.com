import { useState, useEffect, useRef } from 'react';
import { API_ENDPOINTS } from '@/lib/api/config';

interface AddressSuggestion {
  id: string;
  address: string;
  suburb: string;
  city: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  city?: string;
  placeholder?: string;
  apiEndpoint?: string;
  useGeoapify?: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  city,
  placeholder = 'Search by address...',
  apiEndpoint = API_ENDPOINTS.propertyAutocomplete,
  useGeoapify = false
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setNoResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        return;
      }

      if (value.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        setNoResults(false);
        return;
      }

      setIsLoading(true);
      try {
        if (useGeoapify) {
          const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || '';
          const response = await fetch(
            `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(value)}&filter=countrycode:nz&limit=6&apiKey=${geoapifyKey}`
          );
          const data = await response.json();
          const features = data.features ?? [];
          const results = features.map((f: any, index: number) => ({
            id: `geo-${index}`,
            address: f.properties.formatted,
            suburb: f.properties.suburb || f.properties.district || '',
            city: f.properties.city || f.properties.county || '',
          }));
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
          setNoResults(results.length === 0);
        } else {
          const params = new URLSearchParams({ q: value });
          if (city && city !== 'all-cities') {
            params.append('city', city);
          }

          const response = await fetch(`${apiEndpoint}?${params}`);
          const data = await response.json();
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
          setNoResults(data.length === 0);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setNoResults(false);
      } finally {
        setIsLoading(false);
      }
    };

    setIsSelected(false);
    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [value, city, apiEndpoint, useGeoapify]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    isSelectingRef.current = true;
    setIsSelected(true);
    onChange(suggestion.address);
    setShowSuggestions(false);
    setNoResults(false);
    onSelect?.(suggestion);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <span style={{
        position: 'absolute',
        left: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '1.2rem',
        zIndex: 1,
        pointerEvents: 'none',
      }}>📍</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        style={{
          padding: '14px 48px 14px 44px',
          borderRadius: '10px',
          border: `2px solid ${isSelected ? '#86efac' : noResults ? '#fcd34d' : 'var(--input-border)'}`,
          fontSize: '16px',
          width: '100%',
          backgroundColor: 'var(--input-bg)',
          color: 'var(--foreground)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          transition: 'all 0.2s',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      {isSelected && (
        <span style={{
          position: 'absolute',
          right: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#22c55e',
          fontWeight: 700,
          fontSize: '1.1rem',
        }}>✓</span>
      )}

      {isLoading && !isSelected && (
        <span style={{
          position: 'absolute',
          right: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#94a3b8',
          fontSize: '14px',
        }}>⏳</span>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '6px',
          backgroundColor: 'var(--card-bg)',
          border: '2px solid #93c5fd',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 1000,
          listStyle: 'none',
          padding: 0,
          margin: '6px 0 0',
        }}>
          <li style={{
            padding: '8px 16px',
            backgroundColor: '#eff6ff',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#2563eb',
            borderBottom: '1px solid #bfdbfe',
            borderRadius: '10px 10px 0 0',
          }}>
            📍 Select an address:
          </li>
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.id}-${index}`}
              onMouseDown={() => handleSelect(suggestion)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid var(--card-border)' : 'none',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLIElement).style.backgroundColor = '#eff6ff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLIElement).style.backgroundColor = 'var(--card-bg)';
              }}
            >
              <span style={{ marginRight: '8px', color: '#3b82f6' }}>📍</span>
              <span style={{ fontWeight: 500, color: 'var(--text-heading)' }}>{suggestion.address}</span>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', paddingLeft: '26px' }}>
                {suggestion.suburb}, {suggestion.city}
              </div>
            </li>
          ))}
        </ul>
      )}

      {noResults && !isLoading && value.length >= 2 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '6px',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
          zIndex: 1000,
          listStyle: 'none',
          padding: 0,
          margin: '6px 0 0',
        }}>
          <li style={{ padding: '14px 16px', fontSize: '14px', color: '#6b7280' }}>
            <span style={{ marginRight: '8px' }}>💡</span>
            No addresses found. Try including the street name, e.g. "12 Queen Street, Albany"
          </li>
        </ul>
      )}
    </div>
  );
}
