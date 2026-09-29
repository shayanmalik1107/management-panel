import { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Download,
  Calendar,
  Trash2,
  Edit,
  X,
  Save,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Filter,
  CheckCircle,
  AlertCircle,
  ShoppingBag
} from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { listenLedgerEntries, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry } from '../../services/ledgerService';
import FilterPanel from '../common/FilterPanel';

export default function LedgerPage() {
  const { companyId, companyInfo, isAdmin, currentUser, userProfile } = useAuth();
  const toast = useToast();

  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionType, setTransactionType] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State for manual entry
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    payment: '',
    purchase: '',
    supplierName: '',
    description: ''
  });

  const currency = companyInfo?.currency || 'Rs';

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);

    // 1. Listen to manual Ledger entries
    const unsubLedger = listenLedgerEntries(
      companyId,
      (data) => setLedgerEntries(data),
      (err) => console.error('Ledger listener error:', err)
    );

    // 2. Listen to Purchases
    const purchasesRef = ref(database, `companies/${companyId}/purchases`);
    const unsubPurchases = onValue(purchasesRef, (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push({ id: child.key, ...child.val() });
        });
      }
      setPurchases(list);
    });

    // 3. Listen to Payments
    const paymentsRef = ref(database, `companies/${companyId}/payments`);
    const unsubPayments = onValue(paymentsRef, (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();
          if (val.type === 'supplier_payment') {
            list.push({ id: child.key, ...val });
          }
        });
      }
      setPayments(list);
      setLoading(false);
    });

    return () => {
      unsubLedger();
      unsubPurchases();
      unsubPayments();
    };
  }, [companyId]);

  // Consolidate all 3 sources (Purchases, Payments, and Manual Ledger Entries) by Date
  const combinedEntries = useMemo(() => {
    const records = [];

    // Add Purchases
    purchases.forEach((p) => {
      const dateStr = p.createdAt
        ? new Date(p.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      records.push({
        id: `pur-${p.id}`,
        source: 'purchase',
        date: dateStr,
        timestamp: p.createdAt || Date.now(),
        payment: 0,
        purchase: Number(p.grandTotal) || 0,
        supplierName: p.supplierName || '',
        description: `Stock Purchase ${p.reference ? `(${p.reference})` : ''}`,
        isEditable: false
      });
    });

    // Add Payments
    payments.forEach((pay) => {
      const dateStr = pay.createdAt
        ? new Date(pay.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      records.push({
        id: `pay-${pay.id}`,
        source: 'payment',
        date: dateStr,
        timestamp: pay.createdAt || Date.now(),
        payment: Number(pay.amount) || 0,
        purchase: 0,
        supplierName: pay.supplierName || '',
        description: `Supplier Payment ${pay.paymentMethod ? `via ${pay.paymentMethod}` : ''}`,
        isEditable: false
      });
    });

    // Add Manual Ledger Entries
    ledgerEntries.forEach((entry) => {
      const dateStr = entry.date || new Date().toISOString().split('T')[0];
      records.push({
        id: entry.id,
        source: 'manual',
        date: dateStr,
        timestamp: entry.createdAt || new Date(dateStr).getTime(),
        payment: Number(entry.payment) || 0,
        purchase: Number(entry.purchase) || 0,
        supplierName: entry.supplierName || '',
        description: entry.description || 'Manual Entry',
        isEditable: true,
        raw: entry
      });
    });

    // Group records by Date (so if both purchase & payment occurred on the same date, they consolidate smoothly)
    const groupedByDate = {};

    records.forEach((r) => {
      if (!groupedByDate[r.date]) {
        groupedByDate[r.date] = {
          date: r.date,
          timestamp: r.timestamp,
          payment: 0,
          purchase: 0,
          details: [],
          suppliers: new Set(),
          hasEditable: false,
          editableEntries: []
        };
      }

      groupedByDate[r.date].payment += r.payment;
      groupedByDate[r.date].purchase += r.purchase;
      groupedByDate[r.date].details.push(r);
      if (r.supplierName) groupedByDate[r.date].suppliers.add(r.supplierName);
      if (r.isEditable) {
        groupedByDate[r.date].hasEditable = true;
        groupedByDate[r.date].editableEntries.push(r);
      }
    });

    // Convert grouped object to array and sort chronologically by date
    const sortedGrouped = Object.values(groupedByDate).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return sortedGrouped;
  }, [purchases, payments, ledgerEntries]);

  // Supplier List for filtering
  const allSuppliers = useMemo(() => {
    const list = new Set();
    purchases.forEach((p) => p.supplierName && list.add(p.supplierName));
    payments.forEach((p) => p.supplierName && list.add(p.supplierName));
    ledgerEntries.forEach((e) => e.supplierName && list.add(e.supplierName));
    return Array.from(list).sort();
  }, [purchases, payments, ledgerEntries]);

  const supplierOptions = useMemo(() => {
    const list = [{ value: 'all', label: `All Suppliers (${allSuppliers.length})` }];
    allSuppliers.forEach((sup) => {
      list.push({ value: sup, label: sup });
    });
    return list;
  }, [allSuppliers]);

  const handleResetFilters = () => {
    setSearch('');
    setPeriod('');
    setQuickFilter('');
    setStartDate('');
    setEndDate('');
    setSelectedSupplier('all');
    setTransactionType('all');
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    return combinedEntries.filter((row) => {
      // Filter Supplier
      if (selectedSupplier !== 'all') {
        const hasSupplier = Array.from(row.suppliers).some((s) => s === selectedSupplier);
        if (!hasSupplier) return false;
      }

      // Filter Transaction Type
      if (transactionType === 'payment' && (row.totalPayment || 0) <= 0) return false;
      if (transactionType === 'purchase' && (row.totalPurchase || 0) <= 0) return false;

      // Filter Search Text (searches date string, formatted date, supplier, details, reference)
      if (search) {
        const q = search.toLowerCase();
        const formattedStr = formatDate(row.date).toLowerCase();
        const rawDateStr = row.date.toLowerCase();
        const matchesDate = rawDateStr.includes(q) || formattedStr.includes(q);
        const matchesSupplier = Array.from(row.suppliers).some((s) =>
          s.toLowerCase().includes(q)
        );
        const matchesDetail = row.details.some(
          (d) =>
            d.description.toLowerCase().includes(q) ||
            String(d.payment).includes(q) ||
            String(d.purchase).includes(q)
        );
        if (!matchesDate && !matchesSupplier && !matchesDetail) return false;
      }

      // Filter Custom Start/End Date Pickers
      if (startDate && row.date < startDate) return false;
      if (endDate && row.date > endDate) return false;

      return true;
    });
  }, [combinedEntries, selectedSupplier, transactionType, search, startDate, endDate]);

  // Overall Totals
  const totalPayments = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + r.payment, 0);
  }, [filteredRows]);

  const totalPurchases = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + r.purchase, 0);
  }, [filteredRows]);

  // Final purchase amount still due: (Total Purchases - Total Payments)
  const finalAmountDue = totalPurchases - totalPayments;

  // Add/Edit Manual Ledger Entry Modal handlers
  const handleOpenAddModal = () => {
    setEditingEntry(null);
    setForm({
      date: new Date().toISOString().split('T')[0],
      payment: '',
      purchase: '',
      supplierName: '',
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rawEntry) => {
    setEditingEntry(rawEntry);
    setForm({
      date: rawEntry.date || new Date().toISOString().split('T')[0],
      payment: rawEntry.payment || '',
      purchase: rawEntry.purchase || '',
      supplierName: rawEntry.supplierName || '',
      description: rawEntry.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e) => {
    e.preventDefault();
    const payNum = Number(form.payment) || 0;
    const purNum = Number(form.purchase) || 0;

    if (payNum <= 0 && purNum <= 0) {
      toast.error('Please enter a Payment amount, a Purchase amount, or both.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingEntry) {
        await updateLedgerEntry(companyId, editingEntry.id, form);
        toast.success('Ledger entry updated successfully');
      } else {
        await createLedgerEntry(
          companyId,
          form,
          currentUser?.uid,
          userProfile?.name || 'User'
        );
        toast.success('New ledger entry recorded successfully');
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save entry');
    }
    setSubmitting(false);
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this manual ledger entry?')) return;
    try {
      await deleteLedgerEntry(companyId, entryId);
      toast.success('Ledger entry deleted');
    } catch (err) {
      toast.error('Failed to delete entry');
    }
  };

  // Export CSV functionality
  const handleExportCSV = () => {
    if (filteredRows.length === 0) {
      toast.info('No ledger data to export');
      return;
    }

    let csvContent = 'Date,Payment,Purchase,Supplier,Details\n';
    filteredRows.forEach((r) => {
      const suppliersStr = Array.from(r.suppliers).join('; ') || 'N/A';
      const detailsStr = r.details.map((d) => d.description).join('; ') || '';
      csvContent += `"${r.date}",${r.payment},${r.purchase},"${suppliersStr}","${detailsStr}"\n`;
    });

    csvContent += `\n"TOTALS",${totalPayments},${totalPurchases},"",""\n`;
    csvContent += `"FINAL AMOUNT STILL DUE",${finalAmountDue > 0 ? finalAmountDue : 0},"","",""\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ledger_Sheet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger CSV exported successfully');
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>General Ledger Sheet</h1>
          <p className="text-muted text-sm">
            Excel-style 3-column financial ledger (Date, Payment, Purchase) with balance tracking
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} /> Export CSV
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={handleOpenAddModal}>
              <Plus size={16} /> Record Ledger Entry
            </button>
          )}
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Payments</span>
            <div className="stat-card-icon green">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="stat-card-value text-success">{formatCurrency(totalPayments, currency)}</div>
          <div className="text-xs text-muted mt-1">Total payments made to suppliers</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Purchases</span>
            <div className="stat-card-icon blue">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="stat-card-value text-primary-600">{formatCurrency(totalPurchases, currency)}</div>
          <div className="text-xs text-muted mt-1">Total stock purchases recorded</div>
        </div>

        <div
          className="stat-card"
          style={{
            borderColor: finalAmountDue > 0 ? 'var(--danger-300)' : 'var(--success-300)',
            backgroundColor: finalAmountDue > 0 ? 'var(--danger-50)' : 'var(--success-50)'
          }}
        >
          <div className="stat-card-header">
            <span className="stat-card-label" style={{ fontWeight: 600, color: finalAmountDue > 0 ? 'var(--danger-800)' : 'var(--success-800)' }}>
              Final Amount Still Due
            </span>
            <div className={`stat-card-icon ${finalAmountDue > 0 ? 'red' : 'green'}`}>
              <DollarSign size={18} />
            </div>
          </div>
          <div
            className="stat-card-value"
            style={{ color: finalAmountDue > 0 ? 'var(--danger-700)' : 'var(--success-700)', fontWeight: 700 }}
          >
            {formatCurrency(finalAmountDue > 0 ? finalAmountDue : 0, currency)}
          </div>
          <div className="text-xs mt-1" style={{ color: finalAmountDue > 0 ? 'var(--danger-600)' : 'var(--success-600)' }}>
            {finalAmountDue > 0 ? '⚠ Outstanding purchase balance' : '✓ All purchases fully settled'}
          </div>
        </div>
      </div>

      {/* Collapsible Ledger Filters Panel */}
      <FilterPanel
        title="Ledger Filters"
        subtitle="Filter and analyze general ledger transactions"
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
        dropdown2Label="Transaction Filter"
        dropdown2Value={transactionType}
        setDropdown2Value={setTransactionType}
        dropdown2Options={[
          { value: 'all', label: 'All Transactions' },
          { value: 'payment', label: 'Payments Only' },
          { value: 'purchase', label: 'Purchases Only' }
        ]}
        dropdown2Icon={Filter}
        onReset={handleResetFilters}
      />

      {/* EXCEL SPREADSHEET TABLE */}
      <div
        className="card"
        style={{
          border: '1px solid var(--gray-300)',
          boxShadow: 'var(--shadow-md)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden'
        }}
      >
        {/* Spreadsheet Banner Header */}
        <div
          style={{
            background: '#107c41', // Excel Green
            color: '#ffffff',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 600 }}>
            <BookOpen size={18} />
            <span>Excel Ledger Worksheet (Purchases & Payments)</span>
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
            {filteredRows.length} Entry Row(s)
          </span>
        </div>

        <div
          className="table-container"
          style={{
            maxHeight: '520px',
            overflowY: 'auto',
            overflowX: 'auto',
            position: 'relative'
          }}
        >
          {loading ? (
            <div className="loading-page"><div className="loading-spinner lg"></div></div>
          ) : (
            <table
              className="data-table"
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                borderCollapse: 'separate',
                borderSpacing: 0,
                width: '100%'
              }}
            >
              {/* Excel Column Letters Header - Sticky Top */}
              <thead style={{ position: 'sticky', top: 0, zIndex: 30 }}>
                <tr style={{ background: '#f3f4f6', color: '#6b7280', fontSize: '11px', textAlign: 'center' }}>
                  <th style={{ border: '1px solid #e5e7eb', width: '50px', padding: '4px', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>#</th>
                  <th style={{ border: '1px solid #e5e7eb', width: '250px', padding: '4px', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>A (DATE)</th>
                  <th style={{ border: '1px solid #e5e7eb', width: '220px', padding: '4px', textAlign: 'right', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>B (PAYMENT)</th>
                  <th style={{ border: '1px solid #e5e7eb', width: '220px', padding: '4px', textAlign: 'right', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>C (PURCHASE)</th>
                  <th style={{ border: '1px solid #e5e7eb', padding: '4px', textAlign: 'left', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>SUPPLIER / DETAILS</th>
                  {isAdmin && <th style={{ border: '1px solid #e5e7eb', width: '90px', padding: '4px', textAlign: 'center', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>ACTION</th>}
                </tr>

                {/* Primary Column Names */}
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ border: '1px solid #e5e7eb', textAlign: 'center', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>#</th>
                  <th style={{ border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 700, color: '#111827', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} style={{ color: '#4b5563' }} /> Date
                    </div>
                  </th>
                  <th style={{ border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 700, color: '#059669', textAlign: 'right', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>
                    Payment ({currency})
                  </th>
                  <th style={{ border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 700, color: '#2563eb', textAlign: 'right', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>
                    Purchase ({currency})
                  </th>
                  <th style={{ border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 700, color: '#111827', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>
                    Supplier & Transaction Details
                  </th>
                  {isAdmin && <th style={{ border: '1px solid #e5e7eb', textAlign: 'center', fontSize: '12px', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>Edit/Del</th>}
                </tr>
              </thead>

              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, idx) => {
                    const supplierText = Array.from(row.suppliers).join(', ');

                    return (
                      <tr
                        key={row.date + idx}
                        style={{
                          background: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {/* Excel Row Index */}
                        <td
                          style={{
                            border: '1px solid #e5e7eb',
                            textAlign: 'center',
                            color: '#9ca3af',
                            fontSize: '12px',
                            fontWeight: 500,
                            background: '#f3f4f6'
                          }}
                        >
                          {idx + 1}
                        </td>

                        {/* COLUMN A: DATE */}
                        <td
                          style={{
                            border: '1px solid #e5e7eb',
                            fontWeight: 600,
                            color: '#1f2937',
                            fontSize: '13px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {formatDate(row.date)}
                        </td>

                        {/* COLUMN B: PAYMENT */}
                        <td
                          style={{
                            border: '1px solid #e5e7eb',
                            textAlign: 'right',
                            fontWeight: row.payment > 0 ? 600 : 400,
                            color: row.payment > 0 ? '#059669' : '#9ca3af',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            background: row.payment > 0 ? '#f0fdf4' : 'transparent'
                          }}
                        >
                          {row.payment > 0 ? formatCurrency(row.payment, currency) : '—'}
                        </td>

                        {/* COLUMN C: PURCHASE */}
                        <td
                          style={{
                            border: '1px solid #e5e7eb',
                            textAlign: 'right',
                            fontWeight: row.purchase > 0 ? 600 : 400,
                            color: row.purchase > 0 ? '#2563eb' : '#9ca3af',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            background: row.purchase > 0 ? '#eff6ff' : 'transparent'
                          }}
                        >
                          {row.purchase > 0 ? formatCurrency(row.purchase, currency) : '—'}
                        </td>

                        {/* SUPPLIER & DETAILS */}
                        <td style={{ border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {supplierText && (
                              <span style={{ fontWeight: 600, color: '#111827' }}>
                                Supplier: {supplierText}
                              </span>
                            )}
                            <div className="text-xs text-muted">
                              {row.details.map((d, i) => (
                                <span key={i} style={{ marginRight: '8px' }}>
                                  • {d.description} {d.purchase > 0 ? `(Purchase: ${formatCurrency(d.purchase, currency)})` : ''} {d.payment > 0 ? `(Payment: ${formatCurrency(d.payment, currency)})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* ACTIONS FOR EDITABLE MANUAL ENTRIES */}
                        {isAdmin && (
                          <td style={{ border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            {row.hasEditable ? (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                {row.editableEntries.map((editable) => (
                                  <div key={editable.id} style={{ display: 'flex', gap: '2px' }}>
                                    <button
                                      className="btn btn-ghost btn-xs"
                                      onClick={() => handleOpenEditModal(editable.raw)}
                                      title="Edit manual entry"
                                    >
                                      <Edit size={12} />
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-xs text-danger"
                                      onClick={() => handleDeleteEntry(editable.id)}
                                      title="Delete manual entry"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} style={{ border: '1px solid #e5e7eb', padding: 'var(--space-8)' }}>
                      <div className="empty-state">
                        <BookOpen size={32} style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }} />
                        <h3>No Ledger Entries Found</h3>
                        <p className="text-muted">
                          Purchases and Payments will automatically populate here. You can also record entries manually.
                        </p>
                        {isAdmin && (
                          <button className="btn btn-primary mt-3" onClick={handleOpenAddModal}>
                            <Plus size={16} /> Add Manual Entry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* STICKY EXCEL TOTALS & DUE BALANCE FOOTER */}
              <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 40 }}>
                {/* Row 1: Totals */}
                <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                  <td style={{ border: '1px solid #d1d5db', textAlign: 'center', position: 'sticky', bottom: '46px', background: '#f3f4f6', zIndex: 40 }}>=</td>
                  <td style={{ border: '1px solid #d1d5db', fontSize: '13px', color: '#111827', position: 'sticky', bottom: '46px', background: '#f3f4f6', zIndex: 40 }}>
                    TOTALS
                  </td>
                  <td
                    style={{
                      border: '1px solid #d1d5db',
                      textAlign: 'right',
                      fontSize: '14px',
                      color: '#059669',
                      fontFamily: 'monospace',
                      background: '#dcfce7',
                      position: 'sticky',
                      bottom: '46px',
                      zIndex: 40
                    }}
                  >
                    {formatCurrency(totalPayments, currency)}
                  </td>
                  <td
                    style={{
                      border: '1px solid #d1d5db',
                      textAlign: 'right',
                      fontSize: '14px',
                      color: '#2563eb',
                      fontFamily: 'monospace',
                      background: '#dbeafe',
                      position: 'sticky',
                      bottom: '46px',
                      zIndex: 40
                    }}
                  >
                    {formatCurrency(totalPurchases, currency)}
                  </td>
                  <td colSpan={isAdmin ? 2 : 1} style={{ border: '1px solid #d1d5db', fontSize: '12px', color: '#4b5563', position: 'sticky', bottom: '46px', background: '#f3f4f6', zIndex: 40 }}>
                    Sum of Payments (Col B) & Sum of Purchases (Col C)
                  </td>
                </tr>

                {/* Row 2: Final Purchase Amount Still Due (Purchases - Payments) */}
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ border: '1px solid #d1d5db', textAlign: 'center', color: finalAmountDue > 0 ? '#dc2626' : '#16a34a', position: 'sticky', bottom: 0, background: finalAmountDue > 0 ? '#fef2f2' : '#f0fdf4', zIndex: 41 }}>
                    ∑
                  </td>
                  <td
                    style={{
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: finalAmountDue > 0 ? '#991b1b' : '#166534',
                      textTransform: 'uppercase',
                      position: 'sticky',
                      bottom: 0,
                      background: finalAmountDue > 0 ? '#fef2f2' : '#f0fdf4',
                      zIndex: 41
                    }}
                  >
                    FINAL PURCHASE AMOUNT STILL DUE
                  </td>
                  <td
                    colSpan={2}
                    style={{
                      border: '1px solid #d1d5db',
                      textAlign: 'right',
                      fontSize: '16px',
                      fontWeight: 800,
                      color: finalAmountDue > 0 ? '#dc2626' : '#16a34a',
                      fontFamily: 'monospace',
                      padding: '8px 12px',
                      background: finalAmountDue > 0 ? '#fee2e2' : '#bbf7d0',
                      position: 'sticky',
                      bottom: 0,
                      zIndex: 41
                    }}
                  >
                    {formatCurrency(finalAmountDue > 0 ? finalAmountDue : 0, currency)}
                  </td>
                  <td colSpan={isAdmin ? 2 : 1} style={{ border: '1px solid #d1d5db', fontSize: '12px', color: '#374151', position: 'sticky', bottom: 0, background: finalAmountDue > 0 ? '#fef2f2' : '#f0fdf4', zIndex: 41 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {finalAmountDue > 0 ? (
                        <>
                          <AlertCircle size={14} style={{ color: '#dc2626' }} />
                          <span style={{ color: '#991b1b', fontWeight: 600 }}>
                            Calculation: Total Purchases ({formatCurrency(totalPurchases, currency)}) - Total Payments ({formatCurrency(totalPayments, currency)})
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={14} style={{ color: '#16a34a' }} />
                          <span style={{ color: '#166534', fontWeight: 600 }}>
                            All recorded purchases have been paid in full!
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* CREATE / EDIT MANUAL LEDGER ENTRY MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <BookOpen size={18} style={{ color: 'var(--primary-600)' }} />
                {editingEntry ? 'Edit Ledger Entry' : 'Record Ledger Entry'}
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitModal}>
              <div className="modal-body form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                
                {/* Date */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Transaction Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>

                {/* Payment Amount */}
                <div className="form-group">
                  <label className="form-label" style={{ color: '#059669' }}>
                    Payment Amount ({currency})
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0"
                    value={form.payment}
                    onChange={(e) => setForm({ ...form, payment: e.target.value })}
                  />
                  <span className="form-hint">Amount paid to supplier</span>
                </div>

                {/* Purchase Amount */}
                <div className="form-group">
                  <label className="form-label" style={{ color: '#2563eb' }}>
                    Purchase Amount ({currency})
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0"
                    value={form.purchase}
                    onChange={(e) => setForm({ ...form, purchase: e.target.value })}
                  />
                  <span className="form-hint">Amount of stock purchased</span>
                </div>

                {/* Supplier Name */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">
                    Supplier Name <span className="text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Acme Supplies, Global Traders"
                    value={form.supplierName}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">
                    Description / Note <span className="text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Partial cash payment, Invoice #402"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="loading-spinner" /> : <Save size={16} />}
                  {editingEntry ? 'Save Changes' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
