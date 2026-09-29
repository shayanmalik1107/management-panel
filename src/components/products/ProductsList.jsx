import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Package, Edit, Trash2, RefreshCw, Warehouse, Filter } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { deleteProduct, cleanUpDuplicateProducts } from '../../services/productService';
import { listenWarehouses } from '../../services/warehouseService';
import { formatCurrency } from '../../utils/formatters';
import FilterPanel from '../common/FilterPanel';
import FlatList from '../common/FlatList';

export default function ProductsList() {
  const { companyId, companyInfo, isAdmin, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [search, setSearch] = useState('');

  // Filters State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [period, setPeriod] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const currency = companyInfo?.currency || 'Rs';

  useEffect(() => {
    if (!companyId) return;

    // Run automatic cleanup of duplicate/nameless entries in Firebase
    cleanUpDuplicateProducts(companyId).catch(console.error);

    setLoading(true);

    // Listen to warehouses
    const unsubWarehouses = listenWarehouses(companyId, (data) => {
      setWarehouses(data);
    });

    // Listen to products
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
      // Sort by name
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setProducts(list);
      setLoading(false);
    }, (err) => {
      console.error('Products listener error:', err);
      setLoading(false);
    });

    return () => {
      unsubWarehouses();
      unsubProducts();
    };
  }, [companyId]);

  const handleCleanDuplicates = async () => {
    setCleaning(true);
    try {
      const removed = await cleanUpDuplicateProducts(companyId);
      if (removed > 0) {
        toast.success(`Cleaned up ${removed} invalid/duplicate product(s) from Firebase`);
      } else {
        toast.info('No duplicate or nameless products found');
      }
    } catch (err) {
      toast.error('Failed to clean up duplicate products');
    }
    setCleaning(false);
  };

  const handleDeleteProduct = async (e, product) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${product.name}"? This will permanently remove it from database.`)) {
      return;
    }

    try {
      await deleteProduct(
        companyId,
        product.id,
        product.name,
        currentUser?.uid,
        userProfile?.name || 'User'
      );
      toast.success(`Product "${product.name}" deleted successfully`);
    } catch (err) {
      console.error('Failed to delete product:', err);
      toast.error(err.message || 'Failed to delete product');
    }
  };

  // Warehouse options
  const warehouseOptions = useMemo(() => {
    const list = [{ value: 'all', label: `All Warehouses (${products.length})` }];
    warehouses.forEach(wh => {
      const count = products.filter(p => p.warehouseId === wh.id).length;
      list.push({ value: wh.id, label: `${wh.name} (${count})` });
    });
    if (products.some(p => !p.warehouseId)) {
      list.push({ value: 'unassigned', label: `Unassigned (${products.filter(p => !p.warehouseId).length})` });
    }
    return list;
  }, [warehouses, products]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedWarehouseId('all');
    setStockStatusFilter('all');
    setPeriod('');
    setQuickFilter('');
    setStartDate('');
    setEndDate('');
  };

  const filteredProducts = products.filter(p => {
    const matchesWarehouse =
      selectedWarehouseId === 'all'
        ? true
        : selectedWarehouseId === 'unassigned'
        ? !p.warehouseId
        : p.warehouseId === selectedWarehouseId;

    const isLowStock = p.currentStock <= (p.minimumStock || 0);
    const isOutOfStock = p.currentStock <= 0;

    let matchesStockStatus = true;
    if (stockStatusFilter === 'in_stock') matchesStockStatus = !isOutOfStock && !isLowStock;
    if (stockStatusFilter === 'low_stock') matchesStockStatus = isLowStock && !isOutOfStock;
    if (stockStatusFilter === 'out_of_stock') matchesStockStatus = isOutOfStock;

    const matchesSearch =
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()) ||
      p.warehouseName?.toLowerCase().includes(search.toLowerCase());

    return matchesWarehouse && matchesStockStatus && matchesSearch;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Products Catalog</h1>
          <p className="text-muted text-sm">Manage products, warehouse assignments, and pricing</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {isAdmin && (
            <>
              <button className="btn btn-secondary" onClick={handleCleanDuplicates} disabled={cleaning} title="Remove nameless or duplicate entries from Firebase">
                <RefreshCw size={14} className={cleaning ? 'spin' : ''} /> Clean Duplicates
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/products/new')}>
                <Plus size={16} /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapsible Catalog Filters Panel */}
      <FilterPanel
        title="Catalog Filters"
        subtitle="Filter products by stock status, category, and warehouse"
        icon={Filter}
        period={period}
        setPeriod={setPeriod}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        dropdown1Label="Warehouse"
        dropdown1Value={selectedWarehouseId}
        setDropdown1Value={setSelectedWarehouseId}
        dropdown1Options={warehouseOptions}
        dropdown1Icon={Warehouse}
        dropdown2Label="Stock Status"
        dropdown2Value={stockStatusFilter}
        setDropdown2Value={setStockStatusFilter}
        dropdown2Options={[
          { value: 'all', label: 'All Stock Levels' },
          { value: 'in_stock', label: 'In Stock' },
          { value: 'low_stock', label: 'Low Stock' },
          { value: 'out_of_stock', label: 'Out of Stock' }
        ]}
        dropdown2Icon={Package}
        onReset={handleResetFilters}
      />

      <div className="card">
        <div className="table-toolbar" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="table-search" style={{ flex: 1, minWidth: 260, maxWidth: 400 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search products by name, SKU, warehouse..."
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
              data={filteredProducts}
              rowHeight={52}
              maxHeight="calc(100vh - 280px)"
              keyExtractor={(product) => product.id}
              HeaderComponent={() => (
                <thead>
                  <tr>
                    <th>Product Details</th>
                    <th>Warehouse</th>
                    <th>Category</th>
                    {isAdmin && <th>Purchase Price</th>}
                    <th>Sale Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    {isAdmin && <th style={{ width: 160 }}>Actions</th>}
                  </tr>
                </thead>
              )}
              renderItem={(product) => {
                const isLowStock = product.currentStock <= (product.minimumStock || 0);
                const isOutOfStock = product.currentStock <= 0;
                const assignedWh = warehouses.find(w => w.id === product.warehouseId);
                const displayWhName = assignedWh ? assignedWh.name : (product.warehouseName || 'Unassigned');

                return (
                  <>
                    <td onClick={() => navigate(`/products/${product.id}`)}>
                      <div className="font-medium">{product.name}</div>
                      {product.sku && <div className="text-xs text-muted">SKU: {product.sku}</div>}
                    </td>
                    <td onClick={() => navigate(`/products/${product.id}`)}>
                      <span className={`badge ${assignedWh ? 'badge-blue' : 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Warehouse size={12} /> {displayWhName}
                      </span>
                    </td>
                    <td onClick={() => navigate(`/products/${product.id}`)}>{product.category || '—'}</td>
                    {isAdmin && <td onClick={() => navigate(`/products/${product.id}`)}>{formatCurrency(product.purchasePrice, currency)}</td>}
                    <td className="font-medium" onClick={() => navigate(`/products/${product.id}`)}>{formatCurrency(product.salePrice, currency)}</td>
                    <td onClick={() => navigate(`/products/${product.id}`)}>
                      {product.currentStock}{' '}
                      {String(product.unit) !== String(product.currentStock) ? product.unit || '' : ''}
                    </td>
                    <td onClick={() => navigate(`/products/${product.id}`)}>
                      {isOutOfStock ? (
                        <span className="badge badge-red"><span className="badge-dot" />Out of Stock</span>
                      ) : isLowStock ? (
                        <span className="badge badge-orange"><span className="badge-dot" />Low Stock</span>
                      ) : (
                        <span className="badge badge-green"><span className="badge-dot" />In Stock</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => { e.stopPropagation(); navigate(`/products/${product.id}/edit`); }}
                            title="Edit Product"
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={(e) => handleDeleteProduct(e, product)}
                            style={{ color: 'var(--danger-600)' }}
                            title="Delete Product"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </>
                );
              }}
              EmptyComponent={() => (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Package size={24} />
                  </div>
                  <h3>No products found</h3>
                  <p>Add products to start managing stock and creating orders.</p>
                  {isAdmin && (
                    <button className="btn btn-primary mt-4" onClick={() => navigate('/products/new')}>
                      <Plus size={16} /> Add Product
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
