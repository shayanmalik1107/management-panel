import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Search, Store, Package, ArrowLeft, Save, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getProducts } from '../../services/productService';
import { getCustomers, createCustomer } from '../../services/customerService';
import { createOrder, getOrder, updateOrder } from '../../services/orderService';
import { formatCurrency } from '../../utils/formatters';

export default function CreateOrder() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { companyId, currentUser, userProfile, hasPermission, companyInfo, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [existingOrderNumber, setExistingOrderNumber] = useState('');
  
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const searchRef = useRef(null);
  
  const [paymentType, setPaymentType] = useState('credit');
  const [discount, setDiscount] = useState(0); // This is now a percentage %
  const [notes, setNotes] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

  // Quick Customer Creation Modal
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    shopName: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  const currency = companyInfo?.currency || 'Rs';

  useEffect(() => {
    if (!companyId) return;
    loadData();
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

  const loadData = async () => {
    setInitialLoading(true);
    try {
      const [custs, prods] = await Promise.all([
        getCustomers(companyId),
        getProducts(companyId)
      ]);
      setCustomers(custs);
      setProducts(prods);

      if (isEditMode && id) {
        if (!isAdmin) {
          toast.error('Employees cannot edit existing orders');
          navigate('/orders');
          return;
        }

        const existingOrder = await getOrder(companyId, id);
        if (existingOrder) {
          setExistingOrderNumber(existingOrder.orderNumber || '');
          setSelectedCustomer(existingOrder.customerId || '');
          setOrderDate(
            existingOrder.createdAt
              ? new Date(existingOrder.createdAt).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0]
          );
          setPaymentType(existingOrder.paymentType || (existingOrder.paymentStatus === 'paid' ? 'cash' : 'credit'));
          setDiscount(existingOrder.discount || 0);
          setNotes(existingOrder.notes || '');

          const rawItems = existingOrder.items ? (Array.isArray(existingOrder.items) ? existingOrder.items : Object.values(existingOrder.items)) : [];
          const itemsList = rawItems.map(item => {
            const prodMatch = prods.find(p => p.id === item.productId);
            return {
              productId: item.productId,
              productName: item.productName,
              sku: item.sku || '',
              quantity: Number(item.quantity) || 1,
              returnedQty: Number(item.returnedQty || item.returnedQuantity) || 0,
              salePrice: Number(item.salePrice) || 0,
              costPriceAtSale: Number(item.costPriceAtSale) || 0,
              currentStock: prodMatch ? (prodMatch.currentStock ?? 0) : (item.currentStock ?? 0)
            };
          });
          setOrderItems(itemsList);
        } else {
          toast.error('Order to edit was not found');
          navigate('/orders');
        }
      }
    } catch (err) {
      toast.error('Failed to load order data');
    }
    setInitialLoading(false);
  };

  const handleAddProduct = (product) => {
    // Check if already exists
    const existing = orderItems.find(i => i.productId === product.id);
    if (existing) {
      setOrderItems(orderItems.map(i => 
        i.productId === product.id 
          ? { ...i, quantity: i.quantity + 1, currentStock: product.currentStock ?? 0 } 
          : i
      ));
    } else {
      setOrderItems([...orderItems, {
        productId: product.id,
        productName: product.name,
        sku: product.sku || '',
        quantity: 1,
        returnedQty: 0,
        salePrice: product.salePrice || 0,
        costPriceAtSale: product.purchasePrice || 0, // IMPORTANT for historical profit
        currentStock: product.currentStock ?? 0
      }]);
    }
    setProductSearch(''); // clear search after add
    setShowProductDropdown(false);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...orderItems];
    newItems[index] = { 
      ...newItems[index], 
      [field]: value === '' ? '' : (Number(value) || 0) 
    };
    setOrderItems(newItems);
  };

  const removeItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = orderItems.reduce((sum, item) => {
    return sum + (item.salePrice * (Number(item.quantity) || 0));
  }, 0);
  
  const discountAmount = subtotal * (discount / 100);
  const grandTotal = subtotal - discountAmount;

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer / shop');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    if (orderItems.some(i => (Number(i.quantity) || 0) <= 0)) {
      toast.error('All quantities must be greater than 0');
      return;
    }

    for (const item of orderItems) {
      const minAllowed = Number(item.returnedQty) || 0;
      if (minAllowed > 0 && (Number(item.quantity) || 0) < minAllowed) {
        toast.error(`Quantity for "${item.productName}" cannot be less than returned quantity (${minAllowed})`);
        return;
      }
    }

    setLoading(true);
    try {
      const selectedDate = new Date(orderDate);
      const today = new Date();
      let customTimestamp = Date.now();
      if (selectedDate.toDateString() !== today.toDateString()) {
        selectedDate.setHours(12, 0, 0, 0);
        customTimestamp = selectedDate.getTime();
      }

      const customer = customers.find(c => c.id === selectedCustomer);
      const userId = currentUser?.uid || '';
      const userName = userProfile?.name || currentUser?.displayName || 'User';

      const cleanedItems = orderItems.map(item => ({
        productId: item.productId || '',
        productName: item.productName || '',
        sku: item.sku || '',
        quantity: Number(item.quantity) || 1,
        returnedQty: Number(item.returnedQty) || 0,
        salePrice: Number(item.salePrice) || 0,
        costPriceAtSale: Number(item.costPriceAtSale) || 0,
        lineTotal: Number(item.salePrice * item.quantity) || 0
      }));
      
      const orderData = {
        customerId: customer.id,
        customerName: customer.shopName || '',
        customerPhone: customer.phone || customer.mobile || '',
        customerAddress: customer.address || customer.shopAddress || '',
        status: 'confirmed',
        paymentType: paymentType || 'credit',
        items: cleanedItems,
        subtotal: Number(subtotal) || 0,
        discount: Number(discount) || 0,
        discountAmount: Number(discountAmount) || 0,
        grandTotal: Number(grandTotal) || 0,
        amountPaid: paymentType === 'cash' ? Number(grandTotal) : 0,
        notes: notes || '',
        createdAt: customTimestamp
      };

      if (isEditMode) {
        await updateOrder(
          companyId,
          id,
          orderData,
          userId,
          userName
        );
        toast.success(`Order ${existingOrderNumber} updated successfully`);
        navigate(`/orders/${id}`);
      } else {
        const result = await createOrder(
          companyId, 
          orderData, 
          userId, 
          userName
        );
        toast.success(`Order ${result.orderNumber} created successfully`);
        navigate(`/orders/${result.orderId}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save order');
      setLoading(false);
    }
  };

  const handleCreateQuickCustomer = async (e) => {
    if (e) e.preventDefault();
    if (!newCustomerForm.shopName.trim()) {
      toast.error('Shop / Company name is required');
      return;
    }
    if (!newCustomerForm.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    if (!newCustomerForm.address.trim()) {
      toast.error('Address is required');
      return;
    }

    setCreatingCustomer(true);
    try {
      const cid = await createCustomer(companyId, newCustomerForm, currentUser?.uid, userProfile?.name);
      const updatedCusts = await getCustomers(companyId);
      setCustomers(updatedCusts);
      setSelectedCustomer(cid);
      setShowNewCustomerModal(false);
      const createdName = newCustomerForm.shopName;
      setNewCustomerForm({ shopName: '', phone: '', email: '', address: '', notes: '' });
      toast.success(`Shop "${createdName}" created and selected!`);
    } catch (err) {
      toast.error(err.message || 'Failed to create shop');
    }
    setCreatingCustomer(false);
  };

  const availableCustomers = useMemo(() => {
    if (isAdmin) return customers;
    return customers.filter(c => c.createdBy === currentUser?.uid || c.createdByName === userProfile?.name);
  }, [customers, isAdmin, currentUser, userProfile]);

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

  if (initialLoading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner lg"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate(-1)}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          <h1>{isEditMode ? `Edit Order ${existingOrderNumber}` : 'Create Order'}</h1>
        </div>
        <div className="page-header-actions">
          <button 
            className="btn btn-primary btn-lg" 
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <span className="loading-spinner" /> : <Save size={16} />}
            {isEditMode ? 'Update Order' : 'Submit Order'}
          </button>
        </div>
      </div>

      <div className="grid-2col-responsive">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0, width: '100%' }}>
          
          {/* Customer Selection */}
          <div className="card" style={{ minWidth: 0, width: '100%' }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={18} className="text-muted" /> Customer / Shop
              </span>
              {hasPermission('createCustomers') && (
                <button 
                  type="button" 
                  className="btn btn-link btn-sm" 
                  onClick={() => setShowNewCustomerModal(true)}
                >
                  + Add New Shop
                </button>
              )}
            </div>
            <div className="card-body" style={{ minWidth: 0, width: '100%' }}>
              <div className="form-group mb-4">
                <label className="form-label">Order Date *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={orderDate}
                  onChange={e => setOrderDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group mb-4">
                <label className="form-label">Payment Mode *</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className={`btn ${paymentType === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '10px 16px', fontWeight: 600 }}
                    onClick={() => setPaymentType('cash')}
                  >
                    💵 Cash Order
                  </button>
                  <button
                    type="button"
                    className={`btn ${paymentType === 'credit' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '10px 16px', fontWeight: 600 }}
                    onClick={() => setPaymentType('credit')}
                  >
                    💳 Credit Order
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Select Customer / Shop *</label>
                <select 
                  className="form-select" 
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                >
                  <option value="">-- Select Customer / Shop --</option>
                  {availableCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.shopName} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Product Selection */}
          <div className="card" style={{ minWidth: 0, width: '100%' }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} className="text-muted" /> Products
              </span>
            </div>
            <div className="card-body" style={{ minWidth: 0, width: '100%' }}>
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
                
                {/* Search Dropdown */}
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
                            <div className="result-title">{p.name}</div>
                            <div className="result-sub">Stock: {p.currentStock} | Price: {formatCurrency(p.salePrice, currency)}</div>
                          </div>
                          <button className="btn btn-ghost btn-sm"><Plus size={14} /> Add</button>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                        No products found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Items */}
              {orderItems.length > 0 ? (
                <div style={{ minWidth: 0, width: '100%' }}>
                  {/* Desktop Table View */}
                  <div className="table-container order-items-desktop" style={{ border: 'var(--border)', borderRadius: 'var(--radius-sm)', minWidth: 0, width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', minWidth: '460px' }}>
                      <thead style={{ background: 'var(--gray-25)' }}>
                        <tr>
                          <th>Product</th>
                          <th style={{ width: 100 }}>Price</th>
                          <th style={{ width: 100 }}>Qty</th>
                          <th style={{ width: 100 }}>Total</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <div className="font-medium">{item.productName}</div>
                              <div className="text-xs text-muted">Stock: {item.currentStock}</div>
                              {item.returnedQty > 0 && (
                                <div style={{ fontSize: '11px', color: 'var(--danger-600)', fontWeight: 600, marginTop: 2 }}>
                                  ({item.returnedQty} returned)
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="font-medium" style={{ padding: '6px 0' }}>
                                {formatCurrency(item.salePrice, currency)}
                              </div>
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: 'var(--font-size-sm)', width: '70px' }}
                                value={item.quantity}
                                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                min="0"
                              />
                              {item.returnedQty > 0 && (
                                <div className="text-xs text-muted" style={{ fontSize: '10px', marginTop: 2 }}>
                                  Min: {item.returnedQty}
                                </div>
                              )}
                            </td>
                            <td className="font-medium">
                              {formatCurrency(item.salePrice * item.quantity, currency)}
                            </td>
                            <td>
                              <button className="table-action-btn" style={{ color: 'var(--danger-500)' }} onClick={() => removeItem(idx)}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="order-items-mobile" style={{ flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {orderItems.map((item, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          padding: 'var(--space-3)', 
                          border: 'var(--border)', 
                          borderRadius: 'var(--radius-md)', 
                          background: 'white',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-2)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                            <div className="font-medium" style={{ fontSize: 'var(--font-size-base)', wordBreak: 'break-word' }}>{item.productName}</div>
                            <div className="text-xs text-muted" style={{ display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                              <span>Stock: {item.currentStock}</span>
                              <span>•</span>
                              <span>Price: {formatCurrency(item.salePrice, currency)}</span>
                            </div>
                            {item.returnedQty > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--danger-600)', fontWeight: 600, marginTop: 2 }}>
                                ({item.returnedQty} returned)
                              </div>
                            )}
                          </div>
                          <button className="table-action-btn" style={{ color: 'var(--danger-500)', padding: '4px' }} onClick={() => removeItem(idx)}>
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--gray-100)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="text-xs text-muted font-medium">Qty:</span>
                            <input 
                              type="number" 
                              className="form-input" 
                              style={{ padding: '6px 8px', fontSize: 'var(--font-size-sm)', width: '80px' }}
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                              min="0"
                            />
                            {item.returnedQty > 0 && (
                              <span className="text-xs text-muted" style={{ fontSize: '10px' }}>
                                (Min: {item.returnedQty})
                              </span>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className="text-xs text-muted" style={{ display: 'block' }}>Total</span>
                            <span className="font-bold text-primary-600" style={{ fontSize: 'var(--font-size-base)' }}>
                              {formatCurrency(item.salePrice * item.quantity, currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-6)', border: '1px dashed var(--gray-300)', borderRadius: 'var(--radius-md)' }}>
                  <Package size={24} style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }} />
                  <p className="text-sm text-muted">No products added yet.<br/>Search above to add products.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="card">
            <div className="card-header"><span className="card-title">Notes</span></div>
            <div className="card-body">
              <textarea 
                className="form-textarea" 
                placeholder="Any specific instructions or notes for this order..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card" style={{ position: 'sticky', top: 'calc(var(--navbar-height) + var(--space-6))' }}>
            <div className="card-header">
              <span className="card-title">Order Summary</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="text-muted">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span className="text-muted">Discount (%)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ width: 80, padding: '4px 8px', textAlign: 'right' }}
                    value={discount}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (val >= 0 && val <= 100) setDiscount(val);
                    }}
                    min="0"
                    max="100"
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--danger-600)', width: 80, textAlign: 'right' }}>
                    - {formatCurrency(discountAmount, currency)}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: 'var(--border)', paddingTop: 'var(--space-3)', marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-lg)', fontWeight: 'bold' }}>
                <span>Grand Total</span>
                <span style={{ color: 'var(--primary-600)' }}>{formatCurrency(grandTotal, currency)}</span>
              </div>
            </div>
            <div className="card-footer">
              <button 
                className="btn btn-primary btn-block btn-lg" 
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? <span className="loading-spinner" /> : (isEditMode ? 'Update Order' : 'Confirm Order')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Shop Modal */}
      {showNewCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowNewCustomerModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Store size={18} /> Add New Shop / Customer
              </h3>
              <button 
                type="button" 
                className="modal-close" 
                onClick={() => setShowNewCustomerModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateQuickCustomer}>
              <div className="modal-body form-grid form-grid-2col">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Shop / Company Name *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Downtown Retailers"
                    value={newCustomerForm.shopName}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, shopName: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="e.g. 03001234567"
                    value={newCustomerForm.phone}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email <span className="text-muted font-normal">(Optional)</span></label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="shop@email.com"
                    value={newCustomerForm.email}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Address *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Street, City, Sector..."
                    value={newCustomerForm.address}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notes <span className="text-muted font-normal">(Optional)</span></label>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Any additional notes..."
                    value={newCustomerForm.notes}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={() => setShowNewCustomerModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={creatingCustomer}
                >
                  {creatingCustomer ? <span className="loading-spinner" /> : <Save size={16} />} Save Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
