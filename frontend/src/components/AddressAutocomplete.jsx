import { useState, useRef, useEffect, useCallback } from 'react';
import { searchAddress } from '../services/addressService.js';
import './AddressAutocomplete.css';

/**
 * Canada-first address autocomplete backed by Nominatim.
 * Defaults to Canada only. Toggle "Also search USA" at bottom of dropdown.
 * Minimum 2 characters, 250ms debounce.
 *
 * Props:
 *   value       {string}   - Controlled value shown in input
 *   onChange    {function} - Called with raw text as user types
 *   onSelect    {function} - Called with AddressResult when user picks a suggestion
 *   placeholder {string}   - Input placeholder
 *   id          {string}   - Optional id for the input element
 */
export default function AddressAutocomplete({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Start typing your address…',
  id,
}) {
  const [query,       setQuery]       = useState(value);
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [includeUS,   setIncludeUS]   = useState(false);

  const debounceRef  = useRef(null);
  const abortRef     = useRef(null);
  const includeUSRef = useRef(false);   // always-current ref for runSearch
  const inputRef     = useRef(null);
  const listRef      = useRef(null);

  // Sync controlled value → local query
  useEffect(() => { setQuery(value); }, [value]);

  // ── Search ────────────────────────────────────────────────────────────────
  const runSearch = useCallback((q) => {
    if (abortRef.current) abortRef.current.abort();

    const trimmed = (q || '').trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    abortRef.current = new AbortController();

    searchAddress(trimmed, includeUSRef.current, abortRef.current.signal)
      .then(items => {
        setResults(items);
        setOpen(items.length > 0);
        setHighlighted(-1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Debounced input — 250ms ───────────────────────────────────────────────
  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    onChange?.(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 250);
  }

  // ── USA toggle ────────────────────────────────────────────────────────────
  function handleUSAToggle(e) {
    e.preventDefault();
    const next = !includeUS;
    setIncludeUS(next);
    includeUSRef.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
  }

  // ── Select ────────────────────────────────────────────────────────────────
  function handleSelect(item) {
    setQuery(item.shortName);
    setResults([]);
    setOpen(false);
    setHighlighted(-1);
    onChange?.(item.shortName);
    onSelect?.(item);
  }

  // ── Clear ─────────────────────────────────────────────────────────────────
  function handleClear(e) {
    e.preventDefault();
    setQuery('');
    setResults([]);
    setOpen(false);
    setLoading(false);
    setIncludeUS(false);
    includeUSRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current)    abortRef.current.abort();
    onChange?.('');
    inputRef.current?.focus();
  }

  // ── Keyboard nav ──────────────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (!open || !results.length) return;
    if      (e.key === 'ArrowDown')                   { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp')                     { e.preventDefault(); setHighlighted(h => Math.max(h - 1, -1)); }
    else if (e.key === 'Enter' && highlighted >= 0)   { e.preventDefault(); handleSelect(results[highlighted]); }
    else if (e.key === 'Escape')                      { setOpen(false); setHighlighted(-1); }
  }

  useEffect(() => {
    if (highlighted < 0 || !listRef.current) return;
    listRef.current.children[highlighted]?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current)    abortRef.current.abort();
  }, []);

  return (
    <div className="addr-auto" role="combobox" aria-expanded={open} aria-haspopup="listbox">
      {/* ── Input ── */}
      <div className="addr-auto__input-wrap">
        <svg className="addr-auto__icon-search" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>

        <input
          ref={inputRef}
          id={id}
          type="text"
          className="addr-auto__input"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => { setTimeout(() => setOpen(false), 200); }}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls="addr-auto-list"
        />

        {loading && <span className="addr-auto__spinner" aria-label="Searching…" />}

        {query && !loading && (
          <button className="addr-auto__clear" onMouseDown={handleClear}
                  tabIndex={-1} aria-label="Clear" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Dropdown ── */}
      {open && results.length > 0 && (
        <ul ref={listRef} id="addr-auto-list" className="addr-auto__dropdown"
            role="listbox" aria-label="Address suggestions">
          {results.map((r, i) => {
            // Two-line display: street on primary, city+province+postal+flag on secondary
            const primary   = r.street || r.city || r.shortName;
            const secondary = [r.city, r.province, r.postalCode].filter(Boolean).join(', ')
              + (r.flag ? ' · ' + r.flag : '');

            return (
              <li
                key={`${r.lat},${r.lon}`}
                className={`addr-auto__option${highlighted === i ? ' addr-auto__option--active' : ''}`}
                onMouseDown={e => { e.preventDefault(); handleSelect(r); }}
                onMouseEnter={() => setHighlighted(i)}
                role="option"
                aria-selected={highlighted === i}
              >
                <span className="addr-auto__option-flag" aria-hidden="true">
                  {r.flag}
                </span>
                <div className="addr-auto__option-body">
                  <span className="addr-auto__option-primary">{primary}</span>
                  {secondary && (
                    <span className="addr-auto__option-secondary">{secondary}</span>
                  )}
                </div>
              </li>
            );
          })}

          {/* USA toggle */}
          <li className="addr-auto__usa-row" role="presentation">
            <button
              className={`addr-auto__usa-btn${includeUS ? ' addr-auto__usa-btn--active' : ''}`}
              onMouseDown={handleUSAToggle}
              type="button"
              aria-pressed={includeUS}
            >
              <span>🇺🇸</span>
              {includeUS ? 'US results included — tap to hide' : 'Also search USA'}
            </button>
          </li>

          {/* Nominatim attribution (required by ToS) */}
          <li className="addr-auto__attribution" aria-hidden="true">
            © OpenStreetMap contributors
          </li>
        </ul>
      )}
    </div>
  );
}
