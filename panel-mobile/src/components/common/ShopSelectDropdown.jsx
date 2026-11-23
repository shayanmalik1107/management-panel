import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Store, Check, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function ShopSelectDropdown({
  shops = [],
  value = '',
  onChange,
  placeholder = 'Search or select shop with credit...',
  label = 'Select Shop / Customer with Outstanding Credit *',
  currency = 'Rs',
  required = false
}) {
  const selectedShop = useMemo(() => {
    return shops.find(s => s.id === value) || null;
  }, [shops, value]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // When selected shop changes externally, update display term
  useEffect(() => {
    if (selectedShop) {
      setSearchTerm(selectedShop.shopName || selectedShop.name || '');
    } else if (!value) {
      setSearchTerm('');
    }
  }, [selectedShop, value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        // Reset display search term to selected shop name if valid
        if (selectedShop) {
          setSearchTerm(selectedShop.shopName || selectedShop.name || '');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedShop]);

  // Filter shops matching search term
  const filteredShops = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return shops;
    const term = searchTerm.trim().toLowerCase();
    return shops.filter(s => {
      const name = (s.shopName || s.name || '').toLowerCase();
      const contact = (s.contactPerson || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      const city = (s.city || '').toLowerCase();
      return name.includes(term) || contact.includes(term) || phone.includes(term) || city.includes(term);
    });
  }, [shops, searchTerm]);

  const handleSelectShop = (shop) => {
    if (shop) {
      setSearchTerm(shop.shopName || shop.name || '');
      if (onChange) onChange(shop);
    } else {
      setSearchTerm('');
      if (onChange) onChange(null);
    }
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (!term) {
      if (onChange) onChange(null);
    }
    setIsOpen(true);
  };

  return (
    <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }} ref={containerRef}>
      {label && (
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{label}</span>
          <span className="text-xs text-muted" style={{ fontWeight: 600, color: 'var(--danger-600)' }}>
            {shops.length} shop(s) with active credit
          </span>
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--gray-400)', zIndex: 2 }} />
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          style={{ paddingLeft: 36, paddingRight: 32, fontWeight: 600, color: selectedShop ? 'var(--primary-700)' : 'var(--gray-900)' }}
          placeholder={placeholder}
          value={searchTerm}
          required={required}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={handleInputChange}
        />

        {searchTerm && (
          <button
            type="button"
            onClick={() => handleSelectShop(null)}
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
            title="Clear selection"
          >
            ×
          </button>
        )}

        {/* Floating Custom Search Dropdown */}
        {isOpen && (
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
              maxHeight: 280,
              overflowY: 'auto',
              zIndex: 300,
              padding: '6px'
            }}
          >
            {/* Header Label */}
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
              Shops with Credit ({filteredShops.length})
            </div>

            {/* List of matching shops */}
            {filteredShops.length > 0 ? (
              filteredShops.map((shop) => {
                const isSelected = value === shop.id;
                const creditBal = Number(shop.currentBalance) || 0;
                return (
                  <div
                    key={shop.id}
                    className="search-result-item"
                    onClick={() => handleSelectShop(shop)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--primary-50)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div
                      className="result-icon"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'var(--primary-100)' : 'var(--gray-100)',
                        color: isSelected ? 'var(--primary-600)' : 'var(--gray-600)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Store size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-900)' }}>
                        {shop.shopName || shop.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                        {shop.phone ? `Phone: ${shop.phone}` : ''} {shop.city ? `• ${shop.city}` : ''}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span
                        className="badge badge-red"
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        Credit: {formatCurrency(creditBal, currency)}
                      </span>
                    </div>

                    {isSelected && <Check size={16} style={{ color: 'var(--primary-600)', marginLeft: '4px' }} />}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '14px 10px', fontSize: '13px', color: 'var(--gray-500)', textAlign: 'center' }}>
                {shops.length === 0
                  ? '✓ No shops currently have outstanding credit balances.'
                  : `No credit shop found matching "${searchTerm}"`}
              </div>
            )}
          </div>
        )}
      </div>

      <span className="form-hint" style={{ marginTop: '4px', display: 'block' }}>
        {selectedShop
          ? `Selected: ${selectedShop.shopName || selectedShop.name} — Current Outstanding Credit: ${formatCurrency(selectedShop.currentBalance || 0, currency)}`
          : 'Search by shop name, contact person, or city to select a shop with credit.'}
      </span>
    </div>
  );
}
