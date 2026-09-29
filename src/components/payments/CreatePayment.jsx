import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createSupplierPayment, getSupplierBalances } from '../../services/paymentService';
import { formatCurrency } from '../../utils/formatters';

export default function CreatePayment() {
  const { companyId, currentUser, userProfile, companyInfo, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const currency = companyInfo?.currency || 'Rs';
  
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  
  const [form, setForm] = useState({
    supplierName: '',
    amount: '',
    paymentMethod: 'Cash',
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!companyId) return;
    const loadData = async () => {
      try {
        const sups = await getSupplierBalances(companyId);
        setSuppliers(sups);
      } catch (err) {
        console.error('Failed to load supplier balances', err);
      }
      setLoadingSuppliers(false);
    };
    loadData();
  }, [companyId]);

  const handleSupplierSelect = (e) => {
    const name = e.target.value;
    const sup = suppliers.find(s => s.supplierName === name);
    setForm({
      ...form,
      supplierName: name,
      amount: sup ? sup.balance : '' // Auto-fill amount with outstanding balance
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierName.trim()) {
      toast.error('Supplier Name is required');
      return;
    }
    if (Number(form.amount) <= 0) {
      toast.error('Payment amount must be greater than 0');
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

      await createSupplierPayment(companyId, { ...form, createdAt: customTimestamp }, currentUser.uid, userProfile.name);
      toast.success('Payment recorded successfully');
      navigate('/payments');
    } catch (err) {
      toast.error(err.message || 'Failed to record payment');
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="empty-state">
        <h3>Access Denied</h3>
        <p>Only admins can record payments.</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/dashboard')}>Go Home</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/payments')}>
              <ArrowLeft size={14} /> Back to Payments
            </button>
          </div>
          <h1>Make Supplier Payment</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || loadingSuppliers}>
            {loading ? <span className="loading-spinner" /> : <Save size={16} />}
            Record Payment
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
            <label className="form-label">Select Supplier *</label>
            {loadingSuppliers ? (
              <div className="form-input" style={{ color: 'var(--gray-400)' }}>Loading suppliers...</div>
            ) : (
              <select 
                className="form-select" 
                value={form.supplierName}
                onChange={handleSupplierSelect}
                autoFocus
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.supplierName} value={s.supplierName}>
                    {s.supplierName} (Outstanding: {formatCurrency(s.balance, currency)})
                  </option>
                ))}
              </select>
            )}
            <p className="text-muted text-sm mt-1">Select a supplier who has an outstanding purchase balance.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Amount Paying *</label>
            <input 
              type="number" 
              className="form-input" 
              value={form.amount}
              onChange={e => setForm({...form, amount: e.target.value})}
              min="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select 
              className="form-select"
              value={form.paymentMethod}
              onChange={e => setForm({...form, paymentMethod: e.target.value})}
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Online">Online</option>
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Transaction Reference</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Receipt #, Cheque #"
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
