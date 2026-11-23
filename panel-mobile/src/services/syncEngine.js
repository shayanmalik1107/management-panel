// LAMBA local-first sync engine.
// Offline orders are applied in a single RTDB transaction at company scope so
// the order marker, stock movements, stock changes and customer balance update
// commit together and can safely be retried.
import { ref, update, runTransaction } from 'firebase/database';
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
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  try {
    const response = await fetch('/favicon.svg?sync=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch (_) {
    try {
      const ping = await fetch('/favicon.svg', { method: 'GET', cache: 'no-store' });
      return ping.ok;
    } catch (_) {
      return typeof navigator !== 'undefined' ? navigator.onLine : false;
    }
  }
}

export async function processOutbox(companyId) {
  if (isSyncRunning) return { skipped: true, reason: 'Already running' };
  if (!companyId) return { skipped: true, reason: 'No active company' };
  if (!(await checkConnectivity())) {
    notifyListeners({ isSyncing: false, isOnline: false });
    return { skipped: true, reason: 'Offline' };
  }

  const activeUid = auth.currentUser?.uid || getActiveCachedUserId();
  if (!activeUid) return { skipped: true, reason: 'No verified account session' };
  isSyncRunning = true;
  notifyListeners({ isSyncing: true, isOnline: true });
  let successCount = 0;
  let failCount = 0;
  try {
    const items = (await getOutboxItems(companyId)).filter((item) => !item.userId || !activeUid || item.userId === activeUid);
    // FIFO is important: a product/customer created locally may be referenced by
    // a later operation in the same device's queue.
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
        // Preserve order: do not process later dependent actions after a failure.
        break;
      }
    }
  } finally {
    isSyncRunning = false;
    const remaining = (await getOutboxItems(companyId).catch(() => [])).filter((item) => item.userId === activeUid);
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
  const remaining = (await getOutboxItems(companyId)).filter((item) => item.userId === activeUid);
  return { successCount, failCount, remainingCount: remaining.length };
}

async function applyOfflineOrder(item) {
  const { companyId, payload, userId, userName } = item;
  const { orderId, orderNumber, order, customerUpdates, activity, notification } = payload;
  if (!orderId || !order) throw new Error('Offline order payload is incomplete.');

  const companyRef = ref(database, `companies/${companyId}`);
  const now = Date.now();
  const result = await runTransaction(companyRef, (company) => {
    if (!company) return; // Abort if the company no longer exists.
    company.processedOfflineOrders ||= {};
    if (company.processedOfflineOrders[orderId]) return company; // Idempotent retry.

    company.orders ||= {};
    company.products ||= {};
    company.stockMovements ||= {};
    company.activities ||= {};
    company.notifications ||= {};

    const cloudOrder = { ...order, isPendingSync: false, syncedAt: now };
    company.orders[orderId] = cloudOrder;

    // Deduct the actual current cloud stock at sync time. Negative stock is
    // intentionally allowed per the agreed Option B behavior.
    if (order.status !== 'draft') {
      const items = Array.isArray(order.items)
        ? order.items
        : Object.values(order.items || {});
      const aggregated = new Map();
      for (const line of items) {
        if (!line?.productId) continue;
        const qty = Number(line.quantity) || 0;
        aggregated.set(line.productId, (aggregated.get(line.productId) || 0) + qty);
      }
      for (const [productId, quantity] of aggregated.entries()) {
        const product = company.products[productId];
        if (!product) throw new Error(`Product ${productId} no longer exists. Order ${orderNumber} remains pending.`);
        product.currentStock = (Number(product.currentStock) || 0) - quantity;
        const movementId = `sale_${orderId}_${productId}`;
        company.stockMovements[movementId] = {
          id: movementId,
          type: 'sale',
          productId,
          productName: product.name || items.find((line) => line.productId === productId)?.productName || 'Product',
          quantity: -quantity,
          referenceId: orderId,
          referenceType: 'order',
          referenceNumber: orderNumber,
          createdBy: userId,
          createdAt: Number(order.createdAt) || now,
          syncedAt: now,
        };
      }

      if (customerUpdates?.customerId) {
        const customer = company.customers?.[customerUpdates.customerId];
        if (!customer) throw new Error(`Customer ${customerUpdates.customerId} no longer exists. Order ${orderNumber} remains pending.`);
        customer.currentBalance = (Number(customer.currentBalance) || 0) + (Number(customerUpdates.balanceChange) || 0);
        customer.totalOrders = (Number(customer.totalOrders) || 0) + (Number(customerUpdates.totalOrdersInc) || 0);
        customer.totalSales = (Number(customer.totalSales) || 0) + (Number(customerUpdates.totalSalesInc) || 0);
        customer.lastOrderDate = Number(order.createdAt) || now;
      }
    }

    if (activity?.id) company.activities[activity.id] = { ...activity, syncedAt: now };
    if (notification?.id) company.notifications[notification.id] = { ...notification, syncedAt: now };
    company.onboarding ||= {};
    company.onboarding.firstOrder = true;
    company.processedOfflineOrders[orderId] = { processedAt: now, deviceId: item.deviceId || null, userId };
    return company;
  }, { applyLocally: false });

  if (!result.committed && !result.snapshot.exists()) {
    throw new Error('Order sync was not committed. Please retry when connected.');
  }
  if (result.committed || result.snapshot.exists()) {
    try {
      await addToCachedCollection(companyId, 'orders', { id: orderId, ...order, isPendingSync: false, syncedAt: now });
    } catch (_) {}
    return;
  }
  throw new Error('Order sync was not acknowledged by Firebase.');
}

async function processSingleItem(item) {
  const { actionType, companyId, payload } = item;
  const updates = {};
  switch (actionType) {
    case 'create_order':
      return applyOfflineOrder(item);
    case 'create_customer': {
      const { customerId, customer, activity } = payload;
      updates[`companies/${companyId}/customers/${customerId}`] = { ...customer, isPendingSync: false, syncedAt: Date.now() };
      if (activity) updates[`companies/${companyId}/activities/${activity.id}`] = activity;
      updates[`companies/${companyId}/onboarding/firstCustomer`] = true;
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
  if (typeof window === 'undefined') return;
  const triggerSync = () => {
    processOutbox(companyId);
    setTimeout(() => processOutbox(companyId), 1200);
    setTimeout(() => processOutbox(companyId), 3000);
  };
  const handleOnline = () => { triggerSync(); };
  const handleOffline = () => notifyListeners({ isOnline: false, isSyncing: false });
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  const interval = setInterval(async () => {
    if (navigator.onLine) {
      try {
        const outbox = await getOutboxItems(companyId);
        if (outbox.length > 0) processOutbox(companyId);
      } catch (_) {}
    }
  }, 10000);
  // Try once on workspace entry too.
  if (navigator.onLine) triggerSync();
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(interval);
  };
}
