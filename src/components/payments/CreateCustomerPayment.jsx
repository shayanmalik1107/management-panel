import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Store, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getCustomers } from '../../services/customerService';
import { createCustomerPaymentReceived } from '../../services/paymentService';
import { formatCurrency } from '../../utils/formatters';
import ShopSelectDropdown from '../common/ShopSelectDropdown';

export default function CreateCustomerPayment() {
  const { companyId, currentUser, userProfile, companyInfo, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const currency = companyInfo?.currency || 'Rs';

  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customersWithCredit, setCustomersWithCredit] = useState([]);

  const [form, setForm] = useState({
    customerId: '',
    amount: '',
    paymentMethod: 'Cash',
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!companyId) return;
    loadCustomers();
  }, [companyId]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const allCusts = await getCustomers(companyId);
      // Filter customers with credit balance > 0
      const creditCusts = allCusts.filter(c => (Number(c.currentBalance) || 0) > 0);
      setCustomersWithCredit(creditCusts);
    } catch (err) {
      console.error('Failed to load customers', err);
    }
    setLoadingCustomers(false);
  };

  const selectedCustomerObj = customersWithCredit.find(c => c.id === form.customerId);
  const creditDue = selectedCustomerObj ? (Number(selectedCustomerObj.currentBalance) || 0) : 0;
  const payAmount = Number(form.amount) || 0;
  const isAmountExceeded = payAmount > creditDue;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerId) {
      toast.error('Please select a customer / shop');
      return;
    }
    if (payAmount <= 0) {
      toast.error('Payment received amount must be greater than 0');
      return;
    }
    if (isAmountExceeded) {
      toast.error(`Payment amount (${formatCurrency(payAmount, currency)}) cannot exceed shop's credit balance (${formatCurrency(creditDue, currency)})`);
      return;
    }

    setLoading(true);
    try {
      const parts = form.date.split('-').map(Number);
      const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
      const now = new Date();
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      const customTimestamp = selectedDate.getTime();

      await createCustomerPaymentReceived(
        companyId,
        {
          ...form,
          amount: payAmount,
          createdAt: customTimestamp
        },
        currentUser?.uid,
        userProfile?.name || 'User'
      );

      toast.success(`Payment of ${formatCurrency(payAmount, currency)} received from ${selectedCustomerObj.shopName}! Credit updated.`);
      navigate('/payments');
    } catch (err) {
      toast.error(err.message || 'Failed to record payment received');
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/payments')}>
              <ArrowLeft size={14} /> Back to Payments
            </button>
          </div>
          <h1>Receive Payment from Shop (Credit Deduction)</h1>
          <p className="text-muted text-sm">
            Record payment received from customer shops to deduct from their credit balance
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmit}
            disabled={loading || loadingCustomers || isAmountExceeded}
          >
            {loading ? <span className="loading-spinner" /> : <Save size={16} />}
            Record Payment Received
          </button>
        </div>
      </div>

      <div className="grid-2col-responsive" style={{ alignItems: 'start' }}>
        
        {/* Form Area */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={18} style={{ color: 'var(--primary-600)' }} /> Payment Details
            </h3>
          </div>

          <form className="card-body form-grid form-grid-2col" onSubmit={handleSubmit}>
            
            {/* Select Shop with Credit */}
            <ShopSelectDropdown
              shops={customersWithCredit}
              value={form.customerId}
              onChange={selectedShop => {
                setForm({
                  ...form,
                  customerId: selectedShop ? selectedShop.id : '',
                  amount: ''
                });
              }}
              currency={currency}
              placeholder="Search or select shop with credit..."
              label="Select Shop / Customer with Outstanding Credit *"
              required={true}
            />

            {/* Payment Date */}
            <div className="form-group">
              <label className="form-label">Payment Date *</label>
              <input
                type="date"
                className="form-input"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label className="form-label">Payment Method *</label>
              <select
                className="form-select"
                value={form.paymentMethod}
                onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Online">Online / Mobile Payment</option>
              </select>
            </div>

            {/* Payment Received Amount */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" style={{ color: 'var(--success-700)', fontWeight: 600 }}>
                Amount Received ({currency}) *
              </label>
              <input
                type="number"
                className={`form-input ${isAmountExceeded ? 'border-danger' : ''}`}
                style={{ fontSize: '18px', fontWeight: 'bold', color: isAmountExceeded ? 'var(--danger-600)' : 'var(--success-700)' }}
                placeholder="Enter payment amount"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                min="1"
                max={creditDue > 0 ? creditDue : undefined}
                disabled={!selectedCustomerObj}
              />

              {/* Validation Feedback */}
              {isAmountExceeded && (
                <div style={{ color: 'var(--danger-600)', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <AlertCircle size={14} />
                  Error: Payment amount cannot be greater than the shop's credit balance of {formatCurrency(creditDue, currency)}!
                </div>
              )}

              {selectedCustomerObj && !isAmountExceeded && payAmount > 0 && (
                <div style={{ color: 'var(--success-600)', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                  <CheckCircle size={14} />
                  New remaining credit for {selectedCustomerObj.shopName} will be <strong>{formatCurrency(Math.max(0, creditDue - payAmount), currency)}</strong>
                </div>
              )}
            </div>

            {/* Receipt Reference */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Receipt / Slip Reference</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Receipt #102, Bank Deposit Slip #459"
                value={form.reference}
                onChange={e => setForm({ ...form, reference: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Optional notes or remarks..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

          </form>
        </div>

        {/* Selected Shop Credit Card */}
        <div>
          {selectedCustomerObj ? (
            <div className="card" style={{ border: '2px solid var(--primary-200)', background: 'var(--primary-50)' }}>
              <div className="card-header" style={{ borderBottom: '1px solid var(--primary-200)' }}>
                <h3 className="card-title" style={{ color: 'var(--primary-900)' }}>Shop Credit Summary</h3>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-900)' }}>
                  {selectedCustomerObj.shopName}
                </div>
                <div className="text-xs text-muted">
                  Phone: {selectedCustomerObj.phone || '—'} | City: {selectedCustomerObj.city || '—'}
                </div>

                <div style={{ borderTop: '1px solid var(--primary-200)', paddingTop: '10px' }}>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>Total Credit Due</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--danger-600)', fontFamily: 'monospace' }}>
                    {formatCurrency(creditDue, currency)}
                  </div>
                </div>

                {payAmount > 0 && !isAmountExceeded && (
                  <div style={{ borderTop: '1px solid var(--primary-200)', paddingTop: '10px' }}>
                    <div className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>Remaining Credit After Payment</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success-700)', fontFamily: 'monospace' }}>
                      {formatCurrency(Math.max(0, creditDue - payAmount), currency)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--gray-500)' }}>
              <Store size={32} style={{ margin: '0 auto 8px auto', color: 'var(--gray-400)' }} />
              <p className="text-sm">Select a shop to view its credit details and remaining balance preview.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
