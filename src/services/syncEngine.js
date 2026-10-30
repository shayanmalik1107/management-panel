// Sync Engine — Chronological background processor from IndexedDB Outbox to Firebase
import { ref, update, get } from 'firebase/database';
import { database } from '../firebase';
import { getOutboxItems, removeOutboxItem, updateOutboxItem } from './offlineStorage';

let isSyncRunning = false;
const listeners = new Set();

/**
 * Register callback for sync status changes
 */
export function onSyncStatusChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners(status) {
  listeners.forEach(cb => {
    try {
      cb(status);
    } catch (err) {
      console.error('[Sync Engine] Listener error:', err);
    }
  });
}

/**
 * Check if browser has verified internet connectivity
 */
export async function checkConnectivity() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  // Try a lightweight heartbeat ping
  try {
    const response = await fetch('/favicon.svg?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Process all items currently queued in the IndexedDB outbox
 */
export async function processOutbox(companyId) {
  if (isSyncRunning) return { skipped: true, reason: 'Already running' };

  const isOnline = await checkConnectivity();
  if (!isOnline) {
    notifyListeners({ isSyncing: false, isOnline: false, count: 0 });
    return { skipped: true, reason: 'Offline' };
  }

  isSyncRunning = true;
  notifyListeners({ isSyncing: true, isOnline: true });

  const items = await getOutboxItems(companyId);
  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    try {
      await updateOutboxItem(item.id, { status: 'syncing' });
      await processSingleItem(item);
      await removeOutboxItem(item.id);
      successCount++;
    } catch (err) {
      console.error(`[Sync Engine] Failed to process ${item.actionType} (${item.id}):`, err);
      await updateOutboxItem(item.id, { 
        status: 'error', 
        lastError: err.message || 'Sync failed',
        retryCount: (item.retryCount || 0) + 1 
      });
      failCount++;
    }
  }

  isSyncRunning = false;
  const remaining = await getOutboxItems(companyId);
  notifyListeners({
    isSyncing: false,
    isOnline: true,
    lastSyncTime: Date.now(),
    successCount,
    failCount,
    remainingCount: remaining.length,
    remainingItems: remaining,
  });

  return { successCount, failCount, remainingCount: remaining.length };
}

/**
 * Execute a single action against Firebase Realtime Database
 */
async function processSingleItem(item) {
  const { actionType, companyId, payload, userId, userName } = item;
  const dbRef = ref(database);

  switch (actionType) {
    case 'create_order': {
      const { orderId, orderNumber, order, stockUpdates, customerUpdates, activity, notification } = payload;
      const updates = {};
      
      // Order record
      updates[`companies/${companyId}/orders/${orderId}`] = order;

      // Product stock updates & movements
      if (stockUpdates) {
        for (const [prodId, data] of Object.entries(stockUpdates)) {
          // Re-fetch current server stock to prevent race condition overwrite
          const currentStockSnap = await get(ref(database, `companies/${companyId}/products/${prodId}/currentStock`));
          const baseStock = currentStockSnap.exists() ? Number(currentStockSnap.val()) : (data.previousStock || 0);
          updates[`companies/${companyId}/products/${prodId}/currentStock`] = baseStock - Number(data.quantity);

          if (data.movement) {
            updates[`companies/${companyId}/stockMovements/${data.movement.id}`] = data.movement;
          }
        }
      }

      // Customer currentBalance updates
      if (customerUpdates && customerUpdates.customerId) {
        const custBalRef = ref(database, `companies/${companyId}/customers/${customerUpdates.customerId}/currentBalance`);
        const balSnap = await get(custBalRef);
        const currentBal = balSnap.exists() ? Number(balSnap.val()) : 0;
        updates[`companies/${companyId}/customers/${customerUpdates.customerId}/currentBalance`] = currentBal + (customerUpdates.balanceChange || 0);

        if (customerUpdates.totalOrdersInc) {
          const toSnap = await get(ref(database, `companies/${companyId}/customers/${customerUpdates.customerId}/totalOrders`));
          updates[`companies/${companyId}/customers/${customerUpdates.customerId}/totalOrders`] = (toSnap.exists() ? toSnap.val() : 0) + 1;
        }
        if (customerUpdates.totalSalesInc) {
          const tsSnap = await get(ref(database, `companies/${companyId}/customers/${customerUpdates.customerId}/totalSales`));
          updates[`companies/${companyId}/customers/${customerUpdates.customerId}/totalSales`] = (tsSnap.exists() ? tsSnap.val() : 0) + customerUpdates.totalSalesInc;
        }
        updates[`companies/${companyId}/customers/${customerUpdates.customerId}/lastOrderDate`] = Date.now();
      }

      // Activity & notification
      if (activity) {
        updates[`companies/${companyId}/activities/${activity.id}`] = activity;
      }
      if (notification) {
        updates[`companies/${companyId}/notifications/${notification.id}`] = notification;
      }

      await update(dbRef, updates);
      break;
    }

    case 'create_customer': {
      const { customerId, customer, activity } = payload;
      const updates = {};
      updates[`companies/${companyId}/customers/${customerId}`] = customer;
      if (activity) {
        updates[`companies/${companyId}/activities/${activity.id}`] = activity;
      }
      await update(dbRef, updates);
      break;
    }

    case 'create_product': {
      const { productId, product, activity } = payload;
      const updates = {};
      updates[`companies/${companyId}/products/${productId}`] = product;
      if (activity) {
        updates[`companies/${companyId}/activities/${activity.id}`] = activity;
      }
      await update(dbRef, updates);
      break;
    }

    case 'create_payment': {
      const { paymentId, payment, customerId, newCreditBalance, activity } = payload;
      const updates = {};
      updates[`companies/${companyId}/payments/${paymentId}`] = payment;
      if (customerId) {
        updates[`companies/${companyId}/customers/${customerId}/currentBalance`] = newCreditBalance;
        updates[`companies/${companyId}/customers/${customerId}/updatedAt`] = Date.now();
      }
      if (activity) {
        updates[`companies/${companyId}/activities/${activity.id}`] = activity;
      }
      await update(dbRef, updates);
      break;
    }

    default:
      console.warn(`[Sync Engine] Unknown actionType: ${actionType}`);
      break;
  }
}

/**
 * Initialize automatic background network listeners
 */
export function initAutoSync(companyId) {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    console.log('[Sync Engine] Internet connection restored. Triggering auto-sync...');
    processOutbox(companyId);
  };

  const handleOffline = () => {
    console.log('[Sync Engine] Device went offline. Actions will be queued to IndexedDB.');
    notifyListeners({ isOnline: false, isSyncing: false });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Periodic poll every 30 seconds if online and items exist
  const interval = setInterval(async () => {
    const items = await getOutboxItems(companyId);
    if (items.length > 0 && navigator.onLine) {
      processOutbox(companyId);
    }
  }, 30000);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(interval);
  };
}
