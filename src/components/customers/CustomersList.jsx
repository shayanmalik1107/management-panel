import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Store, Edit, Trash2 } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { deleteCustomer } from '../../services/customerService';
import { formatCurrency, timeAgo } from '../../utils/formatters';

import FlatList from '../common/FlatList';

export default function CustomersList() {
  const { companyId, companyInfo, hasPermission, isAdmin, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const currency = companyInfo?.currency || 'Rs';
  const canCreate = hasPermission('createCustomers');
  const canEdit = hasPermission('editCustomers');
  const canDelete = hasPermission('deleteCustomers') || isAdmin;
  const canViewBalance = hasPermission('viewCustomerBalance');

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const customersRef = ref(database, `companies/${companyId}/customers`);

    const unsubscribe = onValue(customersRef, (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push({ id: child.key, ...child.val() });
        });
      }
      // Sort by shopName alphabetically
      list.sort((a, b) => (a.shopName || '').localeCompare(b.shopName || ''));
      setCustomers(list);
      setLoading(false);
    }, (err) => {
      console.error('Customers listener error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  const filteredCustomers = customers.filter(c => {
    const matchesOwner = isAdmin || (c.createdBy === currentUser?.uid || c.createdByName === userProfile?.name);
    const matchesSearch =
      c.shopName?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson?.toLowerCase().includes(search.toLowerCase());
    return matchesOwner && matchesSearch;
  });

  const handleEdit = (e, customerId) => {
    e.stopPropagation();
    navigate(`/customers/${customerId}/edit`);
  };

  const handleDelete = async (e, customer) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete shop "${customer.shopName}"? This cannot be undone.`)) {
      try {
        await deleteCustomer(companyId, customer.id, customer.shopName, currentUser?.uid, userProfile?.name);
        toast.success(`Shop "${customer.shopName}" deleted successfully`);
      } catch (err) {
        toast.error('Failed to delete shop');
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Customers / Shops</h1>
          <p className="text-muted text-sm">Manage your clients and their balances</p>
        </div>
        <div className="page-header-actions">
          {canCreate && (
            <button className="btn btn-primary" onClick={() => navigate('/customers/new')}>
              <Plus size={16} /> Add Customer
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="table-search" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search customers by shop name, phone or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div>
          {loading ? (
            <div className="loading-page">
              <div className="loading-spinner lg"></div>
            </div>
          ) : (
            <FlatList
              data={filteredCustomers}
              rowHeight={60}
              maxHeight="calc(100vh - 280px)"
              keyExtractor={(c) => c.id}
              HeaderComponent={() => (
                <thead>
                  <tr>
                    <th>Shop / Customer</th>
                    <th>Contact Info</th>
                    <th>Orders</th>
                    {canViewBalance && <th>Outstanding Balance</th>}
                    <th>Last Order</th>
                    <th style={{ textAlign: 'right', paddingRight: 'var(--space-4)' }}>Actions</th>
                  </tr>
                </thead>
              )}
              renderItem={(customer) => (
                <>
                  <td onClick={() => navigate(`/customers/${customer.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="font-medium">{customer.shopName}</div>
                    {customer.contactPerson && <div className="text-xs text-muted">Contact: {customer.contactPerson}</div>}
                  </td>
                  <td onClick={() => navigate(`/customers/${customer.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="text-sm">{customer.phone || '—'}</div>
                    {customer.area && <div className="text-xs text-muted">{customer.area}</div>}
                  </td>
                  <td onClick={() => navigate(`/customers/${customer.id}`)} style={{ cursor: 'pointer' }}>{customer.totalOrders || 0}</td>
                  {canViewBalance && (
                    <td onClick={() => navigate(`/customers/${customer.id}`)} style={{ cursor: 'pointer' }} className="font-medium" style={{ color: customer.currentBalance > 0 ? 'var(--warning-600)' : 'inherit' }}>
                      {formatCurrency(customer.currentBalance, currency)}
                    </td>
                  )}
                  <td onClick={() => navigate(`/customers/${customer.id}`)} style={{ cursor: 'pointer' }} className="text-sm text-muted">
                    {customer.lastOrderDate ? timeAgo(customer.lastOrderDate) : 'Never'}
                  </td>
                  <td style={{ textAlign: 'right', width: 100, paddingRight: 'var(--space-4)' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      {canEdit && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="Edit Shop"
                          style={{ padding: '4px 6px' }}
                          onClick={(e) => handleEdit(e, customer.id)}
                        >
                          <Edit size={16} style={{ color: 'var(--primary-600)' }} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="Delete Shop"
                          style={{ padding: '4px 6px' }}
                          onClick={(e) => handleDelete(e, customer)}
                        >
                          <Trash2 size={16} style={{ color: 'var(--danger-500)' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </>
              )}
              EmptyComponent={() => (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Store size={24} />
                  </div>
                  <h3>No customers found</h3>
                  <p>Add your first customer to start creating orders.</p>
                  {canCreate && (
                    <button className="btn btn-primary mt-4" onClick={() => navigate('/customers/new')}>
                      <Plus size={16} /> Add Customer
                    </button>
                  )}
                </div>
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
