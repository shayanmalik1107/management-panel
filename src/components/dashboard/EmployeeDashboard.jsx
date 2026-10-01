// Employee Dashboard — Simplified view
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { getDateRange, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../utils/constants';
import { ShoppingCart, Plus, TrendingUp, Clock, Users, Store, CreditCard } from 'lucide-react';


export default function EmployeeDashboard() {
  const { companyId, companyInfo, userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    myOrdersToday: 0,
    mySalesToday: 0,
    pendingOrders: 0,
    customersAdded: 0,
    paymentsReceivedToday: 0,
    totalCreditLeft: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const currency = companyInfo?.currency || 'Rs';

  useEffect(() => {
    if (!companyId || !currentUser) return;
    loadEmployeeData();
  }, [companyId, currentUser]);

  const loadEmployeeData = async () => {
    setLoading(true);
    try {
      const today = getDateRange('today');
      const uid = currentUser.uid;

      // Load orders
      const ordersRef = ref(database, `companies/${companyId}/orders`);
      const ordersSnap = await get(ordersRef);
      const myOrders = [];

      if (ordersSnap.exists()) {
        ordersSnap.forEach((child) => {
          const val = child.val();
          if (val) {
            const order = { id: child.key, ...val };
            if (order.employeeId === uid || order.createdBy === uid) {
              myOrders.push(order);
            }
          }
        });
      }

      const todayOrders = myOrders.filter(o => o.createdAt && o.createdAt >= today.start && o.createdAt <= today.end);
      const activeToday = todayOrders.filter(o => o.status !== 'cancelled' && o.status !== 'returned');
      const pending = myOrders.filter(o => o.status === 'pending' || o.status === 'draft');

      // Load payments
      const paymentsRef = ref(database, `companies/${companyId}/payments`);
      const paymentsSnap = await get(paymentsRef);
      let paymentsReceivedToday = 0;
      if (paymentsSnap.exists()) {
        paymentsSnap.forEach((child) => {
          const val = child.val();
          if (val && val.createdAt && val.createdAt >= today.start && val.createdAt <= today.end) {
            if (val.type !== 'supplier_payment') {
              paymentsReceivedToday += (val.amount || 0);
            }
          }
        });
      }

      // Load customers added by employee & total shop credit
      const customersRef = ref(database, `companies/${companyId}/customers`);
      const customersSnap = await get(customersRef);
      let customersAdded = 0;
      let totalCreditLeft = 0;
      if (customersSnap.exists()) {
        customersSnap.forEach((child) => {
          const val = child.val();
          if (val) {
            if (val.createdBy === uid) customersAdded++;
            totalCreditLeft += (Number(val.currentBalance) || 0);
          }
        });
      }

      setStats({
        myOrdersToday: activeToday.length,
        mySalesToday: activeToday.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
        pendingOrders: pending.length,
        customersAdded,
        paymentsReceivedToday,
        totalCreditLeft,
      });

      setRecentOrders(myOrders.sort((a, b) => b.createdAt - a.createdAt).slice(0, 10));
    } catch (err) {
      console.error('Employee dashboard error:', err);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p className="text-muted text-sm">Hello, {userProfile?.name}! Ready to get to work.</p>
        </div>
        <div className="page-header-actions">
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
            <span className="stat-card-label">My Orders Today</span>
            <div className="stat-card-icon blue"><ShoppingCart size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : stats.myOrdersToday}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">My Sales Today</span>
            <div className="stat-card-icon green"><TrendingUp size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : formatCurrency(stats.mySalesToday, currency)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Payment Received (Today)</span>
            <div className="stat-card-icon green"><CreditCard size={18} /></div>
          </div>
          <div className="stat-card-value">{loading ? '...' : formatCurrency(stats.paymentsReceivedToday, currency)}</div>
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

      {/* Recent Orders */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">My Recent Orders</span>
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
                    <td className="table-cell-mono">{order.orderNumber}</td>
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
              <h3>No orders yet</h3>
              <p>Create your first order to start tracking sales.</p>
              <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
                <Plus size={16} /> Create Order
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
