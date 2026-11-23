// LAMBA local-first sync engine.
// Offline orders are applied in a single RTDB transaction at company scope so
// the order marker, stock movements, stock changes and customer balance update
// commit together and can safely be retried.
import { ref, get, update, runTransaction, onValue } from 'firebase/database';
import { Network } from '@capacitor/network';
import { auth, database } from '../firebase';
import { getOutboxItems, removeOutboxItem, updateOutboxItem, getActiveCachedUserId, addToCachedCollection } from './offlineStorage';

let isSyncRunning = false;
const listeners = new Set();

export function onSyncStatusChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners(status) {
  listeners.forEach((callback) => {
    try { callback(status); } catch (error) { console.error('[Sync Engine] Listener error:', error); }
  });
}

export async function checkConnectivity() {
  try {
    const status = await Network.getStatus();
    if (!status.connected) return false;
    return true;
  } catch (_) {
    return typeof navigator !== 'undefined' ? navigator.onLine : false;
  }
}

export async function processOutbox(companyId) {
  if (isSyncRunning) return { skipped: true, reason: 'Already running' };
  if (!companyId) return { skipped: true, reason: 'No active company' };
  if (!(await checkConnectivity())) {
    notifyListeners({ isSyncing: false, isOnline: false });
    return { skipped: true, reason: 'Offline' };
  }

  isSyncRunning = true;
  notifyListeners({ isSyncing: true, isOnline: true });
  let successCount = 0;
  let failCount = 0;
  try {
    // Priority order: Create customers and products first, so orders can reference them!
    const ACTION_PRIORITY = {
      create_customer: 1,
      update_customer: 2,
      create_product: 3,
      update_product: 4,
      create_order: 5,
      create_payment: 6,
    };

    let items = await getOutboxItems(companyId);
    items.sort((a, b) => {
      const pA = ACTION_PRIORITY[a.actionType] || 10;
      const pB = ACTION_PRIORITY[b.actionType] || 10;
      if (pA !== pB) return pA - pB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    for (const item of items) {
      try {
        await updateOutboxItem(item.id, { status: 'syncing', lastAttemptAt: Date.now() });
        await processSingleItem(item);
        // Only delete after Firebase confirms the operation.
        await removeOutboxItem(item.id);
        successCount += 1;
      } catch (error) {
        console.error(`[Sync Engine] Failed ${item.actionType} (${item.id}):`, error);
        await updateOutboxItem(item.id, {
          status: 'error',
          lastError: error?.message || 'Sync failed',
          retryCount: (item.retryCount || 0) + 1,
          lastAttemptAt: Date.now(),
        });
        failCount += 1;
        // Continue processing remaining independent queue items
      }
    }
  } finally {
    isSyncRunning = false;
    const remaining = await getOutboxItems(companyId).catch(() => []);
    const status = {
      isSyncing: false,
      isOnline: true,
      lastSyncTime: Date.now(),
      successCount,
      failCount,
      remainingCount: remaining.length,
      remainingItems: remaining,
    };
    notifyListeners(status);
  }
  const remaining = await getOutboxItems(companyId).catch(() => []);
  return { successCount, failCount, remainingCount: remaining.length };
}

async function applyOfflineOrder(item) {
  const { companyId, payload, userId, userName } = item;
  const { orderId, orderNumber, order, customerUpdates, activity, notification } = payload;
  if (!orderId || !order) throw new Error('Offline order payload is incomplete.');

  const now = Date.now();

  // 1. Idempotency check: see if already processed in cloud
  try {
    const processedSnap = await get(ref(database, `companies/${companyId}/processedOfflineOrders/${orderId}`));
    if (processedSnap.exists()) {
      await addToCachedCollection(companyId, 'orders', { id: orderId, ...order, isPendingSync: false, syncedAt: now });
      return;
    }
  } catch (_) {}

  // 2. Check if employee was removed prior to order creation
  let isPostRemovalOrder = false;
  let removedInfo = null;
  if (userId) {
    try {
      const removedSnap = await get(ref(database, `companies/${companyId}/removedEmployees/${userId}`));
      if (removedSnap.exists()) {
        removedInfo = removedSnap.val();
        const orderCreatedAt = Number(order.createdAt) || 0;
        if (removedInfo.removedAt && orderCreatedAt >= removedInfo.removedAt) {
          isPostRemovalOrder = true;
        }
      }
    } catch (_) {}
  }

  const updates = {};

  if (isPostRemovalOrder) {
    updates[`companies/${companyId}/pendingRemovedEmployeeOrders/${orderId}`] = {
      ...order,
      id: orderId,
      orderId,
      orderNumber,
      customerUpdates: customerUpdates || null,
      activity: activity || null,
      isPendingSync: false,
      requiresAdminApproval: true,
      reviewStatus: 'pending',
      submittedAt: now,
      employeeRemovedAt: removedInfo.removedAt,
      employeeName: removedInfo.name || userName || 'Removed Employee',
    };

    const notifId = `notif_rev_${orderId}`;
    updates[`companies/${companyId}/notifications/${notifId}`] = {
      id: notifId,
      type: 'removed_employee_order_review',
      targetRole: 'admin',
      title: '⚠️ Order Created After Employee Removal',
      message: `Order #${orderNumber} (${order.currency || 'Rs'} ${(order.grandTotal || 0).toLocaleString()}) was created offline by removed employee "${removedInfo.name || userName}" AFTER they were removed. Action required: Accept or Reject.`,
      orderId,
      orderNumber,
      employeeId: userId,
      employeeName: removedInfo.name || userName,
      timestamp: now,
      read: false,
      reviewStatus: 'pending',
    };

    updates[`companies/${companyId}/processedOfflineOrders/${orderId}`] = { processedAt: now, deviceId: item.deviceId || null, userId, routedToReview: true };
    await update(ref(database), updates);
    return;
  }

  // 3. Normal order sync
  const cloudOrder = { ...order, isPendingSync: false, syncedAt: now };
  updates[`companies/${companyId}/orders/${orderId}`] = cloudOrder;

  // Deduct actual product stock
  if (order.status !== 'draft') {
    const items = Array.isArray(order.items) ? order.items : Object.values(order.items || {});
    for (const line of items) {
      if (!line?.productId) continue;
      const qty = Number(line.quantity) || 0;
      try {
        const prodSnap = await get(ref(database, `companies/${companyId}/products/${line.productId}/currentStock`));
        if (prodSnap.exists()) {
          const currentStock = Number(prodSnap.val()) || 0;
          updates[`companies/${companyId}/products/${line.productId}/currentStock`] = currentStock - qty;
        }
      } catch (_) {}

      const movementId = `sale_${orderId}_${line.productId}`;
      updates[`companies/${companyId}/stockMovements/${movementId}`] = {
        id: movementId,
        type: 'sale',
        productId: line.productId,
        productName: line.productName || 'Product',
        quantity: -qty,
        referenceId: orderId,
        referenceType: 'order',
        referenceNumber: orderNumber,
        createdBy: userId,
        createdAt: Number(order.createdAt) || now,
        syncedAt: now,
      };
    }

    // Update or initialize customer record
    if (customerUpdates?.customerId) {
      try {
        const custSnap = await get(ref(database, `companies/${companyId}/customers/${customerUpdates.customerId}`));
        if (custSnap.exists()) {
          const c = custSnap.val();
          updates[`companies/${companyId}/customers/${customerUpdates.customerId}/currentBalance`] = (Number(c.currentBalance) || 0) + (Number(customerUpdates.balanceChange) || 0);
          updates[`companies/${companyId}/customers/${customerUpdates.customerId}/totalOrders`] = (Number(c.totalOrders) || 0) + (Number(customerUpdates.totalOrdersInc) || 0);
          updates[`companies/${companyId}/customers/${customerUpdates.customerId}/totalSales`] = (Number(c.totalSales) || 0) + (Number(customerUpdates.totalSalesInc) || 0);
          updates[`companies/${companyId}/customers/${customerUpdates.customerId}/lastOrderDate`] = Number(order.createdAt) || now;
        } else {
          updates[`companies/${companyId}/customers/${customerUpdates.customerId}`] = {
            id: customerUpdates.customerId,
            companyId,
            shopName: order.customerName || 'Customer',
            openingBalance: 0,
            currentBalance: Number(customerUpdates.balanceChange) || 0,
            totalOrders: Number(customerUpdates.totalOrdersInc) || 1,
            totalSales: Number(customerUpdates.totalSalesInc) || 0,
            lastOrderDate: Number(order.createdAt) || now,
            createdBy: userId,
            createdAt: Number(order.createdAt) || now,
            updatedAt: now,
          };
        }
      } catch (_) {}
    }
  }

  if (activity?.id) updates[`companies/${companyId}/activities/${activity.id}`] = { ...activity, syncedAt: now };
  if (notification?.id) updates[`companies/${companyId}/notifications/${notification.id}`] = { ...notification, syncedAt: now };
  updates[`companies/${companyId}/onboarding/firstOrder`] = true;
  updates[`companies/${companyId}/processedOfflineOrders/${orderId}`] = { processedAt: now, deviceId: item.deviceId || null, userId };

  await update(ref(database), updates);

  try {
    await addToCachedCollection(companyId, 'orders', { id: orderId, ...order, isPendingSync: false, syncedAt: now });
  } catch (_) {}
}

async function processSingleItem(item) {
  const { actionType, companyId, payload } = item;
  const updates = {};
  switch (actionType) {
    case 'create_order':
      return applyOfflineOrder(item);
    case 'create_customer': {
      const { customerId, customer, activity } = payload;
      const syncedCustomer = { ...customer, isPendingSync: false, syncedAt: Date.now() };
      updates[`companies/${companyId}/customers/${customerId}`] = syncedCustomer;
      if (activity) updates[`companies/${companyId}/activities/${activity.id}`] = activity;
      updates[`companies/${companyId}/onboarding/firstCustomer`] = true;
      try {
        await addToCachedCollection(companyId, 'customers', { ...syncedCustomer, id: customerId });
      } catch (_) {}
      break;
    }
    case 'create_product': {
      const { productId, product, activity, initialPurchase } = payload;
      updates[`companies/${companyId}/products/${productId}`] = { ...product, isPendingSync: false, syncedAt: Date.now() };
      if (activity) updates[`companies/${companyId}/activities/${activity.id}`] = activity;
      if (initialPurchase?.id) updates[`companies/${companyId}/purchases/${initialPurchase.id}`] = initialPurchase;
      updates[`companies/${companyId}/onboarding/firstProduct`] = true;
      break;
    }
    case 'update_product': {
      const { productId, product, activity } = payload;
      if (!productId || !product) throw new Error('Product update payload is incomplete.');
      Object.entries(product).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'isPendingSync' && value !== undefined) updates[`companies/${companyId}/products/${productId}/${key}`] = value;
      });
      updates[`companies/${companyId}/products/${productId}/isPendingSync`] = false;
      updates[`companies/${companyId}/products/${productId}/syncedAt`] = Date.now();
      if (activity) updates[`companies/${companyId}/activities/${activity.id}`] = activity;
      break;
    }
    case 'create_payment': {
      const { paymentId, payment, customerId, newCreditBalance, activity } = payload;
      updates[`companies/${companyId}/payments/${paymentId}`] = payment;
      if (customerId) {
        updates[`companies/${companyId}/customers/${customerId}/currentBalance`] = newCreditBalance;
        updates[`companies/${companyId}/customers/${customerId}/updatedAt`] = Date.now();
      }
      if (activity) updates[`companies/${companyId}/activities/${activity.id}`] = activity;
      break;
    }
    default:
      throw new Error(`Unsupported offline action: ${actionType}`);
  }
  await update(ref(database), updates);
}

export function initAutoSync(companyId) {
  if (typeof window === 'undefined') return () => {};
  
  let networkListener = null;
  let unsubFirebase = null;

  const triggerSync = () => {
    processOutbox(companyId);
    setTimeout(() => processOutbox(companyId), 1200);
    setTimeout(() => processOutbox(companyId), 3000);
  };

  // 1. Web online/offline listeners
  const handleOnline = () => { triggerSync(); };
  const handleOffline = () => notifyListeners({ isOnline: false, isSyncing: false });
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // 2. Capacitor Network plugin listener (crucial for Android WebView auto-sync)
  try {
    Network.addListener('networkStatusChange', (status) => {
      console.log('[Sync Engine] Capacitor Network status change:', status);
      if (status.connected) {
        notifyListeners({ isOnline: true });
        triggerSync();
      } else {
        notifyListeners({ isOnline: false, isSyncing: false });
      }
    }).then(l => { networkListener = l; }).catch(() => {});
  } catch (_) {}

  // 3. Firebase RTDB WebSocket connection status listener
  try {
    const connectedRef = ref(database, '.info/connected');
    unsubFirebase = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        console.log('[Sync Engine] Firebase RTDB connected');
        notifyListeners({ isOnline: true });
        triggerSync();
      }
    });
  } catch (_) {}

  // 4. Fallback interval check every 5 seconds
  const interval = setInterval(async () => {
    try {
      const netStatus = await Network.getStatus().catch(() => ({ connected: navigator.onLine }));
      if (netStatus.connected) {
        const outbox = await getOutboxItems(companyId);
        if (outbox.length > 0) processOutbox(companyId);
      }
    } catch (_) {}
  }, 5000);

  // Initial trigger
  triggerSync();

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (networkListener && networkListener.remove) networkListener.remove();
    if (unsubFirebase) unsubFirebase();
    clearInterval(interval);
  };
}
