import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Warehouse, Plus, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createProduct, getProduct, updateProduct } from '../../services/productService';
import { getWarehouses, createWarehouse } from '../../services/warehouseService';
import { fetchAllCompanySuppliers } from '../../services/supplierService';
import SupplierSelectDropdown from '../common/SupplierSelectDropdown';
import { formatCurrency } from '../../utils/formatters';

export default function ProductForm() {
  const { id } = useParams();
  const isEditing = Boolean(id && id !== 'new');
  
  const { companyId, companyInfo, currentUser, userProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const currency = companyInfo?.currency || 'Rs';
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showQuickWarehouse, setShowQuickWarehouse] = useState(false);
  const [newWhName, setNewWhName] = useState('');
  const [creatingWh, setCreatingWh] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    purchasePrice: '',
    salePrice: '',
    currentStock: '',
    minimumStock: 0,
    unit: 'pcs',
    unitType: 'pcs', // 'pcs' or 'box'
    pricePerBox: '',
    boxQty: '',
    subBoxesPerBox: '',
    pcsPerSubBox: '',
    freePcsPerBox: '',
    warehouseId: '',
    warehouseName: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    supplierName: '',
    reference: '',
    notes: ''
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
    if (!companyId) return;
    setInitialLoading(true);
    try {
      // 1. Fetch Warehouses and all company Suppliers safely
      const [whList, supList] = await Promise.all([
        getWarehouses(companyId).catch(() => []),
        fetchAllCompanySuppliers(companyId).catch(() => [])
      ]);
      setWarehouses(whList || []);
      setSuppliers(supList || []);

      if (isEditing && id && id !== 'new') {
        const loadedProduct = await getProduct(companyId, id).catch(() => null);
        if (loadedProduct) {
          let whId = loadedProduct.warehouseId || '';
          let whName = loadedProduct.warehouseName || '';

          if (!whId && whList && whList.length === 1) {
            whId = whList[0].id;
            whName = whList[0].name;
          }

          setForm({
            name: loadedProduct.name || '',
            sku: loadedProduct.sku || '',
            category: loadedProduct.category || '',
            description: loadedProduct.description || '',
            purchasePrice: loadedProduct.purchasePrice || '',
            salePrice: loadedProduct.salePrice || '',
            currentStock: loadedProduct.currentStock || '',
            minimumStock: loadedProduct.minimumStock || 0,
            unit: loadedProduct.unit || 'pcs',
            unitType: loadedProduct.unitType || 'pcs',
            pricePerBox: loadedProduct.boxDetails?.pricePerBox || '',
            boxQty: loadedProduct.boxDetails?.boxQty || '',
            subBoxesPerBox: loadedProduct.boxDetails?.subBoxesPerBox || '',
            pcsPerSubBox: loadedProduct.boxDetails?.pcsPerSubBox || '',
            freePcsPerBox: loadedProduct.boxDetails?.freePcsPerBox || '',
            warehouseId: whId,
            warehouseName: whName,
            purchaseDate: new Date().toISOString().split('T')[0],
            supplierName: '',
            reference: '',
            notes: ''
          });
        }
      } else {
        // Adding new product
        let initialWhId = '';
        let initialWhName = '';

        if (whList && whList.length >= 1) {
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
      console.error('Error loading product form:', err);
    } finally {
      setInitialLoading(false);
    }
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

  const isBoxUnit = form.unitType === 'box';

  const boxQty = Number(form.boxQty) || 0;
  const pricePerBox = Number(form.pricePerBox) || 0;
  const subBoxesPerBox = Number(form.subBoxesPerBox) || 0;
  const pcsPerSubBox = Number(form.pcsPerSubBox) || 0;
  const freePcsPerBox = Number(form.freePcsPerBox) || 0;

  const paidPcsPerBox = subBoxesPerBox * pcsPerSubBox;
  const totalPcsPerBox = paidPcsPerBox + freePcsPerBox;
  const calculatedTotalPieces = isBoxUnit ? (boxQty * totalPcsPerBox) : (Number(form.currentStock) || 0);
  const calculatedTotalBuyingCost = isBoxUnit ? (boxQty * pricePerBox) : ((Number(form.currentStock) || 0) * (Number(form.purchasePrice) || 0));
  const calculatedCostPerPiece = calculatedTotalPieces > 0 ? (calculatedTotalBuyingCost / calculatedTotalPieces) : 0;

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
    if (form.salePrice <= 0) {
      toast.error('Sale price is required and must be greater than 0');
      return;
    }

    if (isBoxUnit) {
      if (pricePerBox <= 0) {
        toast.error('Price per box is required and must be greater than 0');
        return;
      }
      if (!isEditing && boxQty <= 0) {
        toast.error('Box quantity is required and must be greater than 0');
        return;
      }
      if (subBoxesPerBox <= 0) {
        toast.error('Sub-box quantity per box is required and must be greater than 0');
        return;
      }
      if (pcsPerSubBox <= 0) {
        toast.error('Pieces per sub-box is required and must be greater than 0');
        return;
      }
    } else {
      if (form.purchasePrice <= 0) {
        toast.error('Purchase price / cost is required and must be greater than 0');
        return;
      }
      if (!isEditing && (form.currentStock === '' || form.currentStock === null || Number(form.currentStock) <= 0)) {
        toast.error('Initial stock quantity is compulsory and must be greater than 0');
        return;
      }
    }

    if (!isEditing) {
      if (!form.purchaseDate) {
        toast.error('Purchase date is compulsory for initial stock purchase entry');
        return;
      }
      if (!form.supplierName || !form.supplierName.trim()) {
        toast.error('Supplier / Vendor Name is compulsory for initial stock purchase entry');
        return;
      }
      if (!form.reference || !form.reference.trim()) {
        toast.error('Invoice / Bill Reference is compulsory for initial stock purchase entry');
        return;
      }
    }
    
    setLoading(true);
    try {
      // Ensure warehouseName matches selected warehouseId if available
      let finalWhName = form.warehouseName;
      if (form.warehouseId) {
        const found = warehouses.find(w => w.id === form.warehouseId);
        if (found) finalWhName = found.name;
      }

      const finalCurrentStock = isBoxUnit ? calculatedTotalPieces : Number(form.currentStock);
      const finalPurchasePrice = isBoxUnit ? calculatedCostPerPiece : Number(form.purchasePrice);

      const submitData = {
        ...form,
        unit: 'pcs',
        unitType: form.unitType,
        purchasePrice: finalPurchasePrice,
        currentStock: finalCurrentStock,
        totalBuyingCost: calculatedTotalBuyingCost,
        boxDetails: isBoxUnit ? {
          pricePerBox,
          boxQty,
          subBoxesPerBox,
          pcsPerSubBox,
          freePcsPerBox,
          totalPieces: calculatedTotalPieces,
          totalBuyingCost: calculatedTotalBuyingCost,
          calculatedCostPerPiece
        } : null,
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

  const supplierNames = suppliers.map(s => typeof s === 'string' ? s : (s.name || s.supplierName)).filter(Boolean);

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
          
          {/* INITIAL STOCK PURCHASE ENTRY SECTION MOVED TO TOP */}
          {!isEditing && (
            <>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: 'var(--font-size-md)', borderBottom: 'var(--border)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-2)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <ShoppingBag size={18} /> Initial Stock Purchase Entry (Compulsory)
                </h3>
                <span className="text-xs text-muted">
                  Creating a new product requires recording an initial stock purchase in Purchases & General Ledger.
                </span>
              </div>

              {/* Purchase Date */}
              <div className="form-group">
                <label className="form-label">Purchase Date *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={form.purchaseDate}
                  onChange={e => setForm({...form, purchaseDate: e.target.value})}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Bill / Invoice Reference */}
              <div className="form-group">
                <label className="form-label">Bill / Invoice Reference *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. INV-2026-01"
                  value={form.reference}
                  onChange={e => setForm({...form, reference: e.target.value})}
                />
              </div>

              {/* Custom Searchable Supplier Dropdown */}
              <SupplierSelectDropdown
                suppliers={suppliers}
                value={form.supplierName}
                onChange={name => setForm({...form, supplierName: name})}
                onSupplierCreated={async () => {
                  const supList = await fetchAllCompanySuppliers(companyId);
                  setSuppliers(supList);
                }}
                placeholder="Search or enter supplier name (e.g. Acme Wholesalers)..."
                label="Supplier / Vendor Name *"
                required={!isEditing}
              />

              {/* Additional Notes */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Additional Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional purchase notes or details..."
                  value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})}
                />
              </div>
            </>
          )}

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', borderBottom: 'var(--border)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
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

          {/* Unit Type Options Header Selector */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Select Product Unit Structure *
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className={`btn ${form.unitType === 'pcs' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                onClick={() => setForm({ ...form, unitType: 'pcs', unit: 'pcs' })}
              >
                Pieces (pcs)
              </button>
              <button
                type="button"
                className={`btn ${form.unitType === 'box' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                onClick={() => setForm({ ...form, unitType: 'box', unit: 'box' })}
              >
                Box Packaging (box)
              </button>
            </div>
          </div>

          {/* BOX PACKAGING MODE FIELDS */}
          {form.unitType === 'box' ? (
            <>
              {/* Price per Box */}
              <div className="form-group">
                <label className="form-label">Price per Box ({currency}) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 10000"
                  value={form.pricePerBox}
                  onChange={e => setForm({...form, pricePerBox: e.target.value})}
                  min="0"
                />
              </div>

              {/* Box Quantity (Units in Boxes) */}
              <div className="form-group">
                <label className="form-label">Units in Boxes (Box Quantity) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 2"
                  value={form.boxQty}
                  onChange={e => setForm({...form, boxQty: e.target.value})}
                  disabled={isEditing}
                  min="1"
                />
              </div>

              {/* Sub-box Quantity */}
              <div className="form-group">
                <label className="form-label">Sub-box Quantity per Box *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 12"
                  value={form.subBoxesPerBox}
                  onChange={e => setForm({...form, subBoxesPerBox: e.target.value})}
                  min="1"
                />
              </div>

              {/* Pcs in Per Sub-box */}
              <div className="form-group">
                <label className="form-label">Pcs per Sub-box *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 24"
                  value={form.pcsPerSubBox}
                  onChange={e => setForm({...form, pcsPerSubBox: e.target.value})}
                  min="1"
                />
              </div>

              {/* Free Unit / Pieces per Box */}
              <div className="form-group">
                <label className="form-label">Free Pieces per Big Box</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 25"
                  value={form.freePcsPerBox}
                  onChange={e => setForm({...form, freePcsPerBox: e.target.value})}
                  min="0"
                />
              </div>

              {/* Sale Price per Unit / Piece */}
              <div className="form-group">
                <label className="form-label">Sale Price per Unit / Piece ({currency}) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 50"
                  value={form.salePrice}
                  onChange={e => setForm({...form, salePrice: e.target.value})}
                  min="0"
                />
              </div>
            </>
          ) : (
            /* STANDARD PCS MODE FIELDS */
            <>
              <div className="form-group">
                <label className="form-label">Purchase Price / Cost per Piece ({currency}) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={form.purchasePrice}
                  onChange={e => setForm({...form, purchasePrice: e.target.value})}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sale Price per Piece ({currency}) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={form.salePrice}
                  onChange={e => setForm({...form, salePrice: e.target.value})}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Current Stock Quantity (Pcs) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={form.currentStock}
                  onChange={e => setForm({...form, currentStock: e.target.value})}
                  disabled={isEditing}
                  title={isEditing ? "Use Warehouse module to adjust stock" : ""}
                  min="0"
                />
                {!isEditing && <span className="form-hint">Initial stock level in pieces</span>}
                {isEditing && <span className="form-hint">Use Warehouse module to adjust stock</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Minimum Stock Alert (Pcs)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={form.minimumStock}
                  onChange={e => setForm({...form, minimumStock: e.target.value})}
                  min="0"
                />
              </div>
            </>
          )}

          {/* DYNAMIC CALCULATION SUMMARY CARD */}
          <div style={{ gridColumn: '1 / -1', background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
            <h4 style={{ color: 'var(--primary-800)', margin: '0 0 var(--space-3) 0', fontSize: '14px', fontWeight: 700 }}>
              📊 Total Buying Cost & Calculated Stock Breakdown
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--gray-600)' }}>Total Buying Cost</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-700)', fontFamily: 'monospace' }}>
                  {formatCurrency(calculatedTotalBuyingCost, currency)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--gray-600)' }}>Total Pieces Added</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gray-900)' }}>
                  {calculatedTotalPieces} pcs
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--gray-600)' }}>Calculated Cost / Piece</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gray-900)' }}>
                  {formatCurrency(calculatedCostPerPiece, currency)}
                </div>
              </div>
            </div>
            {isBoxUnit && (
              <div style={{ fontSize: '12px', color: 'var(--gray-600)', marginTop: '10px', borderTop: '1px dashed var(--primary-200)', paddingTop: '8px', lineHeight: 1.5 }}>
                • Paid pcs per box: <strong>{paidPcsPerBox}</strong> ({subBoxesPerBox} sub-boxes × {pcsPerSubBox} pcs)<br/>
                • Free pcs per box: <strong>{freePcsPerBox}</strong> | Total per box: <strong>{totalPcsPerBox} pcs</strong><br/>
                • Total for {boxQty} box(es): <strong>{calculatedTotalPieces} total pieces</strong> | Total Cost: <strong>{formatCurrency(calculatedTotalBuyingCost, currency)}</strong>
              </div>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
