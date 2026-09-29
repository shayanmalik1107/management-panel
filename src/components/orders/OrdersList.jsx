import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Edit2, Trash2, RotateCcw, Store, User, CheckSquare, Square, FileText, Loader2, Download } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { deleteOrder } from '../../services/orderService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportHtmlToPDF, generateSummaryHTML, exportOrderInvoiceToPDF, exportMultipleInvoicesToPDF } from '../../utils/pdfExport';
import OrderReturnModal from './OrderReturnModal';
import FilterPanel from '../common/FilterPanel';
import FlatList from '../common/FlatList';

export default function OrdersList() {
  const { companyId, companyInfo, isAdmin, currentUser, userProfile, hasPermission } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters State
  const [search, setSearch] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedShop, setSelectedShop] = useState('all');
  const [selectedCreatedBy, setSelectedCreatedBy] = useState('all');

  // Multi-Selection State
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [exportingPdfType, setExportingPdfType] = useState(null); // 'checklist' | 'invoice' | orderId | null

  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState(null);

  const currency = companyInfo?.currency || 'Rs';
  const accountDisplayName = userProfile?.name || currentUser?.displayName || companyInfo?.owner || companyInfo?.companyName || companyInfo?.name || 'COMPANY';
  const companyName = companyInfo?.companyName || companyInfo?.name || 'Company';
  const canCreate = hasPermission('createOrders');

  const handleDeleteOrder = async (e, order) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete order ${order.orderNumber}? This will restore product stock and customer balance.`)) {
      return;
    }
    try {
      await deleteOrder(companyId, order.id, order.orderNumber, currentUser?.uid, userProfile?.name);
      toast.success(`Order ${order.orderNumber} deleted successfully`);
    } catch (err) {
      toast.error(err.message || 'Failed to delete order');
    }
  };

  const handleEditOrder = (e, orderId) => {
    e.stopPropagation();
    navigate(`/orders/${orderId}/edit`);
  };

  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const ordersRef = ref(database, `companies/${companyId}/orders`);
    const custsRef = ref(database, `companies/${companyId}/customers`);

    const unsubscribeOrders = onValue(ordersRef, (snapshot) => {
      const allOrders = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          allOrders.push({ id: child.key, ...child.val() });
        });
      }
      // Sort by createdAt descending
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
      console.error('Orders listener error:', err);
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

    return () => {
      unsubscribeOrders();
      unsubscribeCusts();
    };
  }, [companyId, isAdmin, currentUser?.uid]);

  // Dynamic Shop Dropdown Options
  const shopOptions = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      if (o.customerName) map.set(o.customerName, o.customerName);
    });
    const list = Array.from(map.keys()).map(name => ({ value: name, label: name }));
    return [{ value: 'all', label: 'All Shops' }, ...list];
  }, [orders]);

  // Dynamic Created By Dropdown Options
  const createdByOptions = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      if (o.createdByName) map.set(o.createdByName, o.createdByName);
    });
    const list = Array.from(map.keys()).map(name => ({ value: name, label: name }));
    return [{ value: 'all', label: 'All Users' }, ...list];
  }, [orders]);

  const handleResetFilters = () => {
    setSearch('');
    setPaymentModeFilter('');
    setPeriod('');
    setQuickFilter('');
    setStartDate('');
    setEndDate('');
    setSelectedShop('all');
    setSelectedCreatedBy('all');
    setSelectedOrders(new Set());
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      !search ||
      order.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      order.createdByName?.toLowerCase().includes(search.toLowerCase()) ||
      formatDate(order.createdAt).toLowerCase().includes(search.toLowerCase());

    const isCash = order.paymentType === 'cash' || order.paymentStatus === 'paid';
    const matchesPaymentMode =
      !paymentModeFilter ||
      (paymentModeFilter === 'cash' ? isCash : !isCash);

    const matchesShop =
      !selectedShop || selectedShop === 'all' ||
      order.customerName === selectedShop || order.customerId === selectedShop;

    const matchesCreatedBy =
      !selectedCreatedBy || selectedCreatedBy === 'all' ||
      order.createdByName === selectedCreatedBy || order.createdBy === selectedCreatedBy;

    let matchesDate = true;
    if (order.createdAt) {
      const orderDate = new Date(order.createdAt);
      const orderDateStr = orderDate.toISOString().split('T')[0];

      if (startDate && orderDateStr < startDate) matchesDate = false;
      if (endDate && orderDateStr > endDate) matchesDate = false;
    }

    const matchesEmployeeOwner = isAdmin || (order.createdBy === currentUser?.uid || order.createdByName === userProfile?.name);

    return matchesSearch && matchesPaymentMode && matchesShop && matchesCreatedBy && matchesDate && matchesEmployeeOwner;
  });

  // Clear selection when filters change
  useEffect(() => {
    setSelectedOrders(new Set());
  }, [search, paymentModeFilter, selectedShop, selectedCreatedBy, startDate, endDate, period]);

  // Selection handlers
  const toggleOrderSelection = (orderId, event) => {
    if (event) {
      event.stopPropagation();
    }
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

  // Product Summaries Aggregation Logic
  const getProductSummaries = useMemo(() => {
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
        const purchasePrice = Number(item.purchasePrice || item.costPrice || item.cost) || 0;

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

    return Array.from(map.values()).map(summary => ({
      ...summary,
      orderNumbers: Array.from(summary.orderNumbersSet).sort()
    }));
  }, [filteredOrders, selectedOrders]);

  // Export Checklist PDF Handler
  const handleExportChecklistPDF = async () => {
    const summaries = getProductSummaries;
    if (summaries.length === 0) {
      toast.info('No product data available for PDF creation');
      return;
    }

    setExportingPdfType('checklist');
    try {
      let periodLabel = period || 'All Time';
      if (selectedOrders.size > 0) {
        const selectedNums = Array.from(selectedOrders)
          .map(id => filteredOrders.find(o => o.id === id)?.orderNumber)
          .filter(Boolean)
          .join(', ');
        periodLabel = `Selected Orders (${selectedNums})`;
      }

      const html = generateSummaryHTML(summaries, periodLabel, companyName, currency);
      const filename = selectedOrders.size > 0
        ? `checklist-selected-orders-${new Date().toISOString().split('T')[0]}`
        : `checklist-${new Date().toISOString().split('T')[0]}`;

      await exportHtmlToPDF(html, filename);
      toast.success('Checklist PDF downloaded successfully');
    } catch (err) {
      console.error('Error generating checklist PDF:', err);
      toast.error('Failed to export Checklist PDF');
    } finally {
      setExportingPdfType(null);
    }
  };

  const getEnrichedOrder = (order) => {
    const cust = customers.find(c => c.id === order.customerId || c.shopName === order.customerName);
    return {
      ...order,
      customerAddress: order.customerAddress || cust?.address || cust?.shopAddress || '—',
      customerPhone: order.customerPhone || cust?.phone || cust?.mobile || '—',
    };
  };

  // Export Single Order Invoice PDF Handler
  const handleExportSingleOrderInvoice = async (e, order) => {
    e.stopPropagation();
    setExportingPdfType(order.id);
    try {
      const enriched = getEnrichedOrder(order);
      await exportOrderInvoiceToPDF(enriched, accountDisplayName, currency);
      toast.success(`Invoice PDF for ${order.orderNumber} downloaded`);
    } catch (err) {
      console.error('Error exporting order invoice PDF:', err);
      toast.error('Failed to export Invoice PDF');
    } finally {
      setExportingPdfType(null);
    }
  };

  // Export Invoice PDF for Selected Orders (or all filtered if none checked)
  const handleExportInvoicePDF = async () => {
    const ordersToExport = selectedOrders.size > 0
      ? filteredOrders.filter(o => selectedOrders.has(o.id))
      : filteredOrders;

    if (ordersToExport.length === 0) {
      toast.info('No orders to export invoice for');
      return;
    }

    setExportingPdfType('invoice');
    try {
      const enrichedOrders = ordersToExport.map(o => getEnrichedOrder(o));
      await exportMultipleInvoicesToPDF(enrichedOrders, accountDisplayName, currency);
      toast.success(`Exported Invoice PDF for ${ordersToExport.length} order(s)`);
    } catch (err) {
      console.error('Error exporting invoices:', err);
      toast.error('Failed to export Invoice PDF');
    } finally {
      setExportingPdfType(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Orders</h1>
          <p className="text-muted text-sm">Manage your sales orders</p>
        </div>
        <div className="page-header-actions">
          {canCreate && (
            <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
              <Plus size={16} /> New Order
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Order Filters Panel */}
      <FilterPanel
        title="Order Filters"
        subtitle="Filter and analyze orders by date range"
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

      <div className="card">
        {/* Table Toolbar */}
        <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div className="table-toolbar-left" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', flex: 1, alignItems: 'center' }}>
            
            {/* Search Bar */}
            <div className="table-search" style={{ width: 260, minWidth: 200 }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search Shop or Order #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Payment Mode Selector */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: 160 }}
              value={paymentModeFilter}
              onChange={(e) => setPaymentModeFilter(e.target.value)}
            >
              <option value="">All Payment Modes</option>
              <option value="cash">💵 Cash Only</option>
              <option value="credit">💳 Credit Only</option>
            </select>
          </div>

          <div className="table-toolbar-right" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedOrders.size > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs"
                onClick={clearSelection}
                style={{ color: 'var(--gray-600)', border: '1px solid var(--gray-300)' }}
              >
                Clear ({selectedOrders.size})
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleExportChecklistPDF}
              disabled={exportingPdfType === 'checklist' || filteredOrders.length === 0}
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              {exportingPdfType === 'checklist' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {exportingPdfType === 'checklist' ? 'Preparing…' : 'Checklist PDF'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportInvoicePDF}
              disabled={exportingPdfType === 'invoice' || filteredOrders.length === 0}
            >
              {exportingPdfType === 'invoice' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              {exportingPdfType === 'invoice' ? 'Preparing Invoice…' : 'Invoice PDF'}
            </button>
          </div>
        </div>

        <div>
          {loading ? (
            <div className="loading-page">
              <div className="loading-spinner lg"></div>
            </div>
          ) : (
            <FlatList
              data={filteredOrders}
              rowHeight={56}
              maxHeight="calc(100vh - 280px)"
              keyExtractor={(order) => order.id}
              HeaderComponent={() => (
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
                    <th>Date</th>
                    <th>Customer / Shop</th>
                    <th>Order Items</th>
                    {isAdmin && <th>Employee</th>}
                    <th>Total</th>
                    <th>Payment Mode</th>
                    <th style={{ width: 150, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
              )}
              renderItem={(order) => {
                const isCash = order.paymentType === 'cash' || order.paymentStatus === 'paid';
                const itemsList = order.items ? (Array.isArray(order.items) ? order.items : Object.values(order.items)) : [];
                const returnedAmount = Number(order.returnedAmount) || 0;
                const isSelected = selectedOrders.has(order.id);

                return (
                  <>
                    <td style={{ textAlign: 'center', width: 40 }} onClick={(e) => e.stopPropagation()}>
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
                    <td className="table-cell-mono" onClick={() => navigate(`/orders/${order.id}`)}>{order.orderNumber}</td>
                    <td className="text-muted text-sm" onClick={() => navigate(`/orders/${order.id}`)}>{formatDate(order.createdAt)}</td>
                    <td className="table-cell-primary" onClick={() => navigate(`/orders/${order.id}`)}>{order.customerName || '—'}</td>
                    <td onClick={() => navigate(`/orders/${order.id}`)}>
                      {itemsList.length === 0 ? (
                        <span className="text-muted text-xs">—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {itemsList.slice(0, 2).map((it, idx) => (
                            <span key={idx} className="text-xs" style={{ whiteSpace: 'nowrap' }}>
                              <strong>{it.productName}</strong> x {it.quantity}
                              {it.returnedQty > 0 && (
                                <span style={{ color: 'var(--danger-600)', marginLeft: '4px', fontWeight: 600 }}>
                                  ({it.returnedQty} ret)
                                </span>
                              )}
                            </span>
                          ))}
                          {itemsList.length > 2 && (
                            <span className="text-xs text-muted">+{itemsList.length - 2} more...</span>
                          )}
                        </div>
                      )}
                    </td>
                    {isAdmin && <td className="text-sm" onClick={() => navigate(`/orders/${order.id}`)}>{order.createdByName || '—'}</td>}
                    <td onClick={() => navigate(`/orders/${order.id}`)}>
                      <div className="font-medium">{formatCurrency(order.grandTotal, currency)}</div>
                      {returnedAmount > 0 && (
                        <div className="text-xs" style={{ color: 'var(--danger-600)', fontWeight: 500 }}>
                          Net: {formatCurrency(order.grandTotal - returnedAmount, currency)}
                        </div>
                      )}
                    </td>
                    <td onClick={() => navigate(`/orders/${order.id}`)}>
                      <span className={`badge badge-${isCash ? 'green' : 'orange'}`}>
                        <span className="badge-dot" />
                        {isCash ? 'Cash' : 'Credit'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', width: 150 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="Download Invoice PDF"
                          style={{ padding: '4px 6px', color: 'var(--primary-600)' }}
                          disabled={exportingPdfType === order.id}
                          onClick={(e) => handleExportSingleOrderInvoice(e, order)}
                        >
                          {exportingPdfType === order.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <FileText size={15} />
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="Process Return"
                          style={{ padding: '4px 6px', color: 'var(--warning-700)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderForReturn(order);
                          }}
                        >
                          <RotateCcw size={15} />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Edit Order"
                              style={{ padding: '4px 6px' }}
                              onClick={(e) => handleEditOrder(e, order.id)}
                            >
                              <Edit2 size={15} style={{ color: 'var(--primary-600)' }} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Delete Order"
                              style={{ padding: '4px 6px' }}
                              onClick={(e) => handleDeleteOrder(e, order)}
                            >
                              <Trash2 size={15} style={{ color: 'var(--danger-500)' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </>
                );
              }}
              EmptyComponent={() => (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Search size={24} />
                  </div>
                  <h3>No orders found</h3>
                  <p>There are no orders matching your criteria.</p>
                  {canCreate && (
                    <button className="btn btn-primary mt-4" onClick={() => navigate('/orders/new')}>
                      <Plus size={16} /> Create Order
                    </button>
                  )}
                </div>
              )}
            />
          )}
        </div>
      </div>

      {selectedOrderForReturn && (
        <OrderReturnModal
          order={selectedOrderForReturn}
          companyId={companyId}
          currentUser={currentUser}
          userProfile={userProfile}
          currency={currency}
          onClose={() => setSelectedOrderForReturn(null)}
        />
      )}
    </div>
  );
}
