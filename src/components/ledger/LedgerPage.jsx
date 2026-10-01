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
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { listenLedgerEntries, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry } from '../../services/ledgerService';
import { getSuppliers } from '../../services/supplierService';
import FilterPanel from '../common/FilterPanel';

export default function LedgerPage() {
  const { companyId, companyInfo, isAdmin, currentUser, userProfile } = useAuth();
  const toast = useToast();

  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [dbSuppliers, setDbSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionType, setTransactionType] = useState('all');

  const currency = companyInfo?.currency || 'Rs';

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);

    // Fetch registered suppliers
    getSuppliers(companyId)
      .then((sups) => setDbSuppliers(sups))
      .catch((err) => console.error('Failed to load suppliers:', err));

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

  // Consolidate all 3 sources (Purchases, Payments, and Manual Ledger Entries) as individual rows
  const combinedEntries = useMemo(() => {
    const rows = [];

    // Add Purchases as individual rows
    purchases.forEach((p) => {
      const ts = p.createdAt || Date.now();
      const dateStr = new Date(ts).toISOString().split('T')[0];

      rows.push({
        id: `pur-${p.id}`,
        source: 'purchase',
        date: dateStr,
        timestamp: ts,
        payment: 0,
        purchase: Number(p.grandTotal) || 0,
        supplierName: p.supplierName || '',
        description: `Stock Purchase ${p.reference ? `(${p.reference})` : ''} ${p.notes ? `- ${p.notes}` : ''}`.trim(),
        isEditable: false
      });
    });

    // Add Payments as individual rows
    payments.forEach((pay) => {
      const ts = pay.createdAt || Date.now();
      const dateStr = new Date(ts).toISOString().split('T')[0];

      rows.push({
        id: `pay-${pay.id}`,
        source: 'payment',
        date: dateStr,
        timestamp: ts,
        payment: Number(pay.amount) || 0,
        purchase: 0,
        supplierName: pay.supplierName || '',
        description: `Supplier Payment ${pay.paymentMethod ? `via ${pay.paymentMethod}` : ''} ${pay.reference ? `(${pay.reference})` : ''} ${pay.notes ? `- ${pay.notes}` : ''}`.trim(),
        isEditable: false
      });
    });

    // Add Manual Ledger Entries
    ledgerEntries.forEach((entry) => {
      const ts = entry.createdAt || (entry.date ? new Date(entry.date).getTime() : Date.now());
      const dateStr = entry.date || new Date(ts).toISOString().split('T')[0];
      const purVal = Number(entry.purchase) || 0;
      const payVal = Number(entry.payment) || 0;

      // If BOTH Purchase and Payment are entered in a single manual entry:
      // Show Purchase on 1st row, Payment on 2nd row!
      if (purVal > 0 && payVal > 0) {
        rows.push({
          id: `${entry.id}-pur`,
          source: 'manual-pur',
          date: dateStr,
          timestamp: ts,
          payment: 0,
          purchase: purVal,
          supplierName: entry.supplierName || '',
          description: entry.description ? `Purchase: ${entry.description}` : 'Manual Stock Purchase',
          isEditable: true,
          raw: entry
        });
        rows.push({
          id: `${entry.id}-pay`,
          source: 'manual-pay',
          date: dateStr,
          timestamp: ts + 1, // Purchase 1st row, Payment 2nd row
          payment: payVal,
          purchase: 0,
          supplierName: entry.supplierName || '',
          description: entry.description ? `Payment: ${entry.description}` : 'Manual Supplier Payment',
          isEditable: true,
          raw: entry
        });
      } else if (purVal > 0) {
        rows.push({
          id: entry.id,
          source: 'manual',
          date: dateStr,
          timestamp: ts,
          payment: 0,
          purchase: purVal,
          supplierName: entry.supplierName || '',
          description: entry.description || 'Manual Stock Purchase',
          isEditable: true,
          raw: entry
        });
      } else {
        rows.push({
          id: entry.id,
          source: 'manual',
          date: dateStr,
          timestamp: ts,
          payment: payVal,
          purchase: 0,
          supplierName: entry.supplierName || '',
          description: entry.description || 'Manual Supplier Payment',
          isEditable: true,
          raw: entry
        });
      }
    });

    // Sort rows chronologically by timestamp
    return rows.sort((a, b) => a.timestamp - b.timestamp);
  }, [purchases, payments, ledgerEntries]);

  // Supplier List for filtering and modal dropdown
  const allSuppliers = useMemo(() => {
    const list = new Set();
    dbSuppliers.forEach((s) => (s.name || s.supplierName) && list.add(s.name || s.supplierName));
    purchases.forEach((p) => p.supplierName && list.add(p.supplierName));
    payments.forEach((p) => p.supplierName && list.add(p.supplierName));
    ledgerEntries.forEach((e) => e.supplierName && list.add(e.supplierName));
    return Array.from(list).sort();
  }, [dbSuppliers, purchases, payments, ledgerEntries]);

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
        if (row.supplierName !== selectedSupplier) return false;
      }

      // Filter Transaction Type
      if (transactionType === 'payment' && row.payment <= 0) return false;
      if (transactionType === 'purchase' && row.purchase <= 0) return false;

      // Filter Search Text (searches date string, formatted date & time, supplier, description)
      if (search) {
        const q = search.toLowerCase();
        const formattedDateStr = formatDate(row.date).toLowerCase();
        const formattedDateTimeStr = formatDateTime(row.timestamp).toLowerCase();
        const rawDateStr = (row.date || '').toLowerCase();
        const matchesDate = rawDateStr.includes(q) || formattedDateStr.includes(q) || formattedDateTimeStr.includes(q);
        const matchesSupplier = (row.supplierName || '').toLowerCase().includes(q);
        const matchesDetail = (row.description || '').toLowerCase().includes(q) ||
          String(row.payment).includes(q) ||
          String(row.purchase).includes(q);
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

  // Export CSV functionality
  const handleExportCSV = () => {
    if (filteredRows.length === 0) {
      toast.info('No ledger data to export');
      return;
    }

    let csvContent = 'Date & Time,Payment,Purchase,Supplier,Details\n';
    filteredRows.forEach((r) => {
      const dtStr = formatDateTime(r.timestamp);
      csvContent += `"${dtStr}",${r.payment},${r.purchase},"${r.supplierName || 'N/A'}","${r.description || ''}"\n`;
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
            Excel-style 3-column financial ledger (Date & Time, Payment, Purchase) with detailed tracking
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} /> Export CSV
          </button>
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
            justifyContent: 'space-between'
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
                  <th style={{ border: '1px solid #e5e7eb', width: '250px', padding: '4px', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>A (DATE & TIME)</th>
                  <th style={{ border: '1px solid #e5e7eb', width: '220px', padding: '4px', textAlign: 'right', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>B (PURCHASE)</th>
                  <th style={{ border: '1px solid #e5e7eb', width: '220px', padding: '4px', textAlign: 'right', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>C (PAYMENT)</th>
                  <th style={{ border: '1px solid #e5e7eb', padding: '4px', textAlign: 'left', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>SUPPLIER / DETAILS</th>
                  {isAdmin && <th style={{ border: '1px solid #e5e7eb', width: '90px', padding: '4px', textAlign: 'center', position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 30 }}>ACTION</th>}
                </tr>

                {/* Primary Column Names */}
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ border: '1px solid #e5e7eb', textAlign: 'center', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>#</th>
                  <th style={{ border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 700, color: '#111827', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} style={{ color: '#4b5563' }} /> Date & Time
                    </div>
                  </th>
                  <th style={{ border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 700, color: '#2563eb', textAlign: 'right', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>
                    Purchase ({currency})
                  </th>
                  <th style={{ border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 700, color: '#059669', textAlign: 'right', position: 'sticky', top: '25px', background: '#f9fafb', zIndex: 30 }}>
                    Payment ({currency})
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
                    return (
                      <tr
                        key={row.id + idx}
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

                        {/* COLUMN A: DATE & TIME */}
                        <td
                          style={{
                            border: '1px solid #e5e7eb',
                            fontWeight: 600,
                            color: '#1f2937',
                            fontSize: '13px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {formatDateTime(row.timestamp)}
                        </td>

                        {/* COLUMN B: PURCHASE */}
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

                        {/* COLUMN C: PAYMENT */}
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

                        {/* SUPPLIER & DETAILS */}
                        <td style={{ border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {row.supplierName && (
                              <span style={{ fontWeight: 600, color: '#111827' }}>
                                Supplier: {row.supplierName}
                              </span>
                            )}
                            <span className="text-xs text-muted">
                              {row.description}
                            </span>
                          </div>
                        </td>

                        {/* ACTIONS FOR EDITABLE MANUAL ENTRIES */}
                        {isAdmin && (
                          <td style={{ border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            {row.isEditable ? (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                <button
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => handleOpenEditModal(row.raw)}
                                  title="Edit manual entry"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs text-danger"
                                  onClick={() => handleDeleteEntry(row.raw.id)}
                                  title="Delete manual entry"
                                >
                                  <Trash2 size={12} />
                                </button>
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
                          Purchases and Payments will automatically populate here.
                        </p>
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
                  <td colSpan={isAdmin ? 2 : 1} style={{ border: '1px solid #d1d5db', fontSize: '12px', color: '#4b5563', position: 'sticky', bottom: '46px', background: '#f3f4f6', zIndex: 40 }}>
                    Sum of Purchases & Sum of Payments
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

    </div>
  );
}
