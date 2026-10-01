import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ShoppingBag, Plus, Check } from 'lucide-react';

export default function SupplierSelectDropdown({
  suppliers = [],
  value = '',
  onChange,
  placeholder = 'Search or select recorded supplier...',
  label = 'Supplier / Vendor Name *',
  required = false
}) {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [isWriteNewMode, setIsWriteNewMode] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Synchronize internal searchTerm when prop value changes externally
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format supplier list into array of strings
  const formattedSuppliers = useMemo(() => {
    const list = new Set();
    suppliers.forEach(s => {
      const name = typeof s === 'string' ? s : (s.name || s.supplierName);
      if (name && String(name).trim()) {
        list.add(String(name).trim());
      }
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [suppliers]);

  // Filtered suppliers matching search term
  const filteredList = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return formattedSuppliers;
    const term = searchTerm.trim().toLowerCase();
    return formattedSuppliers.filter(name => name.toLowerCase().includes(term));
  }, [formattedSuppliers, searchTerm]);

  const handleSelect = (name) => {
    setSearchTerm(name);
    if (onChange) onChange(name);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setSearchTerm(newVal);
    if (onChange) onChange(newVal);
    if (!isWriteNewMode) setIsOpen(true);
  };

  // Toggle to "Write New Supplier" mode
  const handleToggleWriteNew = () => {
    setIsWriteNewMode(true);
    setSearchTerm('');
    if (onChange) onChange('');
    setIsOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Toggle back to "Select Existing Supplier" mode
  const handleToggleSelectExisting = () => {
    setIsWriteNewMode(false);
    setSearchTerm('');
    if (onChange) onChange('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }} ref={containerRef}>
      {label && (
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{label}</span>
          {!isWriteNewMode ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-primary-600"
              onClick={handleToggleWriteNew}
              style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
            >
              <Plus size={13} /> Add New Supplier
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-primary-600"
              onClick={handleToggleSelectExisting}
              style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
            >
              <ShoppingBag size={13} /> Select Existing Supplier
            </button>
          )}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--gray-400)', zIndex: 2 }} />
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          style={{ paddingLeft: 36, paddingRight: 32, fontWeight: 500 }}
          placeholder={isWriteNewMode ? 'Write new supplier name...' : placeholder}
          value={searchTerm}
          required={required}
          onFocus={() => { if (!isWriteNewMode) setIsOpen(true); }}
          onClick={() => { if (!isWriteNewMode) setIsOpen(true); }}
          onChange={handleInputChange}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              if (onChange) onChange('');
            }}
            style={{
              position: 'absolute',
              right: 10,
              top: 10,
              background: 'transparent',
              border: 'none',
              color: 'var(--gray-400)',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            title="Clear field"
          >
            ×
          </button>
        )}

        {/* Floating Custom Search Dropdown (Shown when selecting existing supplier) */}
        {!isWriteNewMode && isOpen && (
          <div
            className="search-results"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: '#ffffff',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: 260,
              overflowY: 'auto',
              zIndex: 300,
              padding: '6px'
            }}
          >
            {/* Header label */}
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--gray-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '6px 10px',
                borderBottom: '1px solid var(--gray-100)',
                marginBottom: '4px'
              }}
            >
              Recorded Suppliers ({filteredList.length})
            </div>

            {/* List of matching existing suppliers */}
            {filteredList.length > 0 ? (
              filteredList.map((supName) => {
                const isSelected = value === supName;
                return (
                  <div
                    key={supName}
                    className="search-result-item"
                    onClick={() => handleSelect(supName)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--primary-50)' : 'transparent',
                      color: isSelected ? 'var(--primary-700)' : 'var(--gray-800)',
                      fontWeight: isSelected ? 600 : 400
                    }}
                  >
                    <div
                      className="result-icon"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'var(--primary-100)' : 'var(--gray-100)',
                        color: isSelected ? 'var(--primary-600)' : 'var(--gray-500)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <ShoppingBag size={14} />
                    </div>
                    <div style={{ flex: 1, fontSize: '13px' }}>{supName}</div>
                    {isSelected && <Check size={14} style={{ color: 'var(--primary-600)' }} />}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '12px 10px', fontSize: '13px', color: 'var(--gray-500)', textAlign: 'center' }}>
                No recorded supplier matching "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </div>

      <span className="form-hint" style={{ marginTop: '4px', display: 'block' }}>
        {isWriteNewMode
          ? '✏️ Writing new supplier name. Will be saved to database.'
          : '🔍 Select a recorded supplier from dropdown or click "+ Add New Supplier" to write a new one.'}
      </span>
    </div>
  );
}
