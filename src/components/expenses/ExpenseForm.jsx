import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { EXPENSE_CATEGORIES } from '../../utils/constants';
import { createExpense } from '../../services/expenseService';

export default function ExpenseForm() {
  const { companyId, currentUser, userProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: EXPENSE_CATEGORIES[0],
    amount: 0,
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Expense title is required');
      return;
    }
    if (form.amount <= 0) {
      toast.error('Expense amount must be greater than 0');
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

      await createExpense(companyId, { ...form, createdAt: customTimestamp }, currentUser.uid, userProfile.name);
      toast.success('Expense recorded successfully');
      navigate('/expenses');
    } catch (err) {
      toast.error(err.message || 'Failed to record expense');
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="empty-state">
        <h3>Access Denied</h3>
        <p>Only admins can record expenses.</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/dashboard')}>Go Home</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/expenses')}>
              <ArrowLeft size={14} /> Back to Expenses
            </button>
          </div>
          <h1>Record New Expense</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : <Save size={16} />}
            Save Expense
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
            <label className="form-label">Expense Title / Description *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Monthly Rent, Office Supplies"
              value={form.title}
              onChange={e => setForm({...form, title: e.target.value})}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Amount *</label>
            <input 
              type="number" 
              className="form-input" 
              value={form.amount}
              onChange={e => setForm({...form, amount: Number(e.target.value)})}
              min="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select 
              className="form-select"
              value={form.category}
              onChange={e => setForm({...form, category: e.target.value})}
            >
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Reference / Receipt Number</label>
            <input 
              type="text" 
              className="form-input" 
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
