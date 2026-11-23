import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Warehouse,
  Plus,
  Search,
  Package,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  Layers,
  X,
  Save
} from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import {
  listenWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse
} from '../../services/warehouseService';
import FlatList from '../common/FlatList';

export default function InventoryPage() {
  const { companyId, companyInfo, isAdmin, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    creationDate: new Date().toISOString().split('T')[0],
    address: '',
    notes: ''
  });

  const currency = companyInfo?.currency || 'Rs';

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);

    // 1. Listen to Warehouses
    const unsubWarehouses = listenWarehouses(
      companyId,
      (data) => {
        setWarehouses(data);
      },
      (err) => {
        console.error('Error listening to warehouses:', err);
        toast.error('Failed to load warehouses');
      }
    );

    // 2. Listen to Products
    const productsRef = ref(database, `companies/${companyId}/products`);
    const unsubProducts = onValue(productsRef, (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();
          if (val && val.name && String(val.name).trim()) {
            list.push({ id: child.key, ...val });
          }
        });
      }
      setProducts(list);
      setLoading(false);
    });

    return () => {
      unsubWarehouses();
      unsubProducts();
    };
  }, [companyId]);

  // Open Modal for Add
  const handleOpenAddModal = () => {
    setEditingWarehouse(null);
    setForm({
      name: '',
      creationDate: new Date().toISOString().split('T')[0],
      address: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (wh) => {
    setEditingWarehouse(wh);
    setForm({
      name: wh.name || '',
      creationDate: wh.creationDate || new Date().toISOString().split('T')[0],
      address: wh.address || '',
      notes: wh.notes || ''
    });
    setIsModalOpen(true);
  };

  // Handle Save Warehouse
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Warehouse name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingWarehouse) {
        await updateWarehouse(
          companyId,
          editingWarehouse.id,
          form,
          currentUser?.uid,
          userProfile?.name || 'User'
        );
        toast.success(`Warehouse "${form.name.trim()}" updated successfully`);
      } else {
        await createWarehouse(
          companyId,
          form,
          currentUser?.uid,
          userProfile?.name || 'User'
        );
        toast.success(`Warehouse "${form.name.trim()}" created successfully`);
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save warehouse');
    }
    setSubmitting(false);
  };

  // Handle Delete Warehouse
  const handleDeleteWarehouse = async (wh) => {
    const assignedProducts = products.filter(p => p.warehouseId === wh.id);
    let confirmMsg = `Are you sure you want to delete warehouse "${wh.name}"?`;
    if (assignedProducts.length > 0) {
      confirmMsg += `\n\nWarning: ${assignedProducts.length} product(s) are currently assigned to this warehouse. They will remain in database but will need warehouse reassignment.`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteWarehouse(
        companyId,
        wh.id,
        wh.name,
        currentUser?.uid,
        userProfile?.name || 'User'
      );
      toast.success(`Warehouse "${wh.name}" deleted successfully`);
      if (selectedWarehouseId === wh.id) {
        setSelectedWarehouseId('all');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete warehouse');
    }
  };

  // Helper metrics calculation
  const getWarehouseMetrics = (whId) => {
    const whProducts = products.filter(p => p.warehouseId === whId);
    const totalUnits = whProducts.reduce((sum, p) => sum + (Number(p.currentStock) || 0), 0);
    const totalValue = whProducts.reduce((sum, p) => sum + ((Number(p.currentStock) || 0) * (Number(p.salePrice) || 0)), 0);
    return {
      productCount: whProducts.length,
      totalUnits,
      totalValue
    };
  };

  // Unassigned products count (products created before warehouse or without warehouseId)
  const unassignedProducts = products.filter(p => !p.warehouseId);
  const totalStockUnits = products.reduce((sum, p) => sum + (Number(p.currentStock) || 0), 0);
  const totalStockValue = products.reduce((sum, p) => sum + ((Number(p.currentStock) || 0) * (Number(p.salePrice) || 0)), 0);

  // Filter products for display
  const filteredProducts = products.filter(p => {
    const matchesWarehouse =
      selectedWarehouseId === 'all'
        ? true
        : selectedWarehouseId === 'unassigned'
        ? !p.warehouseId
        : p.warehouseId === selectedWarehouseId;

    const matchesSearch =
      !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesWarehouse && matchesSearch;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Warehouse Management</h1>
          <p className="text-muted text-sm">
            Organize storage houses, assign products to dedicated warehouses, and track stock levels
          </p>
        </div>
        <div className="page-header-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={handleOpenAddModal}>
              <Plus size={16} /> Add Warehouse
            </button>
          )}
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Warehouses</span>
            <div className="stat-card-icon blue">
              <Warehouse size={18} />
            </div>
          </div>
          <div className="stat-card-value">{warehouses.length}</div>
          <div className="text-xs text-muted mt-1">
            {warehouses.length === 1 ? '1 Storage House active' : `${warehouses.length} Storage Houses active`}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Catalog Products</span>
            <div className="stat-card-icon green">
              <Package size={18} />
            </div>
          </div>
          <div className="stat-card-value">{products.length}</div>
          <div className="text-xs text-muted mt-1">
            {unassignedProducts.length > 0 ? `${unassignedProducts.length} unassigned to warehouse` : 'All products assigned'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Stock Quantity</span>
            <div className="stat-card-icon orange">
              <Layers size={18} />
            </div>
          </div>
          <div className="stat-card-value">{totalStockUnits}</div>
          <div className="text-xs text-muted mt-1">Total physical units stored</div>
        </div>

        {isAdmin && (
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Total Inventory Valuation</span>
              <div className="stat-card-icon green">
                <Package size={18} />
              </div>
            </div>
            <div className="stat-card-value">{formatCurrency(totalStockValue, currency)}</div>
            <div className="text-xs text-muted mt-1">Estimated total inventory value</div>
          </div>
        )}
      </div>

      {/* Warehouses Grid Section */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Your Storage Warehouses</h2>
          <span className="text-sm text-muted">
            {warehouses.length === 0
              ? 'No warehouses created yet'
              : warehouses.length === 1
              ? '1 Warehouse registered (Pre-selected on product creation)'
              : `${warehouses.length} Warehouses registered (Dropdown selection on product creation)`}
          </span>
        </div>

        {loading ? (
          <div className="loading-page"><div className="loading-spinner md"></div></div>
        ) : warehouses.length === 0 ? (
          <div className="card">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <Warehouse size={40} style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-3)' }} />
              <h3>No Warehouses Added Yet</h3>
              <p className="text-muted" style={{ maxWidth: 480, margin: '0 auto var(--space-4)' }}>
                Add your storage houses (warehouses) where you keep your goods. Once created, you will be able to select which warehouse a product is saved to when adding or editing products.
              </p>
              {isAdmin && (
                <button className="btn btn-primary" onClick={handleOpenAddModal}>
                  <Plus size={16} /> Add First Warehouse
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {warehouses.map(wh => {
              const metrics = getWarehouseMetrics(wh.id);
              const isSelected = selectedWarehouseId === wh.id;

              return (
                <div
                  key={wh.id}
                  className="card"
                  style={{
                    border: isSelected ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)'
                  }}
                >
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0 }}>
                            {wh.name}
                          </h3>
                          {warehouses.length === 1 && (
                            <span className="badge badge-blue" style={{ fontSize: '10px' }}>
                              Pre-selected
                            </span>
                          )}
                        </div>
                        {wh.creationDate && (
                          <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                            <Calendar size={12} /> Created: {wh.creationDate}
                          </div>
                        )}
                      </div>

                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleOpenEditModal(wh)}
                            title="Edit Warehouse"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon text-danger"
                            onClick={() => handleDeleteWarehouse(wh)}
                            title="Delete Warehouse"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {wh.address ? (
                      <div className="text-sm text-muted" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                        <MapPin size={14} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--gray-500)' }} />
                        <span>{wh.address}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted" style={{ fontStyle: 'italic', marginBottom: 'var(--space-4)' }}>
                        No address specified (Optional)
                      </div>
                    )}

                    <div className="form-grid-2col" style={{ background: 'var(--gray-50)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)' }}>
                      <div>
                        <div className="text-xs text-muted">Stored Products</div>
                        <div className="font-semibold text-gray-900">{metrics.productCount} items</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Stock Quantity</div>
                        <div className="font-semibold text-primary-600">{metrics.totalUnits} units</div>
                      </div>
                    </div>

                    <button
                      className={`btn btn-block ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => setSelectedWarehouseId(isSelected ? 'all' : wh.id)}
                    >
                      {isSelected ? '✓ Viewing Stored Products' : 'View Products in Warehouse'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Warehouse Products Inventory Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="card-title">Products Inventory by Storage Warehouse</span>
            <p className="text-xs text-muted" style={{ marginTop: '2px' }}>
              Showing {filteredProducts.length} product(s)
              {selectedWarehouseId !== 'all' && (
                <button
                  className="btn btn-link btn-xs"
                  onClick={() => setSelectedWarehouseId('all')}
                  style={{ marginLeft: 'var(--space-2)' }}
                >
                  Clear Filter (Show All)
                </button>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <div className="table-search" style={{ width: 240 }}>
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              style={{ width: 'auto', fontSize: 'var(--font-size-sm)' }}
            >
              <option value="all">All Warehouses ({products.length})</option>
              {warehouses.map(wh => {
                const count = products.filter(p => p.warehouseId === wh.id).length;
                return (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({count})
                  </option>
                );
              })}
              {unassignedProducts.length > 0 && (
                <option value="unassigned">Unassigned ({unassignedProducts.length})</option>
              )}
            </select>
          </div>
        </div>

        <div>
          <FlatList
            data={filteredProducts}
            rowHeight={52}
            maxHeight="500px"
            keyExtractor={(p) => p.id}
            HeaderComponent={() => (
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Dedicated Warehouse</th>
                  <th>Category</th>
                  <th>Sale Price</th>
                  <th>Current Stock</th>
                  <th>Status</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Action</th>}
                </tr>
              </thead>
            )}
            renderItem={(p) => {
              const isLowStock = p.currentStock <= (p.minimumStock || 0);
              const isOutOfStock = p.currentStock <= 0;
              const assignedWh = warehouses.find(w => w.id === p.warehouseId);
              const displayWhName = assignedWh ? assignedWh.name : (p.warehouseName || 'Unassigned');

              return (
                <>
                  <td onClick={() => navigate(`/products/${p.id}`)}>
                    <div className="font-medium">{p.name}</div>
                    {p.sku && <div className="text-xs text-muted">SKU: {p.sku}</div>}
                  </td>
                  <td onClick={() => navigate(`/products/${p.id}`)}>
                    <span
                      className={`badge ${assignedWh ? 'badge-blue' : 'badge-gray'}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Warehouse size={12} /> {displayWhName}
                    </span>
                  </td>
                  <td onClick={() => navigate(`/products/${p.id}`)}>{p.category || '—'}</td>
                  <td onClick={() => navigate(`/products/${p.id}`)}>{formatCurrency(p.salePrice, currency)}</td>
                  <td className="font-medium" onClick={() => navigate(`/products/${p.id}`)}>
                    {p.currentStock} {p.unit || ''}
                  </td>
                  <td onClick={() => navigate(`/products/${p.id}`)}>
                    {isOutOfStock ? (
                      <span className="badge badge-red"><span className="badge-dot" />Out of Stock</span>
                    ) : isLowStock ? (
                      <span className="badge badge-orange"><span className="badge-dot" />Low Stock</span>
                    ) : (
                      <span className="badge badge-green"><span className="badge-dot" />In Stock</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/products/${p.id}/edit`)}
                        title="Edit product / Change warehouse"
                      >
                        <Edit size={14} /> Change Warehouse
                      </button>
                    </td>
                  )}
                </>
              );
            }}
            EmptyComponent={() => (
              <div className="empty-state">
                <Package size={28} style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }} />
                <h3>No products found for this view</h3>
                <p className="text-muted">
                  {selectedWarehouseId !== 'all'
                    ? 'No products are currently assigned to this warehouse.'
                    : 'No products matched your search filter.'}
                </p>
                {isAdmin && (
                  <button
                    className="btn btn-primary mt-3"
                    onClick={() => navigate('/products/new')}
                  >
                    <Plus size={16} /> Add Product to Warehouse
                  </button>
                )}
              </div>
            )}
          />
        </div>
      </div>

      {/* CREATE / EDIT WAREHOUSE MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Warehouse size={18} style={{ color: 'var(--primary-600)' }} />
                {editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}
              </h3>
              <button
                className="modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body form-grid" style={{ gridTemplateColumns: '1fr' }}>
                
                {/* Creation Date */}
                <div className="form-group">
                  <label className="form-label">Creation Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.creationDate}
                    onChange={(e) => setForm({ ...form, creationDate: e.target.value })}
                  />
                  <span className="form-hint">Date when this warehouse / storage house was created</span>
                </div>

                {/* Warehouse Name */}
                <div className="form-group">
                  <label className="form-label">Warehouse Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Storage House A, Central Warehouse, North Depot"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                  />
                </div>

                {/* Address (Optional) */}
                <div className="form-group">
                  <label className="form-label">
                    Address <span className="text-muted font-normal">(Optional)</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    placeholder="Physical address or location details of the storage house..."
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    rows={2}
                  />
                </div>

                {/* Notes (Optional) */}
                <div className="form-group">
                  <label className="form-label">
                    Notes / Contact Details <span className="text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Managed by Ali, Keyholder info..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? <span className="loading-spinner" /> : <Save size={16} />}
                  {editingWarehouse ? 'Save Changes' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
