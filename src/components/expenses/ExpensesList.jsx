import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Plus, Search, Filter, User } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import FilterPanel from '../common/FilterPanel';

export default function ExpensesList() {
  const { companyId, companyInfo, isAdmin } = useAuth();
  const navigate = useNavigate();
  const currency = companyInfo?.currency || 'Rs';

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters State
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCreatedBy, setSelectedCreatedBy] = useState('all');

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const expensesRef = ref(database, `companies/${companyId}/expenses`);

    const unsubscribe = onValue(expensesRef, (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push({ id: child.key, ...child.val() });
        });
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setExpenses(list);
      setLoading(false);
    }, (err) => {
      console.error('Expenses listener error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  // Dynamic Category Options
  const categoryOptions = useMemo(() => {
    const map = new Map();
    expenses.forEach(e => {
      if (e.category) map.set(e.category, e.category);
    });
    const list = Array.from(map.keys()).map(cat => ({ value: cat, label: cat }));
    return [{ value: 'all', label: 'All Categories' }, ...list];
  }, [expenses]);

  // Dynamic Created By Options
  const createdByOptions = useMemo(() => {
    const map = new Map();
    expenses.forEach(e => {
      if (e.createdByName) map.set(e.createdByName, e.createdByName);
    });
    const list = Array.from(map.keys()).map(name => ({ value: name, label: name }));
    return [{ value: 'all', label: 'All Users' }, ...list];
  }, [expenses]);

  const handleResetFilters = () => {
    setSearch('');
    setPeriod('');
    setQuickFilter('');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('all');
    setSelectedCreatedBy('all');
  };

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch =
      !search ||
      e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase()) ||
      e.createdByName?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      !selectedCategory || selectedCategory === 'all' ||
      e.category === selectedCategory;

    const matchesCreatedBy =
      !selectedCreatedBy || selectedCreatedBy === 'all' ||
      e.createdByName === selectedCreatedBy;

    let matchesDate = true;
    if (e.createdAt) {
      const expDateStr = new Date(e.createdAt).toISOString().split('T')[0];
      if (startDate && expDateStr < startDate) matchesDate = false;
      if (endDate && expDateStr > endDate) matchesDate = false;
    }

    return matchesSearch && matchesCategory && matchesCreatedBy && matchesDate;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Expenses</h1>
          <p className="text-muted text-sm">Track your overhead and operational costs</p>
        </div>
        <div className="page-header-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => navigate('/expenses/new')}>
              <Plus size={16} /> Record Expense
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Expense Filters Panel */}
      <FilterPanel
        title="Expense Filters"
        subtitle="Filter and analyze operational expenses by date range & category"
        icon={Filter}
        period={period}
        setPeriod={setPeriod}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        dropdown1Label="Category"
        dropdown1Value={selectedCategory}
        setDropdown1Value={setSelectedCategory}
        dropdown1Options={categoryOptions}
        dropdown1Icon={Receipt}
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
              placeholder="Search expenses by title or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading-page">
              <div className="loading-spinner lg"></div>
            </div>
          ) : filteredExpenses.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title / Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(expense => (
                  <tr key={expense.id}>
                    <td className="text-sm text-muted">{formatDate(expense.createdAt)}</td>
                    <td className="font-medium">{expense.title || expense.description}</td>
                    <td>{expense.category}</td>
                    <td className="font-semibold">{formatCurrency(expense.amount, currency)}</td>
                    <td className="text-sm">{expense.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Receipt size={24} />
              </div>
              <h3>No expenses recorded</h3>
              <p>Track rent, utility bills, and other overhead costs here.</p>
              {isAdmin && (
                <button className="btn btn-primary mt-4" onClick={() => navigate('/expenses/new')}>
                  <Plus size={16} /> Record Expense
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
