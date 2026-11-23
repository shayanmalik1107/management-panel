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

  const [activeTab, setActiveTab] = useState('supplier');
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters State
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedParty, setSelectedParty] = useState('all');
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
      const supList = [];
      const custList = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const p = child.val();
          if (p.type === 'supplier_payment') {
            supList.push({ id: child.key, ...p });
          } else if (p.type === 'customer_payment') {
            custList.push({ id: child.key, ...p });
          }
        });
      }

      supList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      custList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setSupplierPayments(supList);
      setCustomerPayments(custList);
      setLoading(false);
    }, (err) => {
      console.error('Payments listener error:', err);
      setSupplierPayments([]);
      setCustomerPayments([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  // Current active dataset
  const activePayments = activeTab === 'supplier' ? supplierPayments : customerPayments;

  // Dynamic Party Options (Supplier or Customer Name)
  const partyOptions = useMemo(() => {
    const map = new Map();
    activePayments.forEach(p => {
      const name = p.supplierName || p.customerName;
      if (name) map.set(name, name);
    });
    const list = Array.from(map.keys()).map(name => ({ value: name, label: name }));
    return [{ value: 'all', label: activeTab === 'supplier' ? 'All Suppliers' : 'All Customers/Shops' }, ...list];
  }, [activePayments, activeTab]);

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
    setSelectedParty('all');
    setSelectedMethod('all');
  };

  const handleOpenEdit = (payment) => {
    setEditingPayment(payment);
    setEditForm({
      supplierName: payment.supplierName || payment.customerName || '',
      reference: payment.reference || '',
      amount: payment.amount || 0,
      paymentMethod: payment.paymentMethod || 'Cash',
      notes: payment.notes || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.supplierName.trim()) {
      toast.error('Party name is required');
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

  const filteredPayments = activePayments.filter(p => {
    const partyName = p.supplierName || p.customerName || '';
    const matchesSearch =
      !search ||
      partyName.toLowerCase().includes(search.toLowerCase()) ||
      p.reference?.toLowerCase().includes(search.toLowerCase()) ||
      p.createdByName?.toLowerCase().includes(search.toLowerCase());

    const matchesParty =
      !selectedParty || selectedParty === 'all' ||
      partyName === selectedParty;

    const matchesMethod =
      !selectedMethod || selectedMethod === 'all' ||
      p.paymentMethod === selectedMethod;

    let matchesDate = true;
    if (p.createdAt) {
      const pDateStr = new Date(p.createdAt).toISOString().split('T')[0];
      if (startDate && pDateStr < startDate) matchesDate = false;
      if (endDate && pDateStr > endDate) matchesDate = false;
    }

    return matchesSearch && matchesParty && matchesMethod && matchesDate;
  });

  const totalPaymentSum = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Financial Payments</h1>
          <p className="text-muted text-sm">Manage payments made to suppliers and payments received from shop credits</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {isAdmin && (
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/payments/customer-new')}>
                <Plus size={16} /> Receive Payment (Shops)
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/payments/new')}>
                <Plus size={16} /> Make Payment (Suppliers)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <button
          className={`btn ${activeTab === 'supplier' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('supplier'); handleResetFilters(); }}
        >
          <CreditCard size={16} /> Supplier Payments Made ({supplierPayments.length})
        </button>
        <button
          className={`btn ${activeTab === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('customer'); handleResetFilters(); }}
        >
          <ShoppingBag size={16} /> Shop Credit Payments Received ({customerPayments.length})
        </button>
      </div>

      {/* Collapsible Payment Filters Panel */}
      <FilterPanel
        title={activeTab === 'supplier' ? 'Supplier Payment Filters' : 'Shop Credit Payment Filters'}
        subtitle="Filter and analyze payments by date range & method"
        icon={Filter}
        period={period}
        setPeriod={setPeriod}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        dropdown1Label={activeTab === 'supplier' ? 'Supplier' : 'Shop / Customer'}
        dropdown1Value={selectedParty}
        setDropdown1Value={setSelectedParty}
        dropdown1Options={partyOptions}
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
              placeholder={activeTab === 'supplier' ? "Search payments by supplier..." : "Search payments by shop name..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="font-semibold text-success text-sm">
            Total {activeTab === 'supplier' ? 'Paid' : 'Received'}: {formatCurrency(totalPaymentSum, currency)}
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
                  <th>Date & Time</th>
                  <th>{activeTab === 'supplier' ? 'Supplier Name' : 'Shop / Customer Name'}</th>
                  <th>Reference</th>
                  <th>Method</th>
                  <th>{activeTab === 'supplier' ? 'Amount Paid' : 'Amount Received'}</th>
                  <th>Recorded By</th>
                  {isAdmin && activeTab === 'supplier' && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(payment => (
                  <tr key={payment.id}>
                    <td className="text-sm text-muted">{formatDate(payment.createdAt)}</td>
                    <td className="font-medium">{payment.supplierName || payment.customerName}</td>
                    <td>{payment.reference || '—'}</td>
                    <td>
                      <span className="badge badge-gray">{payment.paymentMethod || 'Cash'}</span>
                    </td>
                    <td className="font-semibold text-success">
                      {formatCurrency(payment.amount, currency)}
                    </td>
                    <td className="text-sm">{payment.createdByName || 'User'}</td>
                    {isAdmin && activeTab === 'supplier' && (
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
              <p>{activeTab === 'supplier' ? 'Record your first payment to a supplier.' : 'Record your first payment received from a shop with credit.'}</p>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                  {activeTab === 'supplier' ? (
                    <button className="btn btn-primary" onClick={() => navigate('/payments/new')}>
                      <Plus size={16} /> Make Payment
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => navigate('/payments/customer-new')}>
                      <Plus size={16} /> Receive Payment
                    </button>
                  )}
                </div>
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
