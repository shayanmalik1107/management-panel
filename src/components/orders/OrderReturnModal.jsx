import { useState } from 'react';
import { X, RotateCcw, AlertCircle } from 'lucide-react';
import { processOrderReturn } from '../../services/orderService';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency } from '../../utils/formatters';

export default function OrderReturnModal({ order, companyId, currentUser, userProfile, currency = 'Rs', onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  const rawItems = order.items ? Object.entries(order.items) : [];
  
  // State mapping itemKey to returnQty
  const [returnQtys, setReturnQtys] = useState(() => {
    const initial = {};
    rawItems.forEach(([key, item]) => {
      initial[key] = 0;
    });
    return initial;
  });

  const discountPct = Number(order.discount) || 0;

  // Calculate live return refund amount
  let totalRefund = 0;
  rawItems.forEach(([key, item]) => {
    const qty = Number(returnQtys[key]) || 0;
    if (qty > 0) {
      const effectivePrice = Number(item.salePrice || 0) * (1 - (discountPct / 100));
      totalRefund += qty * effectivePrice;
    }
  });

  const handleQtyChange = (key, maxAllowed, val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 0) {
      setReturnQtys(prev => ({ ...prev, [key]: 0 }));
    } else if (parsed > maxAllowed) {
      setReturnQtys(prev => ({ ...prev, [key]: maxAllowed }));
    } else {
      setReturnQtys(prev => ({ ...prev, [key]: parsed }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const returnItemsToProcess = [];
    rawItems.forEach(([key, item]) => {
      const returnQty = Number(returnQtys[key]) || 0;
      if (returnQty > 0) {
        returnItemsToProcess.push({
          itemKey: key,
          productId: item.productId,
          productName: item.productName,
          returnQty,
          salePrice: item.salePrice
        });
      }
    });

    if (returnItemsToProcess.length === 0) {
      toast.error('Please enter at least 1 returned item quantity');
      return;
    }

    setLoading(true);
    try {
      const res = await processOrderReturn(
        companyId,
        order.id,
        returnItemsToProcess,
        reason,
        currentUser.uid,
        userProfile?.name || 'User'
      );

      toast.success(`Return processed successfully! Refund Amount: ${formatCurrency(res.totalReturnAmount, currency)}`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to process return');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RotateCcw size={20} className="text-primary-600" />
            <h3 className="modal-title">Process Return — Order {order.orderNumber}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: 'var(--gray-50)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
              <div>
                <span className="text-muted">Customer / Shop: </span>
                <strong>{order.customerName}</strong>
              </div>
              <div>
                <span className="text-muted">Original Total: </span>
                <strong>{formatCurrency(order.grandTotal, currency)}</strong>
              </div>
            </div>

            <p className="text-sm text-muted mb-3">Select the quantity of each item being returned. Inventory stock will automatically be restored.</p>

            <div className="table-container mb-4" style={{ border: 'var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <table className="data-table">
                <thead style={{ background: 'var(--gray-25)' }}>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th style={{ textAlign: 'center' }}>Ordered Qty</th>
                    <th style={{ textAlign: 'center' }}>Already Returned</th>
                    <th style={{ width: 120, textAlign: 'center' }}>Return Qty</th>
                    <th style={{ textAlign: 'right' }}>Est. Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {rawItems.map(([key, item]) => {
                    const ordered = Number(item.quantity) || 0;
                    const alreadyReturned = Number(item.returnedQty) || 0;
                    const maxAllowed = Math.max(0, ordered - alreadyReturned);
                    const currentInput = returnQtys[key] || 0;
                    const effectivePrice = Number(item.salePrice || 0) * (1 - (discountPct / 100));
                    const lineRefund = currentInput * effectivePrice;

                    return (
                      <tr key={key}>
                        <td>
                          <div className="font-medium">{item.productName}</div>
                          {item.sku && <div className="text-xs text-muted">SKU: {item.sku}</div>}
                        </td>
                        <td>{formatCurrency(item.salePrice, currency)}</td>
                        <td style={{ textAlign: 'center' }} className="font-medium">{ordered}</td>
                        <td style={{ textAlign: 'center' }}>
                          {alreadyReturned > 0 ? (
                            <span className="badge badge-orange" style={{ fontSize: '11px' }}>
                              {alreadyReturned} returned
                            </span>
                          ) : (
                            <span className="text-muted">0</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {maxAllowed > 0 ? (
                            <input
                              type="number"
                              className="form-input text-center"
                              style={{ padding: '4px 8px', fontSize: 'var(--font-size-sm)' }}
                              min="0"
                              max={maxAllowed}
                              value={currentInput}
                              onChange={e => handleQtyChange(key, maxAllowed, e.target.value)}
                            />
                          ) : (
                            <span className="badge badge-gray" style={{ fontSize: '11px' }}>Fully Returned</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: currentInput > 0 ? 'var(--primary-600)' : 'inherit' }}>
                          {formatCurrency(lineRefund, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="form-group mb-4">
              <label className="form-label">Return Reason / Notes</label>
              <textarea
                className="form-textarea"
                placeholder="Reason for return (e.g. damaged goods, wrong product, customer requested)..."
                rows="2"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            {totalRefund > 0 && (
              <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-medium text-primary-900">Total Refund / Deduction:</span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--primary-700)' }}>
                  {formatCurrency(totalRefund, currency)}
                </span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || totalRefund <= 0}>
              {loading ? <span className="loading-spinner" /> : <RotateCcw size={16} />}
              Confirm Return ({formatCurrency(totalRefund, currency)})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
