/**
 * Autocomplete Component
 *
 * A reusable autocomplete input with debouncing and client-side caching
 * for WCVP taxonomy data (scientific names, families, genera)
 */

import React, { useState, useEffect, useRef } from 'react';

interface AutocompleteOption {
  value: string;
  label: string;
  family?: string;
  genus?: string;
  rank?: string;
  status?: string;
  taxon_id?: string;
}

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AutocompleteOption) => void;
  fetchSuggestions: (query: string) => Promise<AutocompleteOption[]>;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  minChars?: number;
  debounceMs?: number;
}

// Simple cache for suggestions
const suggestionCache = new Map<string, { data: AutocompleteOption[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const Autocomplete: React.FC<AutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  fetchSuggestions,
  placeholder = 'Start typing...',
  className = '',
  required = false,
  disabled = false,
  minChars = 2,
  debounceMs = 300,
}) => {
  const [suggestions, setSuggestions] = useState<AutocompleteOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const justSelectedRef = useRef<boolean>(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with debouncing and caching
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't fetch if we just selected a value
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    // Don't fetch if input is not focused (prevents auto-fetch on programmatic value changes)
    if (document.activeElement !== inputRef.current) {
      return;
    }

    // Don't fetch if input is too short
    if (value.length < minChars) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Debounce the fetch
    debounceTimerRef.current = setTimeout(async () => {
      const cacheKey = value.toLowerCase();

      // Check cache first
      const cached = suggestionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setSuggestions(cached.data);
        setIsOpen(cached.data.length > 0);
        return;
      }

      // Fetch from API
      setIsLoading(true);
      try {
        const results = await fetchSuggestions(value);
        setSuggestions(results);
        setIsOpen(results.length > 0);

        // Cache results
        suggestionCache.set(cacheKey, {
          data: results,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, fetchSuggestions, minChars, debounceMs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setHighlightedIndex(-1);
  };

  const handleSelectSuggestion = (suggestion: AutocompleteOption) => {
    justSelectedRef.current = true;
    onChange(suggestion.value);
    if (onSelect) {
      onSelect(suggestion);
    }
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className={`w-full p-2 border border-slate-200 rounded-lg text-sm ${className}`}
          required={required}
          disabled={disabled}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-4 w-4 text-slate-400"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.value}-${index}`}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition-colors ${
                index === highlightedIndex ? 'bg-emerald-50' : ''
              } ${index > 0 ? 'border-t border-slate-100' : ''}`}
            >
              <div className="font-medium text-slate-900">
                {suggestion.label}
              </div>
              {(suggestion.family || suggestion.genus || suggestion.rank || suggestion.status) && (
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  {suggestion.family && (
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                      {suggestion.family}
                    </span>
                  )}
                  {suggestion.genus && (
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                      {suggestion.genus}
                    </span>
                  )}
                  {suggestion.rank && (
                    <span className="text-slate-400">{suggestion.rank}</span>
                  )}
                  {suggestion.status && suggestion.status !== 'Accepted' && (
                    <span className="text-amber-600">{suggestion.status}</span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Autocomplete;
