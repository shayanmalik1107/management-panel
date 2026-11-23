import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Search, Download, Filter, Store, CreditCard } from 'lucide-react';
import { getOrders } from '../../services/orderService';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import FilterPanel from '../common/FilterPanel';

export default function SalesPage() {
  const { companyId, companyInfo } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters State
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [selectedShop, setSelectedShop] = useState('all');
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const currency = companyInfo?.currency || 'Rs';

  useEffect(() => {
    if (!companyId) return;
    loadSales();
  }, [companyId]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const allOrders = await getOrders(companyId);
      const salesOrders = allOrders.filter(o => o.status !== 'draft' && o.status !== 'cancelled');
      setSales(salesOrders);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Dynamic Shop Options
  const shopOptions = useMemo(() => {
    const map = new Map();
    sales.forEach(s => {
      if (s.customerName) map.set(s.customerName, s.customerName);
    });
    const list = Array.from(map.keys()).map(name => ({ value: name, label: name }));
    return [{ value: 'all', label: 'All Shops' }, ...list];
  }, [sales]);

  const handleResetFilters = () => {
    setSearch('');
    setPaymentModeFilter('');
    setSelectedShop('all');
    setPeriod('');
    setQuickFilter('');
    setStartDate('');
    setEndDate('');
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch =
      !search ||
      s.orderNumber?.toLowerCase().includes(search.toLowerCase()) || 
      s.customerName?.toLowerCase().includes(search.toLowerCase());

    const isCash = s.paymentType === 'cash' || s.paymentStatus === 'paid';
    const matchesPaymentMode =
      !paymentModeFilter ||
      (paymentModeFilter === 'cash' ? isCash : !isCash);

    const matchesShop =
      !selectedShop || selectedShop === 'all' ||
      s.customerName === selectedShop;

    let matchesDate = true;
    if (s.createdAt) {
      const saleDateStr = new Date(s.createdAt).toISOString().split('T')[0];
      if (startDate && saleDateStr < startDate) matchesDate = false;
      if (endDate && saleDateStr > endDate) matchesDate = false;
    }

    return matchesSearch && matchesPaymentMode && matchesShop && matchesDate;
  });

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Sales Ledger</h1>
          <p className="text-muted text-sm">Financial overview of your sales and revenue</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
            New Sale (Order)
          </button>
        </div>
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: '1fr', maxWidth: 360, marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Sales Revenue</span>
            <div className="stat-card-icon blue"><TrendingUp size={18} /></div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalRevenue, currency)}</div>
        </div>
      </div>

      {/* Collapsible Sales Filters Panel */}
      <FilterPanel
        title="Sales Filters"
        subtitle="Filter and analyze sales revenue by date range & shop"
        icon={Filter}
        period={period}
        setPeriod={setPeriod}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        dropdown1Label="Shop / Customer"
        dropdown1Value={selectedShop}
        setDropdown1Value={setSelectedShop}
        dropdown1Options={shopOptions}
        dropdown1Icon={Store}
        dropdown2Label="Payment Mode"
        dropdown2Value={paymentModeFilter}
        setDropdown2Value={setPaymentModeFilter}
        dropdown2Options={[
          { value: '', label: 'All Payment Modes' },
          { value: 'cash', label: 'Cash Only' },
          { value: 'credit', label: 'Credit Only' }
        ]}
        dropdown2Icon={CreditCard}
        onReset={handleResetFilters}
      />

      <div className="card">
        <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div className="table-toolbar-left" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', flex: 1 }}>
            <div className="table-search" style={{ minWidth: 240, maxWidth: 360 }}>
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search by Shop name or Order #..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-toolbar-right">
            <button className="btn btn-secondary btn-sm">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading-page">
              <div className="loading-spinner lg"></div>
            </div>
          ) : filteredSales.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Subtotal</th>
                  <th>Discount</th>
                  <th>Grand Total</th>
                  <th>Payment Mode</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(sale => {
                  const isCash = sale.paymentType === 'cash' || sale.paymentStatus === 'paid';
                  return (
                    <tr 
                      key={sale.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/orders/${sale.id}`)}
                    >
                      <td className="text-sm text-muted">{formatDate(sale.createdAt)}</td>
                      <td className="table-cell-mono">{sale.orderNumber}</td>
                      <td className="font-medium">{sale.customerName || '—'}</td>
                      <td>{formatCurrency(sale.subtotal, currency)}</td>
                      <td className="text-danger-600">{sale.discount > 0 ? `${sale.discount}%` : '0%'}</td>
                      <td className="font-semibold text-primary-600">{formatCurrency(sale.grandTotal, currency)}</td>
                      <td>
                        <span className={`badge badge-${isCash ? 'green' : 'orange'}`}>
                          <span className="badge-dot" />
                          {isCash ? 'Cash' : 'Credit'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <TrendingUp size={24} />
              </div>
              <h3>No sales data found</h3>
              <p>Confirmed and delivered orders will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
