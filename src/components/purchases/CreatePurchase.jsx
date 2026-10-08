import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Package, Search, Warehouse, X, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createPurchase } from '../../services/purchaseService';
import { getProducts, createProduct } from '../../services/productService';
import { fetchAllCompanySuppliers } from '../../services/supplierService';
import { getWarehouses, createWarehouse } from '../../services/warehouseService';
import { formatCurrency } from '../../utils/formatters';
import SupplierSelectDropdown from '../common/SupplierSelectDropdown';

export default function CreatePurchase() {
  const { companyId, currentUser, userProfile, companyInfo, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const currency = companyInfo?.currency || 'Rs';

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Data lists
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isCustomSupplier, setIsCustomSupplier] = useState(false);
  const [warehouses, setWarehouses] = useState([]);

  // Form State
  const [form, setForm] = useState({
    supplierName: '',
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Purchased Line Items State
  const [items, setItems] = useState([]);

  // Product Search State (Same as CreateOrder.jsx)
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const searchRef = useRef(null);

  // Add New Product Popup Modal State
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // Draft Product Popup Form (ONLY basic product info - NO quantity, cost, or sale price)
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    unit: 'pcs',
    warehouseId: '',
    warehouseName: ''
  });

  // Quick Warehouse creation inside Add Product Modal
  const [showQuickWarehouse, setShowQuickWarehouse] = useState(false);
  const [newWhName, setNewWhName] = useState('');
  const [creatingWh, setCreatingWh] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    loadInitialData();
  }, [companyId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadInitialData = async () => {
    setInitialLoading(true);
    try {
      const [prodList, supList, whList] = await Promise.all([
        getProducts(companyId),
        fetchAllCompanySuppliers(companyId),
        getWarehouses(companyId)
      ]);
      setProducts(prodList);
      setSuppliers(supList);
      setWarehouses(whList);
    } catch (err) {
      console.error('Failed to load initial purchase data', err);
    }
    setInitialLoading(false);
  };

  // Filtered Products for Search Dropdown (Same as CreateOrder.jsx)
  const filteredProducts = useMemo(() => {
    const validProducts = products.filter(p => p && p.name && String(p.name).trim());
    if (!productSearch || !productSearch.trim()) return validProducts;
    const term = productSearch.toLowerCase();
    return validProducts.filter(p => 
      p.name?.toLowerCase().includes(term) || 
      p.sku?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term)
    );
  }, [products, productSearch]);

  // Helper for item calculations (pcs vs box)
  const calculatePurchaseItemMetrics = (item) => {
    if (item.unitType === 'box') {
      const boxQty = Number(item.boxQty) || 0;
      const pricePerBox = Number(item.pricePerBox) || 0;
      const hasSubBoxes = item.hasSubBoxes !== false;
      const subBoxesPerBox = hasSubBoxes ? (Number(item.subBoxesPerBox) || 0) : 1;
      const pcsPerSubBox = hasSubBoxes ? (Number(item.pcsPerSubBox) || 0) : (Number(item.pcsPerBox) || 0);
      const pcsPerBox = Number(item.pcsPerBox) || 0;
      const freePcsPerBox = Number(item.freePcsPerBox) || 0;

      const paidPcsPerBox = hasSubBoxes ? (subBoxesPerBox * pcsPerSubBox) : pcsPerBox;
      const totalPcsPerBox = paidPcsPerBox + freePcsPerBox;
      const totalPieces = boxQty * totalPcsPerBox;
      const lineTotal = boxQty * pricePerBox;
      const effectiveCostPerPiece = totalPieces > 0 ? (lineTotal / totalPieces) : 0;

      return {
        totalPieces,
        lineTotal,
        effectiveCostPerPiece,
        paidPcsPerBox,
        totalPcsPerBox,
        hasSubBoxes
      };
    } else {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.purchasePrice) || 0;
      return {
        totalPieces: qty,
        lineTotal: qty * cost,
        effectiveCostPerPiece: cost,
        paidPcsPerBox: 0,
        totalPcsPerBox: 0,
        hasSubBoxes: true
      };
    }
  };

  // Add Product to Purchase Table (Supports Box & Pcs)
  const handleAddProduct = (product) => {
    const existingIndex = items.findIndex(i => i.productId === product.id);

    if (existingIndex >= 0) {
      const updated = [...items];
      const item = updated[existingIndex];
      if (item.unitType === 'box') {
        item.boxQty = (Number(item.boxQty) || 0) + 1;
      } else {
        item.quantity = (Number(item.quantity) || 0) + 1;
      }
      setItems(updated);
    } else {
      const cost = Number(product.purchasePrice || product.costPrice) || 0;
      const sale = Number(product.salePrice) || 0;
      const unitType = product.unitType || (product.unit === 'box' ? 'box' : 'pcs');
      const boxDetails = product.boxDetails || {};
      const hasSubBoxes = boxDetails.hasSubBoxes !== undefined 
        ? boxDetails.hasSubBoxes 
        : Boolean(boxDetails.subBoxesPerBox && Number(boxDetails.subBoxesPerBox) > 1);

      setItems([
        ...items,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku || '',
          unitType: unitType,
          quantity: 1,
          purchasePrice: cost,
          salePrice: sale,
          // Box fields
          hasSubBoxes: hasSubBoxes,
          pricePerBox: boxDetails.pricePerBox || (cost > 0 ? cost : ''),
          boxQty: boxDetails.boxQty || 1,
          subBoxesPerBox: boxDetails.subBoxesPerBox || 12,
          pcsPerSubBox: boxDetails.pcsPerSubBox || 24,
          pcsPerBox: boxDetails.pcsPerBox || (boxDetails.pcsPerSubBox && boxDetails.subBoxesPerBox ? (Number(boxDetails.pcsPerSubBox) * Number(boxDetails.subBoxesPerBox)) : boxDetails.pcsPerSubBox || 288),
          freePcsPerBox: boxDetails.freePcsPerBox !== undefined ? boxDetails.freePcsPerBox : 0,
          isNewDraft: Boolean(product.isNewDraft),
          draftDetails: product.draftDetails || null
        }
      ]);
    }

    setProductSearch('');
    setShowProductDropdown(false);
  };

  // Handle line item field changes
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;
    setItems(updatedItems);
  };

  const handleRemoveSubBoxForItem = (idx) => {
    const updatedItems = [...items];
    const item = updatedItems[idx];
    if (item.subBoxesPerBox && item.pcsPerSubBox && !item.pcsPerBox) {
      item.pcsPerBox = String(Number(item.subBoxesPerBox) * Number(item.pcsPerSubBox));
    } else if (!item.pcsPerBox && item.pcsPerSubBox) {
      item.pcsPerBox = String(item.pcsPerSubBox);
    }
    item.hasSubBoxes = false;
    setItems(updatedItems);
  };

  const handleAddSubBoxForItem = (idx) => {
    const updatedItems = [...items];
    updatedItems[idx].hasSubBoxes = true;
    setItems(updatedItems);
  };

  // Remove line item row
  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculate Grand Total & Total Units
  const grandTotal = items.reduce((sum, item) => sum + calculatePurchaseItemMetrics(item).lineTotal, 0);
  const totalUnits = items.reduce((sum, item) => sum + calculatePurchaseItemMetrics(item).totalPieces, 0);

  // Open "Add New Product" Popup Modal
  const handleOpenAddProductModal = () => {
    let initialWhId = '';
    let initialWhName = '';
    if (warehouses.length > 0) {
      initialWhId = warehouses[0].id;
      initialWhName = warehouses[0].name;
    }

    setNewProductForm({
      name: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      category: '',
      description: '',
      unit: 'pcs',
      warehouseId: initialWhId,
      warehouseName: initialWhName
    });
    setIsAddProductModalOpen(true);
  };

  // Quick Warehouse Creation inside Product Modal
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
          notes: 'Created from purchase page'
        },
        currentUser?.uid,
        userProfile?.name || 'User'
      );

      const updatedList = await getWarehouses(companyId);
      setWarehouses(updatedList);

      const createdWh = updatedList.find(w => w.id === createdId);
      setNewProductForm(prev => ({
        ...prev,
        warehouseId: createdId,
        warehouseName: createdWh ? createdWh.name : newWhName.trim()
      }));

      toast.success(`Warehouse "${newWhName.trim()}" created`);
      setNewWhName('');
      setShowQuickWarehouse(false);
    } catch (err) {
      toast.error(err.message || 'Failed to create warehouse');
    }
    setCreatingWh(false);
  };

  // Confirm Add Product from Popup (Adds to purchase list without creating DB product yet)
  const handleConfirmAddDraftProduct = (e) => {
    e.preventDefault();
    if (!newProductForm.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!newProductForm.sku.trim()) {
      toast.error('SKU / Barcode is required');
      return;
    }

    let finalWhName = newProductForm.warehouseName;
    if (newProductForm.warehouseId) {
      const found = warehouses.find(w => w.id === newProductForm.warehouseId);
      if (found) finalWhName = found.name;
    }

    const tempId = `temp_prod_${Date.now()}`;
    const draftProd = {
      id: tempId,
      name: newProductForm.name.trim(),
      sku: newProductForm.sku.trim(),
      category: newProductForm.category.trim(),
      unit: newProductForm.unit || 'pcs',
      currentStock: 0,
      purchasePrice: 0,
      salePrice: 0,
      isNewDraft: true,
      draftDetails: {
        ...newProductForm,
        warehouseName: finalWhName
      }
    };

    // Add to products list temporarily so it displays nicely
    setProducts(prev => [draftProd, ...prev]);

    // Add to line items
    handleAddProduct(draftProd);

    setIsAddProductModalOpen(false);
    toast.success(`"${newProductForm.name.trim()}" added to purchase list! Enter quantity and prices below.`);
  };

  // Submit Purchase Form
  const handleSubmitPurchase = async (e) => {
    if (e) e.preventDefault();
    if (!form.supplierName.trim()) {
      toast.error('Supplier Name is required');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one product to the purchase');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const metrics = calculatePurchaseItemMetrics(item);
      if (metrics.totalPieces <= 0) {
        toast.error(`Total calculated pieces for item "${item.productName}" must be greater than 0`);
        return;
      }
      if (metrics.lineTotal <= 0) {
        toast.error(`Total cost for item "${item.productName}" must be greater than 0`);
        return;
      }
    }

    setLoading(true);
    try {
      const parts = form.date.split('-').map(Number);
      const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
      const now = new Date();
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      const customTimestamp = selectedDate.getTime();

      // Process items: Create any draft products in Firebase first
      const finalItems = [];

      for (const item of items) {
        let finalProductId = item.productId;
        const metrics = calculatePurchaseItemMetrics(item);

        if (item.isNewDraft && item.draftDetails) {
          // Create product in DB with calculated stock, cost price, and sale price
          const createdId = await createProduct(
            companyId,
            {
              ...item.draftDetails,
              unitType: item.unitType,
              unit: 'pcs',
              purchasePrice: metrics.effectiveCostPerPiece,
              salePrice: Number(item.salePrice) || 0,
              currentStock: metrics.totalPieces,
              totalBuyingCost: metrics.lineTotal,
              boxDetails: item.unitType === 'box' ? {
                pricePerBox: Number(item.pricePerBox) || 0,
                boxQty: Number(item.boxQty) || 0,
                hasSubBoxes: item.hasSubBoxes !== false,
                subBoxesPerBox: item.hasSubBoxes !== false ? (Number(item.subBoxesPerBox) || 0) : 1,
                pcsPerSubBox: item.hasSubBoxes !== false ? (Number(item.pcsPerSubBox) || 0) : (Number(item.pcsPerBox) || 0),
                pcsPerBox: item.hasSubBoxes !== false ? ((Number(item.subBoxesPerBox) || 0) * (Number(item.pcsPerSubBox) || 0)) : (Number(item.pcsPerBox) || 0),
                freePcsPerBox: Number(item.freePcsPerBox) || 0,
                totalPieces: metrics.totalPieces,
                totalBuyingCost: metrics.lineTotal,
                calculatedCostPerPiece: metrics.effectiveCostPerPiece
              } : null,
              minimumStock: 5
            },
            currentUser?.uid,
            userProfile?.name || 'User'
          );
          finalProductId = createdId;
        }

        finalItems.push({
          productId: finalProductId,
          productName: item.productName,
          sku: item.sku,
          unitType: item.unitType,
          quantity: metrics.totalPieces,
          purchasePrice: metrics.effectiveCostPerPiece,
          salePrice: Number(item.salePrice) || 0,
          lineTotal: metrics.lineTotal,
          boxDetails: item.unitType === 'box' ? {
            pricePerBox: Number(item.pricePerBox) || 0,
            boxQty: Number(item.boxQty) || 0,
            hasSubBoxes: item.hasSubBoxes !== false,
            subBoxesPerBox: item.hasSubBoxes !== false ? (Number(item.subBoxesPerBox) || 0) : 1,
            pcsPerSubBox: item.hasSubBoxes !== false ? (Number(item.pcsPerSubBox) || 0) : (Number(item.pcsPerBox) || 0),
            pcsPerBox: item.hasSubBoxes !== false ? ((Number(item.subBoxesPerBox) || 0) * (Number(item.pcsPerSubBox) || 0)) : (Number(item.pcsPerBox) || 0),
            freePcsPerBox: Number(item.freePcsPerBox) || 0,
            totalPieces: metrics.totalPieces,
            totalBuyingCost: metrics.lineTotal,
            calculatedCostPerPiece: metrics.effectiveCostPerPiece
          } : null
        });
      }

      const purchasePayload = {
        ...form,
        grandTotal: grandTotal,
        items: finalItems,
        createdAt: customTimestamp
      };

      await createPurchase(companyId, purchasePayload, currentUser.uid, userProfile.name);
      toast.success('Stock purchase recorded! Products and weighted average costs updated in database.');
      navigate('/purchases');
    } catch (err) {
      toast.error(err.message || 'Failed to record purchase');
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="empty-state">
        <h3>Access Denied</h3>
        <p>Only admins can record purchases.</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/dashboard')}>Go Home</button>
      </div>
    );
  }

  if (initialLoading) {
    return <div className="loading-page"><div className="loading-spinner lg"></div></div>;
  }

  const supplierNames = suppliers.map(s => typeof s === 'string' ? s : (s.name || s.supplierName)).filter(Boolean);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/purchases')}>
              <ArrowLeft size={14} /> Back to Purchases
            </button>
          </div>
          <h1>Record Stock Purchase</h1>
          <p className="text-muted text-sm">
            Itemized stock purchase entry with automated weighted average cost & stock updates
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-lg" onClick={handleSubmitPurchase} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : <Save size={16} />}
            Save & Update Stock
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmitPurchase}>
        <div className="grid-2col-responsive" style={{ alignItems: 'start' }}>
          
          {/* Main Content Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            
            {/* General Purchase Details Card */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Purchase Overview</h3>
              </div>
              <div className="card-body form-grid form-grid-2col">
                
                {/* Date */}
                <div className="form-group">
                  <label className="form-label">Purchase Date *</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={form.date}
                    onChange={e => setForm({...form, date: e.target.value})}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Bill Reference */}
                <div className="form-group">
                  <label className="form-label">Invoice / Bill Reference</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. INV-2026-99"
                    value={form.reference}
                    onChange={e => setForm({...form, reference: e.target.value})}
                  />
                </div>

                {/* Custom Searchable Supplier Dropdown Component */}
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
                  required={true}
                />

                {/* Notes */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Additional Notes</label>
                  <textarea 
                    className="form-textarea" 
                    value={form.notes}
                    onChange={e => setForm({...form, notes: e.target.value})}
                    rows={2}
                    placeholder="Optional notes or details about this stock shipment..."
                  />
                </div>

              </div>
            </div>

            {/* Purchased Products Card - Search UI Identical to CreateOrder.jsx */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={18} className="text-muted" /> Purchased Products
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenAddProductModal}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                >
                  <Plus size={14} /> Add New Product
                </button>
              </div>

              <div className="card-body">
                {/* Product Search Input (Identical to CreateOrder.jsx) */}
                <div ref={searchRef} style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--gray-400)' }} />
                  <input 
                    type="text" 
                    className="form-input"
                    style={{ paddingLeft: 36 }}
                    placeholder="Search products by name or SKU to add..."
                    value={productSearch}
                    onFocus={() => setShowProductDropdown(true)}
                    onClick={() => setShowProductDropdown(true)}
                    onChange={e => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                  />
                  
                  {/* Search Dropdown Results */}
                  {showProductDropdown && (
                    <div className="search-results" style={{ maxHeight: 280, overflowY: 'auto' }}>
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map(p => (
                          <div 
                            key={p.id} 
                            className="search-result-item"
                            onClick={() => handleAddProduct(p)}
                          >
                            <div className="result-icon"><Package size={14} /></div>
                            <div className="result-text">
                              <div className="result-title">
                                {p.name} {p.isNewDraft ? <span className="badge badge-blue">New Draft</span> : ''}
                              </div>
                              <div className="result-sub">
                                Stock: {p.currentStock || 0} | Cost: {formatCurrency(p.purchasePrice || p.costPrice || 0, currency)}
                              </div>
                            </div>
                            <button type="button" className="btn btn-ghost btn-sm"><Plus size={14} /> Add</button>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                          No matching products found.<br/>
                          <button
                            type="button"
                            className="btn btn-link btn-sm mt-2"
                            onClick={() => { setShowProductDropdown(false); handleOpenAddProductModal(); }}
                          >
                            + Add "{productSearch}" as New Product
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Purchase Line Items */}
                {items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {items.map((item, idx) => {
                      const metrics = calculatePurchaseItemMetrics(item);
                      const isBox = item.unitType === 'box';

                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'white',
                            border: '1px solid var(--gray-200)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-4)',
                            boxShadow: 'var(--shadow-xs)'
                          }}
                        >
                          {/* Item Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--gray-900)' }}>
                                {idx + 1}. {item.productName}
                              </span>
                              {item.isNewDraft && <span className="badge badge-blue ml-2" style={{ fontSize: '10px' }}>New</span>}
                              <div className="text-xs text-muted">SKU: {item.sku || 'N/A'}</div>
                            </div>

                            {/* Unit Type Toggle Selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="text-xs font-medium text-muted">Unit:</span>
                              <div style={{ display: 'inline-flex', background: 'var(--gray-100)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
                                <button
                                  type="button"
                                  className={`btn btn-xs ${!isBox ? 'btn-primary' : 'btn-ghost'}`}
                                  style={{ padding: '3px 10px', fontSize: '11px' }}
                                  onClick={() => handleItemChange(idx, 'unitType', 'pcs')}
                                >
                                  Pcs
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-xs ${isBox ? 'btn-primary' : 'btn-ghost'}`}
                                  style={{ padding: '3px 10px', fontSize: '11px' }}
                                  onClick={() => handleItemChange(idx, 'unitType', 'box')}
                                >
                                  Box
                                </button>
                              </div>

                              <button
                                type="button"
                                className="table-action-btn"
                                style={{ color: 'var(--danger-500)', marginLeft: '8px' }}
                                onClick={() => handleRemoveItem(idx)}
                                title="Remove Product"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Item Inputs Responsive Grid */}
                          {isBox ? (
                            /* BOX MODE INPUTS */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                              {item.hasSubBoxes === false && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--primary-50)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--primary-300)' }}>
                                  <span className="text-xs text-primary-800" style={{ fontWeight: 600 }}>
                                    📦 Simple Box Mode (Number of Boxes & Pieces per Box)
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-xs"
                                    onClick={() => handleAddSubBoxForItem(idx)}
                                    style={{ padding: '2px 8px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  >
                                    <Plus size={12} /> Add Sub-Box Level
                                  </button>
                                </div>
                              )}

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
                                <div>
                                  <label className="form-label text-xs">Price / Box ({currency}) *</label>
                                  <input
                                    type="number"
                                    className="form-input text-sm"
                                    placeholder="e.g. 10000"
                                    value={item.pricePerBox}
                                    onChange={(e) => handleItemChange(idx, 'pricePerBox', e.target.value)}
                                    min="0"
                                  />
                                </div>

                                {item.hasSubBoxes !== false ? (
                                  <>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label className="form-label text-xs" style={{ margin: 0 }}>Box Quantity *</label>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-xs text-danger-600"
                                          onClick={() => handleRemoveSubBoxForItem(idx)}
                                          style={{ padding: '0 4px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '1px' }}
                                          title="Cross out sub-box level"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                      <input
                                        type="number"
                                        className="form-input text-sm"
                                        placeholder="e.g. 2"
                                        value={item.boxQty}
                                        onChange={(e) => handleItemChange(idx, 'boxQty', e.target.value)}
                                        min="1"
                                      />
                                    </div>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label className="form-label text-xs" style={{ margin: 0 }}>Sub-boxes / Box *</label>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-xs text-danger-600"
                                          onClick={() => handleRemoveSubBoxForItem(idx)}
                                          style={{ padding: '0 4px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '1px' }}
                                          title="Cross out sub-box level"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                      <input
                                        type="number"
                                        className="form-input text-sm"
                                        placeholder="e.g. 12"
                                        value={item.subBoxesPerBox}
                                        onChange={(e) => handleItemChange(idx, 'subBoxesPerBox', e.target.value)}
                                        min="1"
                                      />
                                    </div>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label className="form-label text-xs" style={{ margin: 0 }}>Pcs / Sub-box *</label>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-xs text-danger-600"
                                          onClick={() => handleRemoveSubBoxForItem(idx)}
                                          style={{ padding: '0 4px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '1px' }}
                                          title="Cross out sub-box level"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                      <input
                                        type="number"
                                        className="form-input text-sm"
                                        placeholder="e.g. 24"
                                        value={item.pcsPerSubBox}
                                        onChange={(e) => handleItemChange(idx, 'pcsPerSubBox', e.target.value)}
                                        min="1"
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div>
                                      <label className="form-label text-xs">Box Quantity *</label>
                                      <input
                                        type="number"
                                        className="form-input text-sm"
                                        placeholder="e.g. 2"
                                        value={item.boxQty}
                                        onChange={(e) => handleItemChange(idx, 'boxQty', e.target.value)}
                                        min="1"
                                      />
                                    </div>
                                    <div>
                                      <label className="form-label text-xs">Pcs / Box *</label>
                                      <input
                                        type="number"
                                        className="form-input text-sm"
                                        placeholder="e.g. 288"
                                        value={item.pcsPerBox}
                                        onChange={(e) => handleItemChange(idx, 'pcsPerBox', e.target.value)}
                                        min="1"
                                      />
                                    </div>
                                  </>
                                )}

                                <div>
                                  <label className="form-label text-xs">Free Pcs / Box</label>
                                  <input
                                    type="number"
                                    className="form-input text-sm"
                                    placeholder="e.g. 25"
                                    value={item.freePcsPerBox}
                                    onChange={(e) => handleItemChange(idx, 'freePcsPerBox', e.target.value)}
                                    min="0"
                                  />
                                </div>
                                <div>
                                  <label className="form-label text-xs">New Sale Price ({currency})</label>
                                  <input
                                    type="number"
                                    className="form-input text-sm"
                                    placeholder="Sale price"
                                    value={item.salePrice}
                                    onChange={(e) => handleItemChange(idx, 'salePrice', e.target.value)}
                                    min="0"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* PCS MODE INPUTS */
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
                              <div>
                                <label className="form-label text-xs">Quantity (Pcs) *</label>
                                <input
                                  type="number"
                                  className="form-input text-sm"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                  min="1"
                                />
                              </div>
                              <div>
                                <label className="form-label text-xs">Unit Cost Price ({currency}) *</label>
                                <input
                                  type="number"
                                  className="form-input text-sm"
                                  value={item.purchasePrice}
                                  onChange={(e) => handleItemChange(idx, 'purchasePrice', e.target.value)}
                                  min="0"
                                />
                              </div>
                              <div>
                                <label className="form-label text-xs">New Sale Price ({currency})</label>
                                <input
                                  type="number"
                                  className="form-input text-sm"
                                  value={item.salePrice}
                                  onChange={(e) => handleItemChange(idx, 'salePrice', e.target.value)}
                                  min="0"
                                />
                              </div>
                            </div>
                          )}

                          {/* Real-time Calculation Summary Banner for line item */}
                          <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: 'var(--font-size-xs)' }}>
                            <div style={{ color: 'var(--gray-600)' }}>
                              {isBox ? (
                                <span>
                                  📦 <strong>{metrics.totalPieces} Pcs</strong> ({item.boxQty || 0} box × [{item.hasSubBoxes !== false ? `${item.subBoxesPerBox || 0}×${item.pcsPerSubBox || 0}` : `${item.pcsPerBox || 0} pcs/box`} + {item.freePcsPerBox || 0} free]) | Calculated Cost: <strong>{formatCurrency(metrics.effectiveCostPerPiece, currency)} / piece</strong>
                                </span>
                              ) : (
                                <span>
                                  📦 Total Stock Added: <strong>{metrics.totalPieces} Pcs</strong>
                                </span>
                              )}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--primary-700)', fontFamily: 'monospace' }}>
                              Total: {formatCurrency(metrics.lineTotal, currency)}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: 'var(--space-6)', border: '1px dashed var(--gray-300)', borderRadius: 'var(--radius-md)' }}>
                    <Package size={24} style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }} />
                    <p className="text-sm text-muted">No products added to purchase yet.<br/>Search above or click "+ Add New Product" to add products.</p>
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* Sidebar Summary Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'sticky', top: '20px' }}>
            <div className="card" style={{ border: '2px solid var(--primary-200)', background: 'var(--gray-50)' }}>
              <div className="card-header" style={{ background: 'var(--primary-50)', borderBottom: '1px solid var(--primary-200)' }}>
                <h3 className="card-title" style={{ color: 'var(--primary-800)' }}>Purchase Summary</h3>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                  <span className="text-muted">Total Product Lines</span>
                  <span style={{ fontWeight: 600 }}>{items.length} Line(s)</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                  <span className="text-muted">Total Units Purchased</span>
                  <span style={{ fontWeight: 600 }}>{totalUnits} Unit(s)</span>
                </div>

                <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>Grand Total</span>
                  <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--primary-700)', fontFamily: 'monospace' }}>
                    {formatCurrency(grandTotal, currency)}
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-block mt-2"
                  disabled={loading}
                  style={{ fontWeight: 700 }}
                >
                  {loading ? <span className="loading-spinner" /> : <Save size={18} />}
                  Save Stock Purchase
                </button>
              </div>
            </div>
          </div>

        </div>
      </form>

      {/* ADD NEW PRODUCT POPUP MODAL (Basic Product Info ONLY - NO Quantity, Cost or Sale Price) */}
      {isAddProductModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddProductModalOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: 560, width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--primary-600)' }} />
                Add New Product Info
              </h3>
              <button className="modal-close" onClick={() => setIsAddProductModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmAddDraftProduct}>
              <div className="modal-body form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                
                {/* Product Name */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Premium Basmati Rice 5kg"
                    value={newProductForm.name}
                    onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    autoFocus
                  />
                </div>

                {/* SKU / Barcode */}
                <div className="form-group">
                  <label className="form-label">SKU / Barcode *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newProductForm.sku}
                    onChange={e => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                  />
                </div>

                {/* Category */}
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Groceries, Staples"
                    value={newProductForm.category}
                    onChange={e => setNewProductForm({ ...newProductForm, category: e.target.value })}
                  />
                </div>

                {/* Storage Warehouse */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Warehouse *</span>
                    {warehouses.length === 0 && !showQuickWarehouse && (
                      <button
                        type="button"
                        className="btn btn-link btn-xs"
                        onClick={() => setShowQuickWarehouse(true)}
                      >
                        + Add Warehouse
                      </button>
                    )}
                  </label>
                  {showQuickWarehouse ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        className="form-input text-xs"
                        placeholder="Warehouse Name"
                        value={newWhName}
                        onChange={e => setNewWhName(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={handleQuickCreateWarehouse}
                        disabled={creatingWh}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={newProductForm.warehouseId}
                      onChange={e => {
                        const whId = e.target.value;
                        const found = warehouses.find(w => w.id === whId);
                        setNewProductForm({
                          ...newProductForm,
                          warehouseId: whId,
                          warehouseName: found ? found.name : ''
                        });
                      }}
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Description */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={newProductForm.description}
                    onChange={e => setNewProductForm({ ...newProductForm, description: e.target.value })}
                  />
                </div>

              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddProductModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} /> Add to Purchase List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
