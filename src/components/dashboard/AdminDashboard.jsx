import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatNumber, formatDate, timeAgo } from '../../utils/formatters';
import { getDateRange, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../../utils/constants';
import {
  DollarSign, CreditCard, ShoppingCart, Receipt, ShoppingBag, TrendingUp,
  AlertTriangle, Package, Plus, ArrowUpRight, RefreshCw, Users, Store
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import OnboardingChecklist from '../onboarding/OnboardingChecklist';
import { setupCompany } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';

export default function AdminDashboard() {
  const { companyId, companyInfo, currentUser, userProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  
  const isSetupMode = location.pathname === '/setup' || !companyId || new URLSearchParams(location.search).get('setup') === 'true';

  // Setup Company State
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupForm, setSetupForm] = useState({ companyName: '', phone: '' });
  const [dateRange, setDateRange] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSales: 0, paymentsReceived: 0, totalOrders: 0,
    totalExpenses: 0, totalPurchases: 0, netProfit: 0,
    outstanding: 0, lowStockCount: 0,
    paymentsMade: 0, outstandingPayable: 0,
    totalCustomerCreditLeft: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);

  const currency = companyInfo?.currency || 'Rs';

  useEffect(() => {
    if (!companyId) return;
    const range = getDateRange(dateRange);
    
    setLoading(true);

    // All active unsubscribers
    const unsubs = [];

    // Shared mutable state for cross-listener calculations
    let latestOrders = [];
    let latestPayments = [];
    let latestExpenses = [];
    let latestPurchases = [];
    let latestProducts = [];
    let latestActivities = [];
    let latestCustomers = [];
    let debugSnapCount = -1;

    const recalculate = () => {
      const currentRange = getDateRange(dateRange);
      const rangeOrders = latestOrders.filter(o => o && o.createdAt && o.createdAt >= currentRange.start && o.createdAt <= currentRange.end + 5000);
      const activeOrders = rangeOrders.filter(o => o.status !== 'cancelled' && o.status !== 'returned');

      const totalSales = activeOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
      const totalPaid = activeOrders.reduce((s, o) => s + (o.amountPaid || 0), 0);
      const outstanding = totalSales - totalPaid;

      let paymentsReceived = 0;
      let paymentsMade = 0;
      latestPayments.forEach(p => {
        if (p && p.createdAt && p.createdAt >= currentRange.start && p.createdAt <= currentRange.end) {
          if (p.type === 'supplier_payment') paymentsMade += p.amount || 0;
          else paymentsReceived += p.amount || 0;
        }
      });

      let totalExpenses = 0;
      latestExpenses.forEach(e => {
        if (e && e.createdAt && e.createdAt >= currentRange.start && e.createdAt <= currentRange.end) totalExpenses += e.amount || 0;
      });

      let totalPurchases = 0;
      latestPurchases.forEach(p => {
        if (p && p.createdAt && p.createdAt >= currentRange.start && p.createdAt <= currentRange.end) totalPurchases += p.grandTotal || 0;
      });

      let lowStockCount = 0;
      const productSales = {};
      latestProducts.forEach(p => {
        if (p && p.currentStock <= (p.minimumStock || 0)) lowStockCount++;
      });

      let totalCustomerCreditLeft = 0;
      latestCustomers.forEach(c => {
        if (c) totalCustomerCreditLeft += Number(c.currentBalance) || 0;
      });

      let cogs = 0;
      activeOrders.forEach(order => {
        if (order && order.items) {
          Object.values(order.items).forEach(item => {
            if (!item) return;
            cogs += (item.costPriceAtSale || 0) * (item.quantity || 0);
            const pid = item.productId || 'unknown';
            if (!productSales[pid]) productSales[pid] = { name: item.productName || 'Unnamed', total: 0, qty: 0 };
            productSales[pid].total += item.lineTotal || 0;
            productSales[pid].qty += item.quantity || 0;
          });
        }
      });
      const netProfit = totalSales - cogs - totalExpenses;

      const topProds = Object.values(productSales).sort((a, b) => b.total - a.total).slice(0, 5);

      const customerSales = {};
      activeOrders.forEach(order => {
        const cid = order.customerId;
        if (cid) {
          if (!customerSales[cid]) customerSales[cid] = { name: order.customerName || 'Unknown', total: 0, orders: 0 };
          customerSales[cid].total += order.grandTotal || 0;
          customerSales[cid].orders++;
        }
      });
      const topCusts = Object.values(customerSales).sort((a, b) => b.total - a.total).slice(0, 5);

      const dayMap = {};
      activeOrders.forEach(o => {
        if (!o || !o.createdAt) return;
        const d = new Date(o.createdAt);
        if (isNaN(d.getTime())) return;
        const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        if (!dayMap[day]) dayMap[day] = { name: day, sales: 0, orders: 0 };
        dayMap[day].sales += o.grandTotal || 0;
        dayMap[day].orders++;
      });
      const chartArr = Object.values(dayMap).slice(-14);

      const recent = [...latestOrders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
      const outstandingPayable = totalPurchases - paymentsMade;

      setStats({ totalSales, paymentsReceived, totalOrders: activeOrders.length, totalExpenses, totalPurchases, netProfit, outstanding, lowStockCount, paymentsMade, outstandingPayable, totalCustomerCreditLeft, rawOrdersCount: latestOrders.length, rawOrders: latestOrders.map(o => o.orderNumber).join(', '), snapCount: debugSnapCount });
      setRecentOrders(recent);
      setChartData(chartArr);
      setTopProducts(topProds);
      setTopCustomers(topCusts);
      setLoading(false);
    };

    // Orders listener
    const ordersUnsub = onValue(ref(database, `companies/${companyId}/orders`), (snap) => {
      latestOrders = [];
      if (snap.exists()) {
        snap.forEach(c => { latestOrders.push({ id: c.key, ...c.val() }); });
      }
      recalculate();
    });
    unsubs.push(ordersUnsub);

    // Payments listener
    const paymentsUnsub = onValue(ref(database, `companies/${companyId}/payments`), (snap) => {
      latestPayments = [];
      if (snap.exists()) {
        snap.forEach(c => { latestPayments.push({ id: c.key, ...c.val() }); });
      }
      recalculate();
    });
    unsubs.push(paymentsUnsub);

    // Expenses listener
    const expensesUnsub = onValue(ref(database, `companies/${companyId}/expenses`), (snap) => {
      latestExpenses = [];
      if (snap.exists()) {
        snap.forEach(c => { latestExpenses.push({ id: c.key, ...c.val() }); });
      }
      recalculate();
    });
    unsubs.push(expensesUnsub);

    // Purchases listener
    const purchasesUnsub = onValue(ref(database, `companies/${companyId}/purchases`), (snap) => {
      latestPurchases = [];
      if (snap.exists()) {
        snap.forEach(c => { latestPurchases.push({ id: c.key, ...c.val() }); });
      }
      recalculate();
    });
    unsubs.push(purchasesUnsub);

    // Products listener
    const productsUnsub = onValue(ref(database, `companies/${companyId}/products`), (snap) => {
      latestProducts = [];
      if (snap.exists()) {
        snap.forEach(c => { latestProducts.push({ id: c.key, ...c.val() }); });
      }
      recalculate();
    });
    unsubs.push(productsUnsub);

    // Customers listener
    const customersUnsub = onValue(ref(database, `companies/${companyId}/customers`), (snap) => {
      latestCustomers = [];
      if (snap.exists()) {
        snap.forEach(c => { latestCustomers.push({ id: c.key, ...c.val() }); });
      }
      recalculate();
    });
    unsubs.push(customersUnsub);

    // Activities listener
    const activitiesUnsub = onValue(ref(database, `companies/${companyId}/activities`), (snap) => {
      latestActivities = [];
      if (snap.exists()) {
        snap.forEach(c => { latestActivities.push({ id: c.key, ...c.val() }); });
      }
      latestActivities.sort((a, b) => b.timestamp - a.timestamp);
      setRecentActivity(latestActivities.slice(0, 10));
    });
    unsubs.push(activitiesUnsub);

    return () => unsubs.forEach(u => u());
  }, [companyId, dateRange]);

  const handleSetupCompany = async (e) => {
    e.preventDefault();
    if (!setupForm.companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    setIsSettingUp(true);
    try {
      const result = await setupCompany(
        setupForm.companyName, 
        currentUser.uid, 
        userProfile.email, 
        userProfile.name, 
        setupForm.phone
      );
      toast.success('Company created successfully! Awaiting system approval.');
      sessionStorage.clear();
      navigate('/select-company');
    } catch (err) {
      toast.error(err.message || 'Failed to setup company');
      setIsSettingUp(false);
    }
  };

  const dateRangeOptions = [
    { label: 'Today', value: 'today' },
    { label: '7 Days', value: '7days' },
    { label: '30 Days', value: '30days' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'This Year', value: 'this_year' },
    { label: 'All Time', value: 'all' },
  ];

  if (isSetupMode) {
    const maxComp = userProfile?.maxCompanies || userProfile?.package?.maxCompanies || 1;
    const ownedCount = stats.snapCount >= 0 ? stats.ownedCount : (companyId ? 1 : 0);
    const isLimitReached = companyId && ownedCount >= maxComp;

    if (isLimitReached) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--gray-50)',
          padding: 'var(--space-4)',
        }}>
          <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
            <div style={{
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              border: 'var(--border)',
              boxShadow: 'var(--shadow-md)',
              padding: 'var(--space-8)',
            }}>
              <div className="auth-logo-icon" style={{ margin: '0 auto var(--space-4)', background: '#fee2e2', color: '#ef4444', display: 'inline-flex' }}>
                <Plus size={24} />
              </div>
              <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)', color: '#0f172a' }}>
                Company Limit Reached
              </h2>
              <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
                Your current plan allows up to <strong>{maxComp} Company Workspace(s)</strong> ({ownedCount}/{maxComp} created). Upgrade to Pro Plan to add more companies!
              </p>

              <button
                className="btn btn-primary btn-block btn-lg"
                onClick={() => navigate('/select-package')}
                style={{ background: '#2563eb' }}
              >
                Upgrade Plan to Add Companies
              </button>

              <button
                className="btn btn-ghost btn-block"
                style={{ marginTop: 'var(--space-3)' }}
                onClick={() => navigate('/dashboard')}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gray-50)',
        padding: 'var(--space-4)',
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            border: 'var(--border)',
            boxShadow: 'var(--shadow-md)',
            padding: 'var(--space-8)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div className="auth-logo-icon" style={{ margin: '0 auto var(--space-4)', display: 'inline-flex' }}>
                <Plus size={24} />
              </div>
              <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
                {companyId ? 'Add New Company' : 'Setup Your Company'}
              </h2>
              <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                {companyId ? 'Create another workspace for a different business' : 'Create a workspace for your business to get started'}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSetupCompany}>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter your business name"
                  value={setupForm.companyName}
                  onChange={(e) => setSetupForm({ ...setupForm, companyName: e.target.value })}
                  disabled={isSettingUp}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Business Phone <span style={{ color: 'var(--gray-400)', fontSize: 'var(--font-size-xs)' }}>(optional)</span></label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="Contact number"
                  value={setupForm.phone}
                  onChange={(e) => setSetupForm({ ...setupForm, phone: e.target.value })}
                  disabled={isSettingUp}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={isSettingUp}>
                {isSettingUp ? <span className="loading-spinner" /> : (companyId ? 'Create & Switch to Company' : 'Create Company Workspace')}
              </button>

              {companyId && (
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  style={{ marginTop: 'var(--space-2)' }}
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Onboarding */}
      <OnboardingChecklist />

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p className="text-muted text-sm">Welcome back! Here's your business overview.</p>
        </div>
        <div className="page-header-actions">
          <div className="date-range-selector">
            {dateRangeOptions.map((opt) => (
              <button
                key={opt.value}
                className={`date-range-option ${dateRange === opt.value ? 'active' : ''}`}
                onClick={() => setDateRange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => { const v = dateRange; setDateRange(''); setTimeout(() => setDateRange(v), 10); }} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
            <Plus size={16} /> New Order
          </button>
        </div>
      </div>

      {/* Sales & Accounts Receivable Section */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gray-800)', marginBottom: 'var(--space-3)' }}>Sales & Accounts Receivable</h3>
      <div className="stat-cards" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Sales</span>
            <div className="stat-card-icon blue"><DollarSign size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : formatCurrency(stats.totalSales, currency)}</div>
          <div className="text-xs text-muted mt-1">{stats.totalOrders} active orders</div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/ledger')}>
          <div className="stat-card-header">
            <span className="stat-card-label">Payment Received</span>
            <div className="stat-card-icon green"><CreditCard size={18} /></div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--success-600)' }}>
            {loading ? '...' : formatCurrency(stats.paymentsReceived, currency)}
          </div>
          <div className="text-xs text-muted mt-1">Received in selected period</div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/customers')}>
          <div className="stat-card-header">
            <span className="stat-card-label">Credit Left</span>
            <div className="stat-card-icon orange"><Store size={18} /></div>
          </div>
          <div className="stat-card-value" style={{ color: stats.totalCustomerCreditLeft > 0 ? 'var(--warning-600)' : 'inherit' }}>
            {loading ? '...' : formatCurrency(stats.totalCustomerCreditLeft, currency)}
          </div>
          <div className="text-xs text-muted mt-1">Total outstanding shop credit</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Orders</span>
            <div className="stat-card-icon purple"><ShoppingBag size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : stats.totalOrders}</div>
        </div>
      </div>

      {/* Purchases & Accounts Payable Section */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gray-800)', marginBottom: 'var(--space-3)' }}>Purchases & Accounts Payable</h3>
      <div className="stat-cards" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Purchases</span>
            <div className="stat-card-icon blue"><ShoppingCart size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : formatCurrency(stats.totalPurchases, currency)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Payments Made</span>
            <div className="stat-card-icon green"><CreditCard size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : formatCurrency(stats.paymentsMade, currency)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Outstanding Payable</span>
            <div className="stat-card-icon orange"><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-card-value" style={{ color: stats.outstandingPayable > 0 ? 'var(--danger-600)' : 'inherit' }}>
            {loading ? '...' : formatCurrency(stats.outstandingPayable, currency)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Low Stock Warnings</span>
            <div className="stat-card-icon red"><Package size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : `${stats.lowStockCount} Products`}</div>
        </div>
      </div>

      {/* Profitability & Expenses Section */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gray-800)', marginBottom: 'var(--space-3)' }}>Profitability & Overhead</h3>
      <div className="stat-cards" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Net Profit</span>
            <div className="stat-card-icon green"><TrendingUp size={18} /></div>
          </div>
          <div className="stat-card-value" style={{ color: stats.netProfit >= 0 ? 'var(--success-600)' : 'var(--danger-600)' }}>
            {loading ? '...' : formatCurrency(stats.netProfit, currency)}
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Overhead Expenses</span>
            <div className="stat-card-icon red"><Receipt size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : formatCurrency(stats.totalExpenses, currency)}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <span className="chart-card-title">Sales Trend</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
                <Area type="monotone" dataKey="sales" stroke="#6366F1" strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)' }}>
              No sales data for this period
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <span className="chart-card-title">Orders Trend</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
                <Bar dataKey="orders" fill="#818CF8" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)' }}>
              No order data for this period
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders + Top Sections */}
      <div className="grid-2col-equal" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Orders</span>
            <button className="btn btn-link btn-sm" onClick={() => navigate('/orders')}>View all</button>
          </div>
          <div className="table-container">
            {recentOrders.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/orders/${order.id}`)}>
                      <td className="table-cell-mono">{order.orderNumber}</td>
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
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <p className="text-muted text-sm">No orders yet</p>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/orders/new')}>
                  <Plus size={14} /> Create Order
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top Products + Customers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Top Products</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {topProducts.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={i}>
                        <td className="table-cell-primary">{p.name}</td>
                        <td>{formatNumber(p.qty)}</td>
                        <td>{formatCurrency(p.total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)' }}>
                  No product data yet
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Top Customers</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {topCustomers.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Orders</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c, i) => (
                      <tr key={i}>
                        <td className="table-cell-primary">{c.name}</td>
                        <td>{c.orders}</td>
                        <td>{formatCurrency(c.total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)' }}>
                  No customer data yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Activity</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {recentActivity.length > 0 ? (
            <div>
              {recentActivity.map((act) => (
                <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '10px 20px', borderBottom: '1px solid var(--gray-50)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-400)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--gray-700)' }}>{act.action}</span>
                  <span style={{ fontSize: '11px', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>{timeAgo(act.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)' }}>
              No activity yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
