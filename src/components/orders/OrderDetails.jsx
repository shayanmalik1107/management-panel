import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, FileText, CheckCircle, Clock, Truck, XCircle, RotateCcw } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { getOrder, updateOrderStatus } from '../../services/orderService';
import { onSyncStatusChange, processOutbox } from '../../services/syncEngine';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../../utils/constants';
import OrderReturnModal from './OrderReturnModal';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId, companyInfo, currentUser, userProfile, isAdmin, hasPermission } = useAuth();
  const toast = useToast();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  const currency = companyInfo?.currency || 'Rs';
  
  // Permissions
  const canEditOwnOrders = hasPermission('editOwnOrders');
  const canCancelOwnOrders = hasPermission('cancelOwnOrders');
  
  const isOwner = order?.employeeId === currentUser?.uid || order?.createdBy === currentUser?.uid;
  const canChangeStatus = isAdmin || (isOwner && canEditOwnOrders);
  const canCancel = isAdmin || (isOwner && canCancelOwnOrders);

  useEffect(() => {
    if (!companyId || !id) return;
    loadOrder(true);

    // Live subscription to RTDB for when internet comes back or remote changes happen
    const orderRef = ref(database, `companies/${companyId}/orders/${id}`);
    const unsubRTDB = onValue(orderRef, (snap) => {
      if (snap.exists()) {
        setOrder({ id: snap.key, ...snap.val(), isPendingSync: false });
        setLoading(false);
      }
    }, () => {});

    // Live subscription to local sync engine
    const unsubSync = onSyncStatusChange(() => {
      loadOrder(false);
    });

    const handleOnline = () => {
      processOutbox(companyId);
      loadOrder(false);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      unsubRTDB();
      unsubSync();
      window.removeEventListener('online', handleOnline);
    };
  }, [companyId, id]);

  const loadOrder = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await getOrder(companyId, id);
      if (!data) {
        if (showSpinner) {
          toast.error('Order not found');
          navigate('/orders');
        }
        return;
      }
      
      // Access check
      if (!isAdmin && currentUser?.uid && data.employeeId !== currentUser.uid && data.createdBy !== currentUser.uid) {
        toast.error('You do not have permission to view this order');
        navigate('/orders');
        return;
      }
      
      setOrder(data);
    } catch (err) {
      if (showSpinner) toast.error('Failed to load order');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!confirm(`Are you sure you want to change the order status to ${ORDER_STATUS_LABELS[newStatus]}?`)) return;
    
    setStatusUpdating(true);
    try {
      await updateOrderStatus(companyId, id, newStatus, currentUser.uid, userProfile.name);
      toast.success(`Order status updated to ${ORDER_STATUS_LABELS[newStatus]}`);
      await loadOrder();
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
    setStatusUpdating(false);
  };

  const handlePaymentTypeChange = async (newPaymentType) => {
    if (!confirm(`Are you sure you want to change order mode to ${newPaymentType.toUpperCase()}?`)) return;
    setStatusUpdating(true);
    try {
      await updateOrderPaymentType(companyId, id, newPaymentType, currentUser.uid, userProfile.name);
      toast.success(`Order mode updated to ${newPaymentType.toUpperCase()}`);
      await loadOrder();
    } catch (err) {
      toast.error(err.message || 'Failed to update payment mode');
    }
    setStatusUpdating(false);
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner lg"></div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-breadcrumb">
            <button className="btn btn-link" onClick={() => navigate('/orders')}>
              <ArrowLeft size={14} /> Back to Orders
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1>Order {order.orderNumber}</h1>
            <span className={`badge badge-${ORDER_STATUS_COLORS[order.status] || 'gray'}`} style={{ fontSize: 'var(--font-size-sm)', padding: '4px 10px' }}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            {order.isPendingSync ? (
              <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                ⏳ Offline
              </span>
            ) : (order.syncedAt || order.orderNumber?.startsWith('ORD-OFF-')) ? (
              <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                ✓ Synced
              </span>
            ) : null}
          </div>
          <p className="text-muted text-sm">Created on {formatDate(order.createdAt, 'long')} by {order.createdByName}</p>
        </div>
        <div className="page-header-actions no-print">
          <button className="btn btn-secondary" onClick={() => setShowReturnModal(true)}>
            <RotateCcw size={16} /> Process Return
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          
          {canChangeStatus && order.status !== 'cancelled' && order.status !== 'returned' && (
            <div className="dropdown">
              <select 
                className="btn btn-primary"
                style={{ appearance: 'none', paddingRight: 'var(--space-4)' }}
                value={order.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusUpdating}
              >
                <option value="pending">Mark Pending</option>
                <option value="confirmed">Mark Confirmed</option>
                <option value="processing">Mark Processing</option>
                <option value="delivered">Mark Delivered</option>
                {canCancel && <option value="cancelled">Cancel Order</option>}
                <option value="returned">Mark Returned</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2col-responsive">
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Order Items */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Order Items</span>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead style={{ background: 'var(--gray-25)' }}>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Discount</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(order.items || {}).map(([key, item]) => (
                    <tr key={key}>
                      <td>
                        <div className="font-medium">{item.productName}</div>
                        {item.sku && <div className="text-xs text-muted">SKU: {item.sku}</div>}
                      </td>
                      <td>{formatCurrency(item.salePrice, currency)}</td>
                      <td>
                        <div>{item.quantity}</div>
                        {item.returnedQty > 0 && (
                          <div className="text-xs font-medium" style={{ color: 'var(--danger-600)' }}>
                            ({item.returnedQty} returned)
                          </div>
                        )}
                      </td>
                      <td>{formatCurrency(item.discount, currency)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {formatCurrency(item.lineTotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Notes</span>
              </div>
              <div className="card-body">
                <p style={{ whiteSpace: 'pre-wrap', color: 'var(--gray-700)' }}>{order.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          
          {/* Customer Info */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Customer Details</span>
            </div>
            <div className="card-body">
              <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-1)' }}>{order.customerName}</h3>
              <p className="text-sm text-muted mb-4">Customer ID: {order.customerId}</p>
              
              <button 
                className="btn btn-secondary btn-sm btn-block"
                onClick={() => navigate(`/customers/${order.customerId}`)}
              >
                View Customer Profile
              </button>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Payment Summary</span>
            </div>
            <div className="card-body">
              {(() => {
                const isCashMode = order.paymentType === 'cash' || order.paymentStatus === 'paid';
                return (
                  <div style={{ marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: 'var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-muted text-sm font-medium">Payment Mode</span>
                    <span className={`badge badge-${isCashMode ? 'green' : 'orange'}`} style={{ fontSize: 'var(--font-size-sm)' }}>
                      <span className="badge-dot" />
                      {isCashMode ? 'Cash' : 'Credit'}
                    </span>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="text-muted text-sm">Subtotal</span>
                <span>{formatCurrency(order.subtotal, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="text-muted text-sm">Discount</span>
                <span style={{ color: order.discount > 0 ? 'var(--danger-600)' : 'inherit' }}>
                  {order.discount > 0 ? `${order.discount}% (-${formatCurrency(order.discountAmount || (order.subtotal * (order.discount / 100)), currency)})` : '0%'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <span className="text-muted text-sm">Tax</span>
                <span>{formatCurrency(order.tax, currency)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderTop: 'var(--border)' }}>
                <span className="font-semibold">Actual Grand Total</span>
                <span className="font-semibold">{formatCurrency(order.grandTotal, currency)}</span>
              </div>

              {Number(order.returnedAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', color: 'var(--danger-600)' }}>
                  <span className="font-medium">Returned Amount</span>
                  <span className="font-medium">- {formatCurrency(order.returnedAmount, currency)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderTop: 'var(--border)', borderBottom: 'var(--border)', marginBottom: 'var(--space-3)' }}>
                <span className="font-bold">Net Total</span>
                <span className="font-bold text-primary-600" style={{ color: 'var(--primary-600)', fontSize: 'var(--font-size-md)' }}>
                  {formatCurrency((order.grandTotal || 0) - (Number(order.returnedAmount) || 0), currency)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="text-muted text-sm">Amount Paid</span>
                <span className="font-medium text-success-600" style={{ color: 'var(--success-600)' }}>
                  {formatCurrency(order.amountPaid, currency)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted text-sm">Balance Due</span>
                <span className="font-medium" style={{ color: (((order.grandTotal || 0) - (Number(order.returnedAmount) || 0)) - order.amountPaid) > 0 ? 'var(--warning-600)' : 'var(--gray-700)' }}>
                  {formatCurrency(((order.grandTotal || 0) - (Number(order.returnedAmount) || 0)) - order.amountPaid, currency)}
                </span>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {showReturnModal && (
        <OrderReturnModal
          order={order}
          companyId={companyId}
          currentUser={currentUser}
          userProfile={userProfile}
          currency={currency}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => loadOrder()}
        />
      )}
    </div>
  );
}
