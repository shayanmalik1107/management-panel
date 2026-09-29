import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createCustomer, getCustomer, updateCustomer } from '../../services/customerService';

export default function CustomerForm() {
  const { id } = useParams(); // undefined if creating
  const isEditing = Boolean(id);
  
  const { companyId, currentUser, userProfile, hasPermission } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  
  const [form, setForm] = useState({
    shopName: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    if (!companyId) return;
    if (!hasPermission('createCustomers') && !isEditing) {
      toast.error('You do not have permission to add customers');
      navigate('/customers');
      return;
    }
    
    if (isEditing) {
      loadCustomer();
    }
  }, [companyId, id]);

  const loadCustomer = async () => {
    try {
      const cust = await getCustomer(companyId, id);
      if (cust) {
        setForm({
          shopName: cust.shopName || '',
          phone: cust.phone || '',
          email: cust.email || '',
          address: cust.address || '',
          notes: cust.notes || ''
        });
      }
    } catch (err) {
      toast.error('Failed to load customer');
    }
    setInitialLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.shopName.trim()) {
      toast.error('Shop / Company name is required');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    if (!form.address.trim()) {
      toast.error('Address is required');
      return;
    }
    
    setLoading(true);
    try {
      if (isEditing) {
        await updateCustomer(companyId, id, form, currentUser.uid, userProfile.name);
        toast.success('Customer updated successfully');
        navigate(`/customers/${id}`);
      } else {
        const newId = await createCustomer(companyId, form, currentUser.uid, userProfile.name);
        toast.success('Customer created successfully');
        navigate(`/customers/${newId}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save customer');
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div className="loading-page"><div className="loading-spinner lg"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/customers')}>
              <ArrowLeft size={14} /> Back to Customers
            </button>
          </div>
          <h1>{isEditing ? 'Edit Shop / Customer' : 'Add New Shop / Customer'}</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : <Save size={16} />}
            {isEditing ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 800 }}>
        <form className="card-body form-grid" onSubmit={handleSubmit}>
          
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', borderBottom: 'var(--border)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              Shop / Company Information
            </h3>
          </div>

          {/* Shop / Company Name * */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Shop / Company Name *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Downtown Retailers"
              value={form.shopName}
              onChange={e => setForm({...form, shopName: e.target.value})}
              autoFocus
            />
          </div>

          {/* Phone Number * */}
          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <input 
              type="tel" 
              className="form-input" 
              placeholder="e.g. 03001234567"
              value={form.phone}
              onChange={e => setForm({...form, phone: e.target.value})}
            />
          </div>

          {/* Email (Optional) */}
          <div className="form-group">
            <label className="form-label">Email <span className="text-muted font-normal">(Optional)</span></label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="shop@email.com"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
            />
          </div>

          {/* Single Line Address * */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Address *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Street, City, Sector..."
              value={form.address}
              onChange={e => setForm({...form, address: e.target.value})}
            />
          </div>

          {/* Notes (Optional) */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notes <span className="text-muted font-normal">(Optional)</span></label>
            <textarea 
              className="form-textarea" 
              placeholder="Any additional notes..."
              value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              rows={3}
            />
          </div>

        </form>
      </div>
    </div>
  );
}
