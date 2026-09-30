import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Phone, Mail, MapPin, Receipt, ShoppingCart, CreditCard } from 'lucide-react';
import { getCustomer } from '../../services/customerService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId, companyInfo, hasPermission, isAdmin, currentUser, userProfile } = useAuth();
  const toast = useToast();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const currency = companyInfo?.currency || 'Rs';
  const canEdit = hasPermission('editCustomers');
  const canViewBalance = hasPermission('viewCustomerBalance');

  useEffect(() => {
    if (!companyId || !id) return;
    loadCustomer();
  }, [companyId, id]);

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

  if (loading) {
    return <div className="loading-page"><div className="loading-spinner lg"></div></div>;
  }

  if (!customer) return null;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/customers')}>
              <ArrowLeft size={14} /> Back to Customers
            </button>
          </div>
          <h1>{customer.shopName}</h1>
          <p className="text-muted text-sm">Customer since {formatDate(customer.createdAt)}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/orders/new')}>
            <ShoppingCart size={16} /> New Order
          </button>
          {canViewBalance && (
            <button className="btn btn-secondary" onClick={() => navigate('/payments/new')}>
              <CreditCard size={16} /> Receive Payment
            </button>
          )}
          {canEdit && (
            <button className="btn btn-primary" onClick={() => navigate(`/customers/new?edit=${id}`)} >
              <Edit size={16} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid-2col-responsive">
        
        {/* Contact Info Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Contact Information</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {customer.shopName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{customer.contactPerson || 'No contact person'}</div>
                  <div className="text-sm text-muted">Primary Contact</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {customer.phone && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <Phone size={16} style={{ color: 'var(--gray-400)', marginTop: 2 }} />
                    <span className="text-sm">{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <Mail size={16} style={{ color: 'var(--gray-400)', marginTop: 2 }} />
                    <span className="text-sm">{customer.email}</span>
                  </div>
                )}
                {(customer.address || customer.city) && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <MapPin size={16} style={{ color: 'var(--gray-400)', marginTop: 2 }} />
                    <span className="text-sm">
                      {customer.address && <div>{customer.address}</div>}
                      {customer.area && <div>{customer.area}</div>}
                      {customer.city && <div>{customer.city}</div>}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {customer.notes && (
            <div className="card">
              <div className="card-header"><span className="card-title">Notes</span></div>
              <div className="card-body text-sm" style={{ whiteSpace: 'pre-wrap', color: 'var(--gray-700)' }}>
                {customer.notes}
              </div>
            </div>
          )}
        </div>

        {/* Stats and History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <div className="stat-cards grid-3col-responsive">
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Total Orders</span>
                <div className="stat-card-icon blue"><ShoppingCart size={18} /></div>
              </div>
              <div className="stat-card-value">{customer.totalOrders || 0}</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Total Sales</span>
                <div className="stat-card-icon green"><Receipt size={18} /></div>
              </div>
              <div className="stat-card-value">{formatCurrency(customer.totalSales || 0, currency)}</div>
            </div>

            {canViewBalance && (
              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-label">Outstanding Balance</span>
                  <div className="stat-card-icon orange"><CreditCard size={18} /></div>
                </div>
                <div className="stat-card-value" style={{ color: customer.currentBalance > 0 ? 'var(--warning-600)' : 'inherit' }}>
                  {formatCurrency(customer.currentBalance || 0, currency)}
                </div>
                {customer.creditLimit > 0 && (
                  <div className="text-xs text-muted mt-1">Limit: {formatCurrency(customer.creditLimit, currency)}</div>
                )}
              </div>
            )}
          </div>
          
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Orders</span>
              <button className="btn btn-link btn-sm" onClick={() => navigate('/orders')}>View all</button>
            </div>
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <ShoppingCart size={24} style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }} />
              <p className="text-sm text-muted">Use the Orders tab to view this customer's full order history.</p>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
