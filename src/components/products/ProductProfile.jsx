import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Package, AlertTriangle, TrendingUp, DollarSign, Trash2, Warehouse } from 'lucide-react';
import { getProduct, deleteProduct } from '../../services/productService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function ProductProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId, companyInfo, isAdmin, currentUser, userProfile } = useAuth();
  const toast = useToast();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const currency = companyInfo?.currency || 'Rs';

  useEffect(() => {
    if (!companyId || !id) return;
    loadProduct();
  }, [companyId, id]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const data = await getProduct(companyId, id);
      if (!data) {
        toast.error('Product not found');
        navigate('/products');
        return;
      }
      setProduct(data);
    } catch (err) {
      toast.error('Failed to load product details');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"? This will permanently remove it from database.`)) {
      return;
    }

    try {
      await deleteProduct(companyId, id, product.name, currentUser?.uid, userProfile?.name || 'User');
      toast.success(`Product "${product.name}" deleted successfully`);
      navigate('/products');
    } catch (err) {
      console.error('Failed to delete product:', err);
      toast.error(err.message || 'Failed to delete product');
    }
  };

  if (loading) {
    return <div className="loading-page"><div className="loading-spinner lg"></div></div>;
  }

  if (!product) return null;

  const isLowStock = product.currentStock <= (product.minimumStock || 0);
  const isOutOfStock = product.currentStock <= 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/products')}>
              <ArrowLeft size={14} /> Back to Products
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1>{product.name}</h1>
            {isOutOfStock ? (
              <span className="badge badge-red">Out of Stock</span>
            ) : isLowStock ? (
              <span className="badge badge-orange">Low Stock</span>
            ) : (
              <span className="badge badge-green">In Stock</span>
            )}
          </div>
          {product.sku && <p className="text-muted text-sm">SKU: {product.sku}</p>}
        </div>
        <div className="page-header-actions">
          {isAdmin && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className="btn btn-ghost"
                onClick={handleDelete}
                style={{ color: 'var(--danger-600)' }}
                title="Delete Product"
              >
                <Trash2 size={16} /> Delete
              </button>
              <button className="btn btn-primary" onClick={() => navigate(`/products/${id}/edit`)}>
                <Edit size={16} /> Edit Product
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2col-responsive">
        
        {/* Basic Info Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Product Information</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <div className="text-sm text-muted">Storage Warehouse</div>
                  <div className="font-medium text-primary-600" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Warehouse size={16} />
                    <span>{product.warehouseName || 'Unassigned'}</span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted">Category</div>
                  <div className="font-medium">{product.category || 'Uncategorized'}</div>
                </div>
                
                {isAdmin && (
                  <div>
                    <div className="text-sm text-muted">Purchase Price (Cost)</div>
                    <div className="font-medium">{formatCurrency(product.purchasePrice, currency)}</div>
                  </div>
                )}
                
                <div>
                  <div className="text-sm text-muted">Sale Price</div>
                  <div className="font-medium text-primary-600" style={{ fontSize: 'var(--font-size-lg)' }}>
                    {formatCurrency(product.salePrice, currency)}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted">Added On</div>
                  <div className="font-medium">{formatDate(product.createdAt)}</div>
                </div>
              </div>
            </div>
          </div>
          
          {product.description && (
            <div className="card">
              <div className="card-header"><span className="card-title">Description</span></div>
              <div className="card-body text-sm" style={{ whiteSpace: 'pre-wrap', color: 'var(--gray-700)' }}>
                {product.description}
              </div>
            </div>
          )}
        </div>

        {/* Stats and Inventory */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <div className="stat-cards grid-2col-equal">
            <div className="stat-card" style={{ borderColor: isOutOfStock ? 'var(--danger-200)' : isLowStock ? 'var(--warning-200)' : 'transparent' }}>
              <div className="stat-card-header">
                <span className="stat-card-label">Current Stock</span>
                <div className={`stat-card-icon ${isOutOfStock ? 'red' : isLowStock ? 'orange' : 'green'}`}>
                  <Package size={18} />
                </div>
              </div>
              <div className="stat-card-value">{product.currentStock} pcs</div>
              <div className="text-xs text-muted mt-1">Minimum required: {product.minimumStock || 0}</div>
            </div>
            
            {isAdmin && (
              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-label">Potential Revenue (Current Stock)</span>
                  <div className="stat-card-icon blue"><DollarSign size={18} /></div>
                </div>
                <div className="stat-card-value">{formatCurrency((product.currentStock * product.salePrice) || 0, currency)}</div>
              </div>
            )}
          </div>
          
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Stock Movements</span>
              {isAdmin && (
                <button className="btn btn-link btn-sm" onClick={() => navigate('/inventory')}>View Inventory</button>
              )}
            </div>
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <TrendingUp size={24} style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }} />
              <p className="text-sm text-muted">Stock movements will appear here when you create orders or purchases.</p>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
