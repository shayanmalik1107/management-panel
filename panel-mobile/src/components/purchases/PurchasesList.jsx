import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, Search, Edit, Trash2, X, Save, Filter, User } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { updatePurchase, deletePurchase } from '../../services/purchaseService';
import FilterPanel from '../common/FilterPanel';

export default function PurchasesList() {
  const { companyId, companyInfo, isAdmin, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const currency = companyInfo?.currency || 'Rs';

  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters State
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedCreatedBy, setSelectedCreatedBy] = useState('all');
  
  // Modal Edit State
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    supplierName: '',
    reference: '',
    grandTotal: 0,
    notes: ''
  });

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const purchasesRef = ref(database, `companies/${companyId}/purchases`);

    const unsubscribe = onValue(purchasesRef, (snapshot) => {
      const dbList = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          dbList.push({ id: child.key, ...child.val() });
        });
      }

      dbList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPurchases(dbList);
      setLoading(false);
    }, (err) => {
      console.error('Purchases listener error:', err);
      setPurchases([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  // Dynamic Supplier Options
  const supplierOptions = useMemo(() => {
    const map = new Map();
    purchases.forEach(p => {
      if (p.supplierName) map.set(p.supplierName, p.supplierName);
    });
    const list = Array.from(map.keys()).map(name => ({ value: name, label: name }));
    return [{ value: 'all', label: 'All Suppliers' }, ...list];
  }, [purchases]);

  // Dynamic Created By Options
  const createdByOptions = useMemo(() => {
    const map = new Map();
    purchases.forEach(p => {
      if (p.createdByName) map.set(p.createdByName, p.createdByName);
    });
    const list = Array.from(map.keys()).map(name => ({ value: name, label: name }));
    return [{ value: 'all', label: 'All Users' }, ...list];
  }, [purchases]);

  const handleResetFilters = () => {
    setSearch('');
    setPeriod('');
    setQuickFilter('');
    setStartDate('');
    setEndDate('');
    setSelectedSupplier('all');
    setSelectedCreatedBy('all');
  };

  const handleOpenEdit = (purchase) => {
    setEditingPurchase(purchase);
    setEditForm({
      supplierName: purchase.supplierName || '',
      reference: purchase.reference || '',
      grandTotal: purchase.grandTotal || 0,
      notes: purchase.notes || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.supplierName.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    if (Number(editForm.grandTotal) <= 0) {
      toast.error('Purchase amount must be greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      await updatePurchase(
        companyId,
        editingPurchase.id,
        editForm,
        currentUser?.uid,
        userProfile?.name || 'User'
      );
      toast.success(`Purchase updated successfully`);
      setEditingPurchase(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update purchase');
    }
    setSubmitting(false);
  };

  const handleDeleteItem = async (purchase) => {
    if (!window.confirm(`Are you sure you want to remove purchase "${purchase.reference || purchase.id}"?`)) return;

    try {
      await deletePurchase(companyId, purchase.id);
      toast.success('Purchase deleted from database');
    } catch (err) {
      toast.error('Failed to delete purchase');
    }
  };

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch =
      !search ||
      p.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
      p.reference?.toLowerCase().includes(search.toLowerCase()) ||
      p.createdByName?.toLowerCase().includes(search.toLowerCase());

    const matchesSupplier =
      !selectedSupplier || selectedSupplier === 'all' ||
      p.supplierName === selectedSupplier;

    const matchesCreatedBy =
      !selectedCreatedBy || selectedCreatedBy === 'all' ||
      p.createdByName === selectedCreatedBy;

    let matchesDate = true;
    if (p.createdAt) {
      const pDateStr = new Date(p.createdAt).toISOString().split('T')[0];
      if (startDate && pDateStr < startDate) matchesDate = false;
      if (endDate && pDateStr > endDate) matchesDate = false;
    }

    return matchesSearch && matchesSupplier && matchesCreatedBy && matchesDate;
  });

  const totalPurchaseSum = filteredPurchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Stock Purchases</h1>
          <p className="text-muted text-sm">Manage incoming inventory purchases and supplier bills</p>
        </div>
        <div className="page-header-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>
              <Plus size={16} /> New Purchase
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Purchase Filters Panel */}
      <FilterPanel
        title="Purchase Filters"
        subtitle="Filter and analyze stock purchases by date range & supplier"
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
        dropdown2Label="Recorded By"
        dropdown2Value={selectedCreatedBy}
        setDropdown2Value={setSelectedCreatedBy}
        dropdown2Options={createdByOptions}
        dropdown2Icon={User}
        onReset={handleResetFilters}
      />

      <div className="card">
        <div className="table-toolbar">
          <div className="table-search" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by supplier or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="font-semibold text-primary-700 text-sm">
            Total Purchases: {formatCurrency(totalPurchaseSum, currency)}
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading-page">
              <div className="loading-spinner lg"></div>
            </div>
          ) : filteredPurchases.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Reference</th>
                  <th>Total Amount</th>
                  <th>Recorded By</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="text-sm text-muted">{formatDate(purchase.createdAt)}</td>
                    <td className="font-medium">{purchase.supplierName}</td>
                    <td>{purchase.reference || '—'}</td>
                    <td className="font-semibold text-primary-600">
                      {formatCurrency(purchase.grandTotal, currency)}
                    </td>
                    <td className="text-sm">{purchase.createdByName || 'User'}</td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleOpenEdit(purchase)}
                            title="Edit Purchase"
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => handleDeleteItem(purchase)}
                            title="Delete Purchase"
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
                <ShoppingBag size={24} />
              </div>
              <h3>No purchases found</h3>
              <p>Record your stock purchase from suppliers here.</p>
              {isAdmin && (
                <button className="btn btn-primary mt-4" onClick={() => navigate('/purchases/new')}>
                  <Plus size={16} /> New Purchase
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EDIT PURCHASE MODAL */}
      {editingPurchase && (
        <div className="modal-overlay" onClick={() => setEditingPurchase(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Edit size={18} style={{ color: 'var(--primary-600)' }} /> Edit Purchase
              </h3>
              <button className="modal-close" onClick={() => setEditingPurchase(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label className="form-label">Supplier Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.supplierName}
                    onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Reference / Bill #</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.reference}
                    onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Purchase Amount ({currency}) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editForm.grandTotal}
                    onChange={(e) => setEditForm({ ...editForm, grandTotal: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingPurchase(null)}
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
