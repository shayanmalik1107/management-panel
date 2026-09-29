import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Warehouse, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createProduct, getProduct, updateProduct } from '../../services/productService';
import { getWarehouses, createWarehouse } from '../../services/warehouseService';

export default function ProductForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const { companyId, currentUser, userProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [showQuickWarehouse, setShowQuickWarehouse] = useState(false);
  const [newWhName, setNewWhName] = useState('');
  const [creatingWh, setCreatingWh] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    purchasePrice: 0,
    salePrice: 0,
    currentStock: 0,
    minimumStock: 0,
    unit: 'pcs',
    warehouseId: '',
    warehouseName: ''
  });

  useEffect(() => {
    if (!companyId) return;
    if (!isAdmin) {
      toast.error('Only admins can manage products');
      navigate('/products');
      return;
    }
    
    initForm();
  }, [companyId, id]);

  const initForm = async () => {
    setInitialLoading(true);
    try {
      // 1. Fetch Warehouses
      const whList = await getWarehouses(companyId);
      setWarehouses(whList);

      let loadedProduct = null;
      if (isEditing) {
        loadedProduct = await getProduct(companyId, id);
      }

      if (isEditing && loadedProduct) {
        let whId = loadedProduct.warehouseId || '';
        let whName = loadedProduct.warehouseName || '';

        // If product has no warehouse set yet but exactly 1 warehouse exists, preselect it
        if (!whId && whList.length === 1) {
          whId = whList[0].id;
          whName = whList[0].name;
        }

        setForm({
          name: loadedProduct.name || '',
          sku: loadedProduct.sku || '',
          category: loadedProduct.category || '',
          description: loadedProduct.description || '',
          purchasePrice: loadedProduct.purchasePrice || 0,
          salePrice: loadedProduct.salePrice || 0,
          currentStock: loadedProduct.currentStock || 0,
          minimumStock: loadedProduct.minimumStock || 0,
          unit: loadedProduct.unit || 'pcs',
          warehouseId: whId,
          warehouseName: whName
        });
      } else {
        // Adding new product
        let initialWhId = '';
        let initialWhName = '';

        // If 1 warehouse is added, pre-select it automatically
        if (whList.length === 1) {
          initialWhId = whList[0].id;
          initialWhName = whList[0].name;
        } else if (whList.length > 1) {
          // Preselect first warehouse as default
          initialWhId = whList[0].id;
          initialWhName = whList[0].name;
        }

        setForm(prev => ({
          ...prev,
          warehouseId: initialWhId,
          warehouseName: initialWhName
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to initialize product form');
    }
    setInitialLoading(false);
  };

  const handleWarehouseChange = (e) => {
    const whId = e.target.value;
    const selected = warehouses.find(w => w.id === whId);
    setForm(prev => ({
      ...prev,
      warehouseId: whId,
      warehouseName: selected ? selected.name : ''
    }));
  };

  const handleQuickCreateWarehouse = async (e) => {
    e.preventDefault();
    if (!newWhName.trim()) {
      toast.error('Warehouse name is required');
      return;
    }
    setCreatingWh(true);
    try {
      const createdId = await createWarehouse(
        companyId,
        {
          name: newWhName.trim(),
          creationDate: new Date().toISOString().split('T')[0],
          address: '',
          notes: 'Created from product form'
        },
        currentUser?.uid,
        userProfile?.name || 'User'
      );

      const updatedList = await getWarehouses(companyId);
      setWarehouses(updatedList);

      const createdWh = updatedList.find(w => w.id === createdId);
      setForm(prev => ({
        ...prev,
        warehouseId: createdId,
        warehouseName: createdWh ? createdWh.name : newWhName.trim()
      }));

      toast.success(`Warehouse "${newWhName.trim()}" created successfully`);
      setNewWhName('');
      setShowQuickWarehouse(false);
    } catch (err) {
      toast.error(err.message || 'Failed to create warehouse');
    }
    setCreatingWh(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!form.sku.trim()) {
      toast.error('SKU / Barcode is required');
      return;
    }
    if (form.purchasePrice <= 0) {
      toast.error('Purchase price / cost is required and must be greater than 0');
      return;
    }
    if (form.salePrice <= 0) {
      toast.error('Sale price is required and must be greater than 0');
      return;
    }
    if (!isEditing && (form.currentStock === '' || form.currentStock === null || form.currentStock < 0)) {
      toast.error('Initial stock level is required');
      return;
    }
    
    setLoading(true);
    try {
      // Ensure warehouseName matches selected warehouseId if available
      let finalWhName = form.warehouseName;
      if (form.warehouseId) {
        const found = warehouses.find(w => w.id === form.warehouseId);
        if (found) finalWhName = found.name;
      }

      const submitData = {
        ...form,
        warehouseName: finalWhName
      };

      if (isEditing) {
        await updateProduct(companyId, id, submitData, currentUser.uid, userProfile?.name || 'User');
        toast.success('Product updated successfully');
        navigate(`/products/${id}`);
      } else {
        const newId = await createProduct(companyId, submitData, currentUser.uid, userProfile?.name || 'User');
        toast.success('Product created successfully');
        navigate(`/products/${newId}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save product');
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div className="loading-page"><div className="loading-spinner lg"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/products')}>
              <ArrowLeft size={14} /> Back to Products
            </button>
          </div>
          <h1>{isEditing ? 'Edit Product' : 'Add New Product'}</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : <Save size={16} />}
            {isEditing ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 800 }}>
        <form className="card-body form-grid" onSubmit={handleSubmit}>
          
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', borderBottom: 'var(--border)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              Basic Information
            </h3>
          </div>

          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input 
              type="text" 
              className="form-input" 
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">SKU / Barcode *</label>
            <input 
              type="text" 
              className="form-input" 
              value={form.sku}
              onChange={e => setForm({...form, sku: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <input 
              type="text" 
              className="form-input" 
              value={form.category}
              onChange={e => setForm({...form, category: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Unit (e.g. pcs, kg, box)</label>
            <input 
              type="text" 
              className="form-input" 
              value={form.unit}
              onChange={e => setForm({...form, unit: e.target.value})}
            />
          </div>

          {/* WAREHOUSE SELECTION SECTION */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Warehouse size={16} style={{ color: 'var(--primary-600)' }} /> Storage Warehouse *
              </span>
              {warehouses.length === 0 && !showQuickWarehouse && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-primary-600"
                  onClick={() => setShowQuickWarehouse(true)}
                  style={{ fontSize: 'var(--font-size-xs)' }}
                >
                  <Plus size={12} /> Add Warehouse
                </button>
              )}
            </label>

            {warehouses.length === 0 ? (
              <div>
                {showQuickWarehouse ? (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter Warehouse Name (e.g., Main Warehouse)"
                      value={newWhName}
                      onChange={e => setNewWhName(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleQuickCreateWarehouse}
                      disabled={creatingWh}
                    >
                      {creatingWh ? 'Creating...' : 'Save & Select'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowQuickWarehouse(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ background: 'var(--gray-50)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--gray-300)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="text-sm text-muted">No warehouses created yet.</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowQuickWarehouse(true)}
                    >
                      <Plus size={14} /> Create Warehouse
                    </button>
                  </div>
                )}
              </div>
            ) : warehouses.length === 1 ? (
              // 1 warehouse added -> preselected automatically
              <div>
                <select
                  className="form-select"
                  value={form.warehouseId}
                  onChange={handleWarehouseChange}
                  style={{ fontWeight: 500, color: 'var(--gray-900)' }}
                >
                  <option value={warehouses[0].id}>
                    {warehouses[0].name} (Pre-selected)
                  </option>
                </select>
                <span className="form-hint" style={{ color: 'var(--primary-600)', fontWeight: 500 }}>
                  ✓ {warehouses[0].name} is automatically pre-selected as your storage warehouse.
                </span>
              </div>
            ) : (
              // 2 or more warehouses added -> dropdown selector
              <div>
                <select
                  className="form-select"
                  value={form.warehouseId}
                  onChange={handleWarehouseChange}
                >
                  <option value="">-- Select Storage Warehouse --</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} {wh.address ? `(${wh.address})` : ''}
                    </option>
                  ))}
                </select>
                <span className="form-hint">
                  Select which warehouse this product will be stored in ({warehouses.length} warehouses available).
                </span>
              </div>
            )}
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Description</label>
            <textarea 
              className="form-textarea" 
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
              rows={3}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', borderBottom: 'var(--border)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              Pricing & Inventory
            </h3>
          </div>

          <div className="form-group">
            <label className="form-label">Purchase Price / Cost *</label>
            <input 
              type="number" 
              className="form-input" 
              value={form.purchasePrice}
              onChange={e => setForm({...form, purchasePrice: Number(e.target.value)})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Sale Price *</label>
            <input 
              type="number" 
              className="form-input" 
              value={form.salePrice}
              onChange={e => setForm({...form, salePrice: Number(e.target.value)})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Current Stock *</label>
            <input 
              type="number" 
              className="form-input" 
              value={form.currentStock}
              onChange={e => setForm({...form, currentStock: Number(e.target.value)})}
              disabled={isEditing}
              title={isEditing ? "Use Warehouse module to adjust stock" : ""}
            />
            {!isEditing && <span className="form-hint">Initial stock level</span>}
            {isEditing && <span className="form-hint">Use Warehouse module to adjust stock</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Minimum Stock Alert</label>
            <input 
              type="number" 
              className="form-input" 
              value={form.minimumStock}
              onChange={e => setForm({...form, minimumStock: Number(e.target.value)})}
            />
          </div>

        </form>
      </div>
    </div>
  );
}
