import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Phone, Mail, MapPin, Receipt, ShoppingCart, CreditCard, ChevronRight } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { getCustomer, deleteCustomer } from '../../services/customerService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId, companyInfo, hasPermission, isAdmin, currentUser, userProfile } = useAuth();
  const toast = useToast();
  
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const currency = companyInfo?.currency || 'Rs';
  const canEdit = hasPermission('editCustomers');
  const canDelete = hasPermission('deleteCustomers') || isAdmin;
  const canViewBalance = hasPermission('viewCustomerBalance');

  useEffect(() => {
    if (!companyId || !id) return;
    loadCustomer();
  }, [companyId, id]);

  useEffect(() => {
    if (!companyId || !id) return;

    const ordersRef = ref(database, `companies/${companyId}/orders`);
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const custOrders = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();
          if (val.customerId === id || (val.customerName && customer && val.customerName.toLowerCase() === customer.shopName.toLowerCase())) {
            custOrders.push({ id: child.key, ...val });
          }
        });
      }
      custOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(custOrders);
    });

    return () => unsubscribe();
  }, [companyId, id, customer?.shopName]);

  const loadCustomer = async () => {
    setLoading(true);
    try {
      const data = await getCustomer(companyId, id);
      if (!data) {
        toast.error('Customer not found');
        navigate('/customers');
        return;
      }
      if (!isAdmin && data.createdBy && data.createdBy !== currentUser?.uid && data.createdByName !== userProfile?.name) {
        toast.error('You do not have access to view this customer');
        navigate('/customers');
        return;
      }
      setCustomer(data);
    } catch (err) {
      toast.error('Failed to load customer details');
    }
    setLoading(false);
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    if (window.confirm(`Are you sure you want to delete shop "${customer.shopName}"? This action cannot be undone.`)) {
      try {
        await deleteCustomer(companyId, id, customer.shopName, currentUser?.uid, userProfile?.name);
        toast.success(`Shop "${customer.shopName}" deleted successfully`);
        navigate('/customers');
      } catch (err) {
        toast.error('Failed to delete shop');
      }
    }
  };

  if (loading) {
    return <div className="loading-page"><div className="loading-spinner lg"></div></div>;
  }

  if (!customer) return null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header Section */}
      <div className="page-header" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/customers')} style={{ paddingLeft: 0 }}>
              <ArrowLeft size={14} /> Back to Customers
            </button>
          </div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginTop: 'var(--space-1)' }}>
            {customer.shopName}
          </h1>
          <p className="text-muted text-sm">
            Customer since {formatDate(customer.createdAt)}
          </p>
        </div>
        <div className="page-header-actions" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/orders/new')}>
            <ShoppingCart size={16} /> New Order
          </button>
          {canViewBalance && (
            <button className="btn btn-secondary" onClick={() => navigate('/payments/customer-new')}>
              <CreditCard size={16} /> Receive Payment
            </button>
          )}
          {canEdit && (
            <button className="btn btn-primary" onClick={() => navigate(`/customers/${id}/edit`)}>
              <Edit size={16} /> Edit Profile
            </button>
          )}
          {canDelete && (
            <button
              className="btn btn-outline"
              onClick={handleDeleteCustomer}
              style={{ color: 'var(--danger-600)', borderColor: 'var(--danger-200)', background: 'white' }}
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Responsive 2-column layout on Desktop, 1-column on Mobile */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'var(--space-6)',
        alignItems: 'start'
      }}>
        
        {/* Left Column: Contact & Details Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          
          <div className="card">
            <div className="card-header">
              <span className="card-title">Contact Information</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--primary-100)',
                  color: 'var(--primary-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  flexShrink: 0
                }}>
                  {customer.shopName ? customer.shopName.substring(0, 2).toUpperCase() : 'SH'}
                </div>
                <div>
                  <div className="font-medium" style={{ fontSize: '15px' }}>
                    {customer.contactPerson || 'No contact person'}
                  </div>
                  <div className="text-sm text-muted">Primary Contact</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {customer.phone && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    <Phone size={16} style={{ color: 'var(--gray-500)', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div className="text-xs text-muted">Phone</div>
                      <a href={`tel:${customer.phone}`} className="text-sm font-medium" style={{ color: 'var(--primary-600)' }}>
                        {customer.phone}
                      </a>
                    </div>
                  </div>
                )}
                {customer.email && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    <Mail size={16} style={{ color: 'var(--gray-500)', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div className="text-xs text-muted">Email</div>
                      <span className="text-sm">{customer.email}</span>
                    </div>
                  </div>
                )}
                {(customer.address || customer.city || customer.area) && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    <MapPin size={16} style={{ color: 'var(--gray-500)', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div className="text-xs text-muted">Location / Address</div>
                      <div className="text-sm" style={{ lineHeight: 1.4 }}>
                        {customer.address && <div>{customer.address}</div>}
                        {customer.area && <div className="text-xs text-muted">{customer.area}</div>}
                        {customer.city && <div className="text-xs text-muted">{customer.city}</div>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {customer.notes && (
            <div className="card">
              <div className="card-header"><span className="card-title">Notes</span></div>
              <div className="card-body text-sm" style={{ whiteSpace: 'pre-wrap', color: 'var(--gray-700)', lineHeight: 1.5 }}>
                {customer.notes}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Key Metrics & Recent Orders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          {/* Key Stat Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'var(--space-3)'
          }}>
            <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
              <div className="stat-card-header">
                <span className="stat-card-label">Total Orders</span>
                <div className="stat-card-icon blue"><ShoppingCart size={18} /></div>
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
                {orders.length > 0 ? orders.length : (customer.totalOrders || 0)}
              </div>
            </div>
            
            <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
              <div className="stat-card-header">
                <span className="stat-card-label">Total Sales</span>
                <div className="stat-card-icon green"><Receipt size={18} /></div>
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>
                {formatCurrency(
                  orders.length > 0
                    ? orders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0)
                    : (customer.totalSales || 0),
                  currency
                )}
              </div>
            </div>

            {canViewBalance && (
              <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
                <div className="stat-card-header">
                  <span className="stat-card-label">Outstanding Balance</span>
                  <div className="stat-card-icon orange"><CreditCard size={18} /></div>
                </div>
                <div className="stat-card-value" style={{ fontSize: '1.25rem', color: customer.currentBalance > 0 ? 'var(--warning-600)' : 'inherit' }}>
                  {formatCurrency(customer.currentBalance || 0, currency)}
                </div>
              </div>
            )}
          </div>
          
          {/* Recent Orders List */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Recent Orders ({orders.length})</span>
              <button className="btn btn-link btn-sm" onClick={() => navigate('/orders')}>
                View all orders <ChevronRight size={14} />
              </button>
            </div>
            
            {orders.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <ShoppingCart size={28} style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }} />
                <h4 style={{ margin: 0, fontWeight: 600 }}>No orders recorded yet</h4>
                <p className="text-sm text-muted">Create the first order for this shop to view history here.</p>
                <button className="btn btn-primary btn-sm mt-3" onClick={() => navigate('/orders/new')}>
                  <ShoppingCart size={14} /> Create Order
                </button>
              </div>
            ) : (
              <div className="table-scroll-wrapper">
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 10).map((order) => {
                      const isCash = order.paymentType === 'cash' || order.paymentStatus === 'paid';
                      return (
                        <tr
                          key={order.id}
                          onClick={() => navigate(`/orders/${order.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="font-medium table-cell-mono">{order.orderNumber}</td>
                          <td className="text-sm text-muted">{formatDate(order.createdAt)}</td>
                          <td className="font-medium">{formatCurrency(order.grandTotal, currency)}</td>
                          <td>
                            <span className={`badge badge-${isCash ? 'green' : 'orange'}`}>
                              {isCash ? 'Cash' : 'Credit'}
                            </span>
                          </td>
                          <td className="text-sm text-muted">
                            <ChevronRight size={16} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
        </div>

      </div>
    </div>
  );
}
