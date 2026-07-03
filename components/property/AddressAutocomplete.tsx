import { useState, useEffect, useRef } from 'react';
import { API_ENDPOINTS } from '@/lib/api/config';
import { useGooglePlacesAutocomplete } from '@/hooks/useGooglePlacesAutocomplete';

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
  useGoogleMaps?: boolean; // Use Google Maps instead of internal API
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  city,
  placeholder = 'Search by address...',
  apiEndpoint = API_ENDPOINTS.propertyAutocomplete,
  useGoogleMaps = false
}: AddressAutocompleteProps) {
  // Google Maps autocomplete hook
  const {
    suggestions: googleSuggestions,
    isLoading: googleLoading,
    selectSuggestion: selectGoogleSuggestion,
  } = useGooglePlacesAutocomplete(value);

  // Internal API suggestions
  const [internalSuggestions, setInternalSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingInternal, setIsLoadingInternal] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  // Determine which suggestions and loading state to use
  const suggestions = useGoogleMaps
    ? googleSuggestions.map((pred) => ({
        id: pred.place_id,
        address: pred.description,
        suburb: pred.structured_formatting.secondary_text?.split(',')[0] || '',
        city: pred.structured_formatting.secondary_text?.split(',')[1]?.trim() || '',
      }))
    : internalSuggestions;

  const isLoading = useGoogleMaps ? googleLoading : isLoadingInternal;

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

  // Fetch suggestions from internal API (when not using Google Maps)
  useEffect(() => {
    if (useGoogleMaps) return; // Skip internal API when using Google Maps

    const fetchSuggestions = async () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        return;
      }

      if (value.length < 2) {
        setInternalSuggestions([]);
        setShowSuggestions(false);
        setNoResults(false);
        return;
      }

      setIsLoadingInternal(true);
      try {
        const params = new URLSearchParams({ q: value });
        if (city && city !== 'all-cities') {
          params.append('city', city);
        }

        const response = await fetch(`${apiEndpoint}?${params}`);
        const data = await response.json();
        setInternalSuggestions(data);
        setShowSuggestions(data.length > 0);
        setNoResults(data.length === 0);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setInternalSuggestions([]);
        setNoResults(false);
      } finally {
        setIsLoadingInternal(false);
      }
    };

    setIsSelected(false);
    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [value, city, apiEndpoint, useGoogleMaps]);

  // Update suggestions visibility for Google Maps
  useEffect(() => {
    if (useGoogleMaps) {
      setShowSuggestions(googleSuggestions.length > 0);
      setNoResults(value.length >= 3 && !googleLoading && googleSuggestions.length === 0);
    }
  }, [useGoogleMaps, googleSuggestions, googleLoading, value]);

  const handleSelect = async (suggestion: AddressSuggestion) => {
    isSelectingRef.current = true;
    setIsSelected(true);
    setShowSuggestions(false);
    setNoResults(false);

    if (useGoogleMaps) {
      // Get full place details from Google
      const parsedAddress = await selectGoogleSuggestion(suggestion.id);
      if (parsedAddress) {
        onChange(parsedAddress.fullAddress);
        onSelect?.({
          id: suggestion.id,
          address: parsedAddress.fullAddress,
          suburb: parsedAddress.suburb,
          city: parsedAddress.city,
        });
      }
    } else {
      // Internal API - use as-is
      onChange(suggestion.address);
      onSelect?.(suggestion);
    }
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
            No addresses found. Try including the street name, for example 12 Queen Street, Albany.
          </li>
        </ul>
      )}
    </div>
  );
}
