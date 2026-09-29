import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Download, Filter, DollarSign, TrendingUp, Package, CheckSquare, Square, Loader2, FileText, Store, User } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportHtmlToPDF, generateSummaryHTML, exportOrderInvoiceToPDF, exportMultipleInvoicesToPDF } from '../../utils/pdfExport';
import FilterPanel from '../common/FilterPanel';

export default function ReportsPage() {
  const { companyId, companyInfo, isAdmin, currentUser, userProfile } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedShop, setSelectedShop] = useState('all');
  const [selectedCreatedBy, setSelectedCreatedBy] = useState('all');

  // Multi-select state
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [exportingType, setExportingType] = useState(null);

  const currency = companyInfo?.currency || 'Rs';
  const accountDisplayName = userProfile?.name || currentUser?.displayName || companyInfo?.owner || companyInfo?.companyName || companyInfo?.name || 'COMPANY';
  const companyName = companyInfo?.companyName || companyInfo?.name || 'Company';

  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const ordersRef = ref(database, `companies/${companyId}/orders`);
    const custsRef = ref(database, `companies/${companyId}/customers`);
    const expensesRef = ref(database, `companies/${companyId}/expenses`);

    const unsubscribeOrders = onValue(ordersRef, (snapshot) => {
      const allOrders = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          allOrders.push({ id: child.key, ...child.val() });
        });
      }
      allOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (!isAdmin) {
        setOrders(allOrders.filter(
          o => o.employeeId === currentUser?.uid || o.createdBy === currentUser?.uid
        ));
      } else {
        setOrders(allOrders);
      }
      setLoading(false);
    }, (err) => {
      console.error('Reports orders listener error:', err);
      setLoading(false);
    });

    const unsubscribeCusts = onValue(custsRef, (snapshot) => {
      const allCusts = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          allCusts.push({ id: child.key, ...child.val() });
        });
      }
      setCustomers(allCusts);
    });

    const unsubscribeExpenses = onValue(expensesRef, (snapshot) => {
      const allExpenses = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          allExpenses.push({ id: child.key, ...child.val() });
        });
      }
      setExpenses(allExpenses);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCusts();
      unsubscribeExpenses();
    };
  }, [companyId, isAdmin, currentUser?.uid]);

  // Shop Options
  const shopOptions = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      if (o.customerName) map.set(o.customerName, o.customerName);
    });
    return [{ value: 'all', label: 'All Shops' }, ...Array.from(map.keys()).map(name => ({ value: name, label: name }))];
  }, [orders]);

  // Created By Options
  const createdByOptions = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      if (o.createdByName) map.set(o.createdByName, o.createdByName);
    });
    return [{ value: 'all', label: 'All Users' }, ...Array.from(map.keys()).map(name => ({ value: name, label: name }))];
  }, [orders]);

  const handleResetFilters = () => {
    setPeriod('');
    setQuickFilter('');
    setStartDate('');
    setEndDate('');
    setSelectedShop('all');
    setSelectedCreatedBy('all');
    setSelectedOrders(new Set());
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Exclude cancelled and returned orders to match Dashboard logic
      if (order.status === 'cancelled' || order.status === 'returned') return false;

      const matchesShop =
        !selectedShop || selectedShop === 'all' ||
        order.customerName === selectedShop || order.customerId === selectedShop;

      const matchesCreatedBy =
        !selectedCreatedBy || selectedCreatedBy === 'all' ||
        order.createdByName === selectedCreatedBy || order.createdBy === selectedCreatedBy;

      let matchesDate = true;
      if (order.createdAt) {
        const orderDateStr = new Date(order.createdAt).toISOString().split('T')[0];
        if (startDate && orderDateStr < startDate) matchesDate = false;
        if (endDate && orderDateStr > endDate) matchesDate = false;
      }

      return matchesShop && matchesCreatedBy && matchesDate;
    });
  }, [orders, selectedShop, selectedCreatedBy, startDate, endDate]);

  useEffect(() => {
    setSelectedOrders(new Set());
  }, [selectedShop, selectedCreatedBy, startDate, endDate, period]);

  const toggleOrderSelection = (orderId, event) => {
    if (event) event.stopPropagation();
    setSelectedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  // Aggregated Product Summaries
  const productSummaries = useMemo(() => {
    const ordersToProcess = selectedOrders.size > 0
      ? filteredOrders.filter(o => selectedOrders.has(o.id))
      : filteredOrders;

    const map = new Map();

    ordersToProcess.forEach(order => {
      const rawItems = order.items
        ? (Array.isArray(order.items) ? order.items : Object.values(order.items))
        : [];
      const discountPct = Number(order.discount) || 0;

      rawItems.forEach(item => {
        const pId = item.productId || item.productName || 'unknown';
        const pName = item.productName || 'Unnamed Product';
        const qty = Number(item.quantity) || 0;
        const returnedQty = Number(item.returnedQty || item.returnedQuantity) || 0;
        const orderedQty = qty;
        const salePrice = Number(item.salePrice || item.unitPrice || item.price) || 0;
        const purchasePrice = Number(item.costPriceAtSale ?? item.purchasePrice ?? item.costPrice ?? item.cost) || 0;

        const effectivePrice = salePrice * (1 - (discountPct / 100));
        const orderedValue = orderedQty * effectivePrice;
        const revenue = (qty - returnedQty) * effectivePrice;
        const profit = revenue - ((qty - returnedQty) * purchasePrice);

        const existing = map.get(pId);
        if (existing) {
          existing.totalOrderedQuantity += orderedQty;
          existing.totalOrderedValue += orderedValue;
          existing.totalReturnedQuantity += returnedQty;
          existing.totalRevenue += revenue;
          existing.totalProfit += profit;
          existing.totalQuantitySold += (qty - returnedQty);
          if (order.orderNumber) existing.orderNumbersSet.add(order.orderNumber);
        } else {
          const orderNumbersSet = new Set();
          if (order.orderNumber) orderNumbersSet.add(order.orderNumber);
          map.set(pId, {
            productId: pId,
            productName: pName,
            categoryName: item.categoryName || '',
            totalOrderedQuantity: orderedQty,
            totalOrderedValue: orderedValue,
            totalReturnedQuantity: returnedQty,
            totalQuantitySold: (qty - returnedQty),
            totalRevenue: revenue,
            totalProfit: profit,
            orderNumbersSet
          });
        }
      });
    });

    return Array.from(map.values()).map(s => ({
      ...s,
      orderNumbers: Array.from(s.orderNumbersSet).sort()
    }));
  }, [filteredOrders, selectedOrders]);

  const totalOverheadExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => {
      if (!e || !e.amount) return sum;
      let matchesDate = true;
      if (e.createdAt) {
        const expDateStr = new Date(e.createdAt).toISOString().split('T')[0];
        if (startDate && expDateStr < startDate) matchesDate = false;
        if (endDate && expDateStr > endDate) matchesDate = false;
      }
      return matchesDate ? sum + (Number(e.amount) || 0) : sum;
    }, 0);
  }, [expenses, startDate, endDate]);

  const totalRevenue = productSummaries.reduce((sum, s) => sum + s.totalRevenue, 0);
  const grossProfit = productSummaries.reduce((sum, s) => sum + s.totalProfit, 0);
  const totalProfit = grossProfit - totalOverheadExpenses;
  const totalUnitsSold = productSummaries.reduce((sum, s) => sum + s.totalQuantitySold, 0);

  const handleExportChecklistPDF = async () => {
    if (productSummaries.length === 0) {
      toast.info('No product summary data available for PDF export');
      return;
    }

    setExportingType('checklist');
    try {
      let periodLabel = period || 'All Time';
      if (selectedOrders.size > 0) {
        const selectedNums = Array.from(selectedOrders)
          .map(id => filteredOrders.find(o => o.id === id)?.orderNumber)
          .filter(Boolean)
          .join(', ');
        periodLabel = `Selected Orders (${selectedNums})`;
      }

      const html = generateSummaryHTML(productSummaries, periodLabel, companyName, currency);
      const filename = selectedOrders.size > 0
        ? `checklist-selected-orders-${new Date().toISOString().split('T')[0]}`
        : `checklist-${new Date().toISOString().split('T')[0]}`;

      await exportHtmlToPDF(html, filename);
      toast.success('Checklist PDF downloaded successfully');
    } catch (err) {
      console.error('Checklist PDF Export Error:', err);
      toast.error('Failed to export Checklist PDF');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportInvoicePDF = async () => {
    const ordersToExport = selectedOrders.size > 0
      ? filteredOrders.filter(o => selectedOrders.has(o.id))
      : filteredOrders;

    if (ordersToExport.length === 0) {
      toast.info('No orders to export invoice for');
      return;
    }

    setExportingType('invoice');
    try {
      const enrichedOrders = ordersToExport.map(order => {
        const matchCust = customers.find(c => c.id === order.customerId || c.shopName === order.customerName);
        return {
          ...order,
          customerAddress: order.customerAddress || matchCust?.address || matchCust?.shopAddress || '—',
          customerPhone: order.customerPhone || matchCust?.phone || matchCust?.mobile || '—',
        };
      });
      await exportMultipleInvoicesToPDF(enrichedOrders, accountDisplayName, currency);
      toast.success(`Exported Invoice PDF for ${ordersToExport.length} order(s)`);
    } catch (err) {
      console.error('Invoice PDF Export Error:', err);
      toast.error('Failed to export Invoice PDF');
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Product Reports & Checklist</h1>
          <p className="text-muted text-sm">Analyze product performance and generate fulfillment checklist or invoice PDFs</p>
        </div>
      </div>

      {/* Collapsible Filter Panel */}
      <FilterPanel
        title="Report Filters"
        subtitle="Filter sales summaries and checklists by date range"
        icon={Filter}
        period={period}
        setPeriod={setPeriod}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        dropdown1Label="Shop"
        dropdown1Value={selectedShop}
        setDropdown1Value={setSelectedShop}
        dropdown1Options={shopOptions}
        dropdown1Icon={Store}
        dropdown2Label="Created By"
        dropdown2Value={selectedCreatedBy}
        setDropdown2Value={setSelectedCreatedBy}
        dropdown2Options={createdByOptions}
        dropdown2Icon={User}
        onReset={handleResetFilters}
      />

      {/* Metrics Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-600)' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div className="text-xs text-muted font-medium">Total Revenue</div>
              <div className="text-xl font-bold">{formatCurrency(totalRevenue, currency)}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-600)' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="text-xs text-muted font-medium">Total Profit</div>
              <div className="text-xl font-bold" style={{ color: totalProfit >= 0 ? 'var(--success-600)' : 'var(--danger-600)' }}>
                {formatCurrency(totalProfit, currency)}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#9333ea' }}>
              <Package size={20} />
            </div>
            <div>
              <div className="text-xs text-muted font-medium">Units Sold</div>
              <div className="text-xl font-bold">{totalUnitsSold.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#ea580c' }}>
              <BarChart3 size={20} />
            </div>
            <div>
              <div className="text-xs text-muted font-medium">Products Listed</div>
              <div className="text-xl font-bold">{productSummaries.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Summary & Order Selection Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h3 style={{ margin: 0 }}>Product Performance Summary</h3>
            <p className="text-xs text-muted" style={{ margin: 0 }}>
              {selectedOrders.size > 0 ? `Showing data for ${selectedOrders.size} selected order(s)` : `Showing data across ${filteredOrders.length} order(s)`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedOrders.size > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs"
                onClick={clearSelection}
                style={{ color: 'var(--gray-600)', border: '1px solid var(--gray-300)' }}
              >
                Clear Selection ({selectedOrders.size})
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleExportChecklistPDF}
              disabled={exportingType === 'checklist' || productSummaries.length === 0}
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              {exportingType === 'checklist' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {exportingType === 'checklist' ? 'Preparing…' : 'Checklist PDF'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportInvoicePDF}
              disabled={exportingType === 'invoice' || filteredOrders.length === 0}
            >
              {exportingType === 'invoice' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              {exportingType === 'invoice' ? 'Preparing Invoice…' : 'Invoice PDF'}
            </button>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading-page">
              <div className="loading-spinner lg"></div>
            </div>
          ) : filteredOrders.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectAll();
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title={selectedOrders.size === filteredOrders.length ? 'Deselect All' : 'Select All'}
                    >
                      {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0 ? (
                        <CheckSquare size={18} style={{ color: 'var(--primary-600)' }} />
                      ) : (
                        <Square size={18} style={{ color: 'var(--gray-400)' }} />
                      )}
                    </button>
                  </th>
                  <th>Order #</th>
                  <th>Shop</th>
                  <th>Date</th>
                  <th>Items Summary</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const itemsList = order.items ? (Array.isArray(order.items) ? order.items : Object.values(order.items)) : [];
                  const isSelected = selectedOrders.has(order.id);

                  return (
                    <tr
                      key={order.id}
                      style={{ cursor: 'pointer', backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined }}
                      onClick={(e) => toggleOrderSelection(order.id, e)}
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => toggleOrderSelection(order.id, e)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: 4 }}
                        >
                          {isSelected ? (
                            <CheckSquare size={18} style={{ color: 'var(--primary-600)' }} />
                          ) : (
                            <Square size={18} style={{ color: 'var(--gray-400)' }} />
                          )}
                        </button>
                      </td>
                      <td className="table-cell-mono">{order.orderNumber}</td>
                      <td className="table-cell-primary">{order.customerName || '—'}</td>
                      <td className="text-muted text-sm">{formatDate(order.createdAt)}</td>
                      <td className="text-sm">
                        {itemsList.map(it => `${it.productName} (x${it.quantity})`).join(', ')}
                      </td>
                      <td className="font-medium">{formatCurrency(order.grandTotal, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <h3>No orders found</h3>
              <p>There are no orders matching your filter criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
