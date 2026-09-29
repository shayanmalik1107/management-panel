import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createPurchase } from '../../services/purchaseService';

export default function CreatePurchase() {
  const { companyId, currentUser, userProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    supplierName: '',
    grandTotal: 0,
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierName.trim()) {
      toast.error('Supplier Name is required');
      return;
    }
    if (form.grandTotal <= 0) {
      toast.error('Total amount must be greater than 0');
      return;
    }
    
    setLoading(true);
    try {
      const selectedDate = new Date(form.date);
      const today = new Date();
      let customTimestamp = Date.now();
      if (selectedDate.toDateString() !== today.toDateString()) {
        selectedDate.setHours(12, 0, 0, 0);
        customTimestamp = selectedDate.getTime();
      }

      await createPurchase(companyId, { ...form, createdAt: customTimestamp }, currentUser.uid, userProfile.name);
      toast.success('Stock purchase recorded successfully');
      navigate('/purchases');
    } catch (err) {
      toast.error(err.message || 'Failed to record purchase');
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="empty-state">
        <h3>Access Denied</h3>
        <p>Only admins can record purchases.</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/dashboard')}>Go Home</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/purchases')}>
              <ArrowLeft size={14} /> Back to Purchases
            </button>
          </div>
          <h1>Record Stock Purchase</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : <Save size={16} />}
            Save Purchase
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <form className="card-body form-grid" onSubmit={handleSubmit}>
          
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Date *</label>
            <input 
              type="date" 
              className="form-input" 
              value={form.date}
              onChange={e => setForm({...form, date: e.target.value})}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Supplier / Vendor Name *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Acme Wholesalers"
              value={form.supplierName}
              onChange={e => setForm({...form, supplierName: e.target.value})}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Total Amount (Stock Value) *</label>
            <input 
              type="number" 
              className="form-input" 
              value={form.grandTotal}
              onChange={e => setForm({...form, grandTotal: Number(e.target.value)})}
              min="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Invoice / Bill Reference</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. INV-2026-99"
              value={form.reference}
              onChange={e => setForm({...form, reference: e.target.value})}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Additional Notes</label>
            <textarea 
              className="form-textarea" 
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
