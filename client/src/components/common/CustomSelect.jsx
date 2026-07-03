import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const CustomSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  loading = false,
  className = '',
  error = false,
  size = 'md',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });

  const selected = options.find((o) => !o.isGroupHeader && String(o.value) === String(value));

  const filtered = search
    ? options.filter((o) => {
        if (o.isGroupHeader) return false;
        const haystack = `${o.label || ''} ${o.badge || ''}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
    : options;

  const selectableFiltered = filtered.filter((o) => !o.isGroupHeader);

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const dropdownMaxH = 280;
    const spaceBelow = viewportH - r.bottom;
    const placeBottom = spaceBelow >= 220; // enough room for most lists/search
    const placement = placeBottom ? 'bottom' : 'top';
    const top = placement === 'bottom' ? r.bottom + 6 : Math.max(8, r.top - 6 - dropdownMaxH);
    setPos({ top, left: r.left, width: r.width, placement });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inTrigger = ref.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inTrigger && !inDropdown) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open && listRef.current && selected) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [open, selected]);

  const handleSelect = (opt) => {
    onChange(opt.value);
    close();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && selectableFiltered.length === 1) {
      handleSelect(selectableFiltered[0]);
    }
  };

  const showSearch = options.filter((o) => !o.isGroupHeader).length > 6;

  const sizeClasses = {
    sm: 'py-1.5 px-2.5 text-xs',
    md: 'py-2 px-3 text-sm',
    lg: 'py-2.5 px-3 text-base',
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setOpen(!open)}
        disabled={disabled || loading}
        ref={triggerRef}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white transition-all duration-150 ${
          sizeClasses[size] || sizeClasses.md
        } ${
          open
            ? 'border-primary-400 ring-2 ring-primary-100 shadow-sm'
            : error
              ? 'border-red-400 hover:border-red-500'
              : 'border-gray-300 hover:border-gray-400'
        } ${
          disabled || loading ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {loading ? (
          <span className="flex items-center gap-2 text-gray-400">
            <svg className="w-3.5 h-3.5 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Loading...
          </span>
        ) : (
          <span className={`truncate ${selected ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            {selected ? selected.label : placeholder}
          </span>
        )}
        <svg
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[80] bg-white border border-gray-200 rounded-xl shadow-xl shadow-gray-200/60 overflow-hidden animate-in fade-in"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: 280,
            }}
          >
            {/* Search */}
            {showSearch && (
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={searchRef}
                    type="text"
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-all"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              </div>
            )}

            {/* Options list */}
            <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: showSearch ? '220px' : '260px' }}>
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  No results found
                </div>
              ) : (
                filtered.map((opt) => {
                  if (opt.isGroupHeader) {
                    return (
                      <div
                        key={opt.value}
                        className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100 select-none"
                      >
                        {opt.label}
                      </div>
                    );
                  }
                  const isActive = String(opt.value) === String(value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      data-active={isActive}
                      onClick={() => handleSelect(opt)}
                      className={`w-full flex items-center px-3 py-2 text-sm text-left transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={`ml-0 text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                              opt.badgeClass || 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {isActive && (
                        <svg className="w-4 h-4 text-primary-600 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CustomSelect;
