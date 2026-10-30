// Employee Dashboard — Simplified view
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatNumber, formatDate, getLocalDateString } from '../../utils/formatters';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../utils/constants';
import { ShoppingCart, Plus, TrendingUp, Clock, Users, Store, CreditCard, Calendar, X } from 'lucide-react';
import WhatsAppButton from '../common/WhatsAppButton';
import { getOutboxItems, getCachedCollection } from '../../services/offlineStorage';

export default function EmployeeDashboard() {
  const { companyId, companyInfo, userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Filter state: 'today' | 'week' | 'month' | 'custom'
  const [filterMode, setFilterMode] = useState('today');
  const [customDate, setCustomDate] = useState('');

  const [stats, setStats] = useState({
    myOrdersCount: 0,
    mySalesTotal: 0,
    pendingOrders: 0,
    customersAdded: 0,
    paymentsReceived: 0,
    totalCreditLeft: 0,
    periodLabel: 'Today',
    cardSuffix: 'Today',
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const currency = companyInfo?.currency || 'Rs';

  // Cached real-time data
  const latestOrdersRef = useRef([]);
  const latestPaymentsRef = useRef([]);
  const latestCustomersRef = useRef([]);

  // Compute active date range timestamps
  const getActiveRange = useCallback(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    if (filterMode === 'today') {
      return {
        start: startOfToday,
        end: endOfToday,
        label: 'Today',
        cardSuffix: 'Today',
      };
    }

    if (filterMode === 'week') {
      // Last 7 days (including today)
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime();
      return {
        start: startOfWeek,
        end: endOfToday,
        label: 'This Week',
        cardSuffix: '(This Week)',
      };
    }

    if (filterMode === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      return {
        start: startOfMonth,
        end: endOfToday,
        label: 'This Month',
        cardSuffix: '(This Month)',
      };
    }

    if (filterMode === 'custom' && customDate) {
      const [sYear, sMonth, sDay] = customDate.split('-').map(Number);
      const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0).getTime();
      const end = new Date(sYear, sMonth - 1, sDay, 23, 59, 59, 999).getTime();
      const formattedDate = formatDate(start);
      return {
        start,
        end,
        label: formattedDate,
        cardSuffix: `(${formattedDate})`,
      };
    }

    return {
      start: startOfToday,
      end: endOfToday,
      label: 'Today',
      cardSuffix: 'Today',
    };
  }, [filterMode, customDate]);

  // Recalculate stats based on current filter and cached data
  const recalculate = useCallback(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const userName = userProfile?.name;
    const currentRange = getActiveRange();

    const latestOrders = latestOrdersRef.current;
    const latestPayments = latestPaymentsRef.current;
    const latestCustomers = latestCustomersRef.current;

    // Filter orders specific to this employee
    const myOrders = latestOrders.filter(order =>
      order && (
        order.employeeId === uid ||
        order.createdBy === uid ||
        (userName && (order.createdByName === userName || order.employeeName === userName))
      )
    );

    // Orders placed in the selected period
    const rangeOrders = myOrders.filter(o =>
      o.createdAt && o.createdAt >= currentRange.start && o.createdAt <= currentRange.end
    );
    const activeInPeriod = rangeOrders.filter(o => o.status !== 'cancelled' && o.status !== 'returned');
    const pendingInPeriod = rangeOrders.filter(o => o.status === 'pending' || o.status === 'draft');

    // Customer IDs this employee has placed orders for
    const myCustomerIds = new Set(myOrders.map(o => o.customerId).filter(Boolean));

    // Payments received in the selected period by this employee or for employee's customers
    let paymentsReceived = 0;
    latestPayments.forEach(val => {
      if (val && val.createdAt && val.createdAt >= currentRange.start && val.createdAt <= currentRange.end) {
        if (val.type !== 'supplier_payment') {
          const isMyPayment =
            val.createdBy === uid ||
            (userName && (val.createdByName === userName || val.employeeName === userName)) ||
            (val.customerId && myCustomerIds.has(val.customerId));
          if (isMyPayment) {
            paymentsReceived += (val.amount || 0);
          }
        }
      }
    });

    // Customers added by employee & specific customer credit left owed to this employee's shops
    let customersAdded = 0;
    let totalCreditLeft = 0;
    latestCustomers.forEach(val => {
      if (val) {
        const isCreatedByMe =
          val.createdBy === uid ||
          (userName && (val.createdByName === userName || val.createdByUserName === userName));
        const isMyCustomer = isCreatedByMe || myCustomerIds.has(val.id);

        // Count customers added in the selected period
        if (isCreatedByMe && val.createdAt && val.createdAt >= currentRange.start && val.createdAt <= currentRange.end) {
          customersAdded++;
        }
        // Total outstanding credit left for this employee's shops
        if (isMyCustomer) {
          totalCreditLeft += Number(val.currentBalance ?? val.balance ?? val.dueAmount ?? 0) || 0;
        }
      }
    });

    setStats({
      myOrdersCount: activeInPeriod.length,
      mySalesTotal: activeInPeriod.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
      pendingOrders: pendingInPeriod.length,
      customersAdded,
      paymentsReceived,
      totalCreditLeft,
      periodLabel: currentRange.label,
      cardSuffix: currentRange.cardSuffix,
    });

    setRecentOrders(rangeOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    setLoading(false);
  }, [currentUser, userProfile?.name, getActiveRange]);

  // Setup real-time listeners
  useEffect(() => {
    if (!companyId || !currentUser) return;

    setLoading(true);

    const loadOfflineLocalData = async () => {
      try {
        const outbox = await getOutboxItems(companyId);
        const cached = await getCachedCollection(companyId, 'orders');
        const pending = outbox
          .filter(i => i.actionType === 'create_order' && i.payload?.order)
          .map(i => ({ ...i.payload.order, id: i.payload.orderId || i.payload.order.id, isPendingSync: true }));

        const map = new Map();
        cached.forEach(o => map.set(o.id || o.orderNumber, o));
        pending.forEach(o => map.set(o.id || o.orderNumber, o));
        const merged = Array.from(map.values());
        if (merged.length > 0) {
          latestOrdersRef.current = merged;
          recalculate();
        }

        const cachedCusts = await getCachedCollection(companyId, 'customers');
        if (cachedCusts.length > 0) {
          latestCustomersRef.current = cachedCusts;
          recalculate();
        }
      } catch (_) {}
    };

    loadOfflineLocalData();

    const unsubs = [];

    const ordersUnsub = onValue(ref(database, `companies/${companyId}/orders`), (snap) => {
      const list = [];
      if (snap.exists()) {
        snap.forEach(child => list.push({ id: child.key, ...child.val() }));
      }

      getOutboxItems(companyId).then((outbox) => {
        const pending = outbox
          .filter(i => i.actionType === 'create_order' && i.payload?.order)
          .map(i => ({ ...i.payload.order, id: i.payload.orderId || i.payload.order.id, isPendingSync: true }));

        const map = new Map();
        list.forEach(o => map.set(o.id || o.orderNumber, o));
        pending.forEach(o => map.set(o.id || o.orderNumber, o));
        latestOrdersRef.current = Array.from(map.values());
        recalculate();
      }).catch(() => {
        latestOrdersRef.current = list;
        recalculate();
      });
    }, (err) => {
      console.warn('Employee dashboard offline orders (using cached):', err);
      loadOfflineLocalData();
      setLoading(false);
    });
    unsubs.push(ordersUnsub);

    const paymentsUnsub = onValue(ref(database, `companies/${companyId}/payments`), (snap) => {
      const list = [];
      if (snap.exists()) {
        snap.forEach(child => list.push({ id: child.key, ...child.val() }));
      }
      latestPaymentsRef.current = list;
      recalculate();
    }, (err) => {
      console.error('Employee dashboard payments error:', err);
    });
    unsubs.push(paymentsUnsub);

    const customersUnsub = onValue(ref(database, `companies/${companyId}/customers`), (snap) => {
      const list = [];
      if (snap.exists()) {
        snap.forEach(child => list.push({ id: child.key, ...child.val() }));
      }
      latestCustomersRef.current = list;
      recalculate();
    }, (err) => {
      console.error('Employee dashboard customers error:', err);
    });
    unsubs.push(customersUnsub);

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [companyId, currentUser?.uid, recalculate]);

  // Re-run recalculate whenever the date filter selection changes
  useEffect(() => {
    recalculate();
  }, [filterMode, customDate, recalculate]);

  const handleFilterSelect = (mode) => {
    setFilterMode(mode);
    if (mode !== 'custom') {
      setCustomDate('');
    }
  };

  const handleCalendarChange = (e) => {
    const val = e.target.value;
    const todayStr = getLocalDateString();
    if (!val || val === todayStr) {
      setFilterMode('today');
      setCustomDate('');
    } else {
      setFilterMode('custom');
      setCustomDate(val);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p className="text-muted text-sm">Hello, {userProfile?.name}! Ready to get to work.</p>
        </div>
        <div className="page-header-actions" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {/* Quick Date Filters + Calendar Selector */}
          <div className="date-filter-group">
            <div className="date-range-selector">
              <button
                type="button"
                className={`date-range-option ${filterMode === 'today' ? 'active' : ''}`}
                onClick={() => handleFilterSelect('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={`date-range-option ${filterMode === 'week' ? 'active' : ''}`}
                onClick={() => handleFilterSelect('week')}
              >
                This Week
              </button>
              <button
                type="button"
                className={`date-range-option ${filterMode === 'month' ? 'active' : ''}`}
                onClick={() => handleFilterSelect('month')}
              >
                This Month
              </button>
            </div>

            {/* Calendar Date Picker */}
            <div className={`calendar-filter-box ${filterMode === 'custom' ? 'active' : ''}`} title="Select specific date">
              <Calendar size={14} style={{ color: filterMode === 'custom' ? 'var(--primary-600)' : 'var(--gray-500)', flexShrink: 0 }} />
              <input
                type="date"
                className="calendar-date-input"
                value={filterMode === 'today' ? getLocalDateString() : (filterMode === 'custom' ? customDate : '')}
                onChange={handleCalendarChange}
                title="Select date from calendar"
              />
              {filterMode === 'custom' && (
                <button
                  type="button"
                  className="calendar-clear-btn"
                  onClick={() => handleFilterSelect('today')}
                  title="Reset to Today"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <WhatsAppButton variant="header" userRole="Employee" />
          <button className="btn btn-secondary btn-lg" onClick={() => navigate('/customers/new')}>
            <Store size={18} /> Add Shop
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/orders/new')}>
            <Plus size={18} /> Create Order
          </button>
        </div>
      </div>

      {/* Main Action */}
      <div
        onClick={() => navigate('/orders/new')}
        style={{
          background: 'linear-gradient(135deg, var(--primary-600), var(--primary-700))',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          color: 'white',
          cursor: 'pointer',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'transform 0.2s',
        }}
      >
        <div>
          <h2 style={{ color: 'white', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-2xl)' }}>
            + Create New Order
          </h2>
          <p style={{ opacity: 0.8, fontSize: 'var(--font-size-base)' }}>
            Select a shop, add products, and submit your order
          </p>
        </div>
        <ShoppingCart size={48} style={{ opacity: 0.3 }} />
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">My Orders {stats.cardSuffix}</span>
            <div className="stat-card-icon blue"><ShoppingCart size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : stats.myOrdersCount}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">My Sales {stats.cardSuffix}</span>
            <div className="stat-card-icon green"><TrendingUp size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : formatCurrency(stats.mySalesTotal, currency)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Payment Received {stats.cardSuffix}</span>
            <div className="stat-card-icon green"><CreditCard size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : formatCurrency(stats.paymentsReceived, currency)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Credit Left</span>
            <div className="stat-card-icon orange"><Store size={18} /></div>
          </div>
          <div className="stat-card-value" style={{ color: stats.totalCreditLeft > 0 ? 'var(--warning-600)' : 'inherit' }}>
            {loading ? '...' : formatCurrency(stats.totalCreditLeft, currency)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Pending Orders</span>
            <div className="stat-card-icon orange"><Clock size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : stats.pendingOrders}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Customers Added</span>
            <div className="stat-card-icon purple"><Users size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : stats.customersAdded}</div>
        </div>
      </div>

      {/* Orders for Selected Period */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">
            My Orders — {stats.periodLabel} {recentOrders.length > 0 && `(${recentOrders.length})`}
          </span>
          <button className="btn btn-link btn-sm" onClick={() => navigate('/orders')}>View all</button>
        </div>
        <div className="table-container">
          {recentOrders.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/orders/${order.id}`)}>
                    <td className="table-cell-mono">
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>{order.orderNumber}</span>
                        {order.isPendingSync && (
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                            ⏳ Offline
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-muted text-sm">{formatDate(order.createdAt)}</td>
                    <td className="table-cell-primary">{order.customerName || '—'}</td>
                    <td>{formatCurrency(order.grandTotal, currency)}</td>
                    <td>
                      <span className={`badge badge-${ORDER_STATUS_COLORS[order.status] || 'gray'}`}>
                        <span className="badge-dot" />
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <ShoppingCart size={24} />
              </div>
              <h3>No orders for {stats.periodLabel.toLowerCase()}</h3>
              <p>Create an order or select a different date range to view sales.</p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', marginTop: 'var(--space-3)' }}>
                {filterMode !== 'today' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleFilterSelect('today')}>
                    Back to Today
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/orders/new')}>
                  <Plus size={16} /> Create Order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
