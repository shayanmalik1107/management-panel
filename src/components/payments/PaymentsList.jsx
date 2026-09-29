import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Plus, Search, Edit, Trash2, X, Save, Filter, ShoppingBag } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { updateSupplierPayment, deleteSupplierPayment } from '../../services/paymentService';
import FilterPanel from '../common/FilterPanel';

export default function PaymentsList() {
  const { companyId, companyInfo, isAdmin, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const currency = companyInfo?.currency || 'Rs';

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters State
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');

  // Modal Edit State
  const [editingPayment, setEditingPayment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    supplierName: '',
    reference: '',
    amount: 0,
    paymentMethod: 'Cash',
    notes: ''
  });

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const paymentsRef = ref(database, `companies/${companyId}/payments`);

    const unsubscribe = onValue(paymentsRef, (snapshot) => {
      const dbList = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const p = child.val();
          if (p.type === 'supplier_payment') {
            dbList.push({ id: child.key, ...p });
          }
        });
      }

      dbList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPayments(dbList);
      setLoading(false);
    }, (err) => {
      console.error('Payments listener error:', err);
      setPayments([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  // Dynamic Supplier Options
  const supplierOptions = useMemo(() => {
    const map = new Map();
    payments.forEach(p => {
      if (p.supplierName) map.set(p.supplierName, p.supplierName);
    });
    const list = Array.from(map.keys()).map(name => ({ value: name, label: name }));
    return [{ value: 'all', label: 'All Suppliers' }, ...list];
  }, [payments]);

  // Method Options
  const methodOptions = useMemo(() => [
    { value: 'all', label: 'All Methods' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Bank Transfer', label: 'Bank Transfer' },
    { value: 'Cheque', label: 'Cheque' },
    { value: 'Online', label: 'Online / Card' }
  ], []);

  const handleResetFilters = () => {
    setSearch('');
    setPeriod('');
    setQuickFilter('');
    setStartDate('');
    setEndDate('');
    setSelectedSupplier('all');
    setSelectedMethod('all');
  };

  const handleOpenEdit = (payment) => {
    setEditingPayment(payment);
    setEditForm({
      supplierName: payment.supplierName || '',
      reference: payment.reference || '',
      amount: payment.amount || 0,
      paymentMethod: payment.paymentMethod || 'Cash',
      notes: payment.notes || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.supplierName.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    if (Number(editForm.amount) <= 0) {
      toast.error('Payment amount must be greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      await updateSupplierPayment(
        companyId,
        editingPayment.id,
        editForm,
        currentUser?.uid,
        userProfile?.name || 'User'
      );
      toast.success(`Payment updated successfully`);
      setEditingPayment(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update payment');
    }
    setSubmitting(false);
  };

  const handleDeleteItem = async (payment) => {
    if (!window.confirm(`Are you sure you want to remove payment "${payment.reference || payment.id}"?`)) return;

    try {
      await deleteSupplierPayment(companyId, payment.id);
      toast.success('Payment deleted from database');
    } catch (err) {
      toast.error('Failed to delete payment');
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch =
      !search ||
      p.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
      p.reference?.toLowerCase().includes(search.toLowerCase()) ||
      p.createdByName?.toLowerCase().includes(search.toLowerCase());

    const matchesSupplier =
      !selectedSupplier || selectedSupplier === 'all' ||
      p.supplierName === selectedSupplier;

    const matchesMethod =
      !selectedMethod || selectedMethod === 'all' ||
      p.paymentMethod === selectedMethod;

    let matchesDate = true;
    if (p.createdAt) {
      const pDateStr = new Date(p.createdAt).toISOString().split('T')[0];
      if (startDate && pDateStr < startDate) matchesDate = false;
      if (endDate && pDateStr > endDate) matchesDate = false;
    }

    return matchesSearch && matchesSupplier && matchesMethod && matchesDate;
  });

  const totalPaymentSum = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Payments Made</h1>
          <p className="text-muted text-sm">Manage payments made to your suppliers and vendors</p>
        </div>
        <div className="page-header-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => navigate('/payments/new')}>
              <Plus size={16} /> Make Payment
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Payment Filters Panel */}
      <FilterPanel
        title="Payment Filters"
        subtitle="Filter and analyze supplier payments by date range & method"
        icon={Filter}
        period={period}
        setPeriod={setPeriod}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        dropdown1Label="Supplier"
        dropdown1Value={selectedSupplier}
        setDropdown1Value={setSelectedSupplier}
        dropdown1Options={supplierOptions}
        dropdown1Icon={ShoppingBag}
        dropdown2Label="Payment Method"
        dropdown2Value={selectedMethod}
        setDropdown2Value={setSelectedMethod}
        dropdown2Options={methodOptions}
        dropdown2Icon={CreditCard}
        onReset={handleResetFilters}
      />

      <div className="card">
        <div className="table-toolbar">
          <div className="table-search" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search payments by supplier or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="font-semibold text-success text-sm">
            Total Payments: {formatCurrency(totalPaymentSum, currency)}
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading-page">
              <div className="loading-spinner lg"></div>
            </div>
          ) : filteredPayments.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Reference</th>
                  <th>Method</th>
                  <th>Amount Paid</th>
                  <th>Recorded By</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(payment => (
                  <tr key={payment.id}>
                    <td className="text-sm text-muted">{formatDate(payment.createdAt)}</td>
                    <td className="font-medium">{payment.supplierName}</td>
                    <td>{payment.reference || '—'}</td>
                    <td>
                      <span className="badge badge-gray">{payment.paymentMethod || 'Cash'}</span>
                    </td>
                    <td className="font-semibold text-success">
                      {formatCurrency(payment.amount, currency)}
                    </td>
                    <td className="text-sm">{payment.createdByName || 'User'}</td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleOpenEdit(payment)}
                            title="Edit Payment"
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => handleDeleteItem(payment)}
                            title="Delete Payment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <CreditCard size={24} />
              </div>
              <h3>No payments recorded</h3>
              <p>Record your first payment to a supplier here.</p>
              {isAdmin && (
                <button className="btn btn-primary mt-4" onClick={() => navigate('/payments/new')}>
                  <Plus size={16} /> Make Payment
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EDIT PAYMENT MODAL */}
      {editingPayment && (
        <div className="modal-overlay" onClick={() => setEditingPayment(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Edit size={18} style={{ color: 'var(--primary-600)' }} /> Edit Payment
              </h3>
              <button className="modal-close" onClick={() => setEditingPayment(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Supplier Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.supplierName}
                    onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Amount ({currency}) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select
                    className="form-select"
                    value={editForm.paymentMethod}
                    onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online / Card</option>
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Reference / Slip #</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.reference}
                    onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingPayment(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="loading-spinner" /> : <Save size={16} />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
