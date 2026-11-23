// Order Service — Full order lifecycle with stock management
import { ref, get, update, runTransaction, onValue } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';
import { generateSequentialNumber } from '../utils/formatters';
import { saveToOutbox, addToCachedCollection, cacheCollection, getCachedCollection, getOutboxItems, getActiveCachedUserId, getDeviceId } from './offlineStorage';

/**
 * Create a new order with stock validation and atomic updates (with seamless offline fallback)
 */
export async function createOrder(companyId, orderData, userId, userName) {
  // If browser is offline, directly save locally to IndexedDB outbox
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return createOrderOffline(companyId, orderData, userId, userName);
  }

  try {
    // Get next order number
    const counterRef = ref(database, `companies/${companyId}/counters/orderCounter`);
    const counterSnap = await get(counterRef);
    const currentCounter = (counterSnap.exists() ? counterSnap.val() : 0) + 1;

    // Get order prefix from settings
    const settingsSnap = await get(ref(database, `companies/${companyId}/settings`));
    const settings = settingsSnap.exists() ? settingsSnap.val() : {};
    const prefix = settings.orderPrefix || 'ORD';
    const allowNegativeStock = settings.allowNegativeStock || false;

    const orderNumber = generateSequentialNumber(prefix, currentCounter);
    const orderId = generateId('ord');

    // Validate stock if needed
    if (!allowNegativeStock && orderData.items && orderData.status !== 'draft') {
      for (const item of orderData.items) {
        const prodSnap = await get(ref(database, `companies/${companyId}/products/${item.productId}`));
        if (prodSnap.exists()) {
          const product = prodSnap.val();
          if (product.currentStock < item.quantity) {
            throw new Error(`Only ${product.currentStock} units of "${item.productName}" are currently available.`);
          }
        }
      }
    }

    const isCash = orderData.paymentType === 'cash';
    const grandTotal = Number(orderData.grandTotal) || 0;
    const amountPaid = isCash ? grandTotal : (Number(orderData.amountPaid) || 0);

    const order = {
      ...orderData,
      orderNumber,
      companyId,
      employeeId: userId,
      createdBy: userId,
      createdByName: userName,
      paymentType: orderData.paymentType || (amountPaid >= grandTotal ? 'cash' : 'credit'),
      amountPaid,
      createdAt: orderData.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    // Calculate payment status
    order.paymentStatus = isCash ? 'paid' : calculatePaymentStatus(order.grandTotal, order.amountPaid);

    // Convert items array to object for Firebase
    const itemsObj = {};
    if (orderData.items) {
      orderData.items.forEach((item, index) => {
        itemsObj[`item_${index}`] = {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku || '',
          quantity: Number(item.quantity),
          salePrice: Number(item.salePrice),
          costPriceAtSale: Number(item.costPriceAtSale) || 0,
          discount: Number(item.discount) || 0,
          lineTotal: Number(item.lineTotal),
        };
      });
    }
    order.items = itemsObj;

    const updates = {};
    updates[`companies/${companyId}/orders/${orderId}`] = order;
    updates[`companies/${companyId}/counters/orderCounter`] = currentCounter;

    // If order is not draft, update stock and customer balance
    if (order.status !== 'draft') {
      // Update product stock
      for (const item of orderData.items || []) {
        const prodRef = ref(database, `companies/${companyId}/products/${item.productId}/currentStock`);
        const stockSnap = await get(prodRef);
        const currentStock = stockSnap.exists() ? stockSnap.val() : 0;
        updates[`companies/${companyId}/products/${item.productId}/currentStock`] = currentStock - Number(item.quantity);

        // Stock movement
        const movId = generateId('mov');
        updates[`companies/${companyId}/stockMovements/${movId}`] = {
          type: 'sale',
          productId: item.productId,
          productName: item.productName,
          quantity: -Number(item.quantity),
          referenceId: orderId,
          referenceType: 'order',
          referenceNumber: orderNumber,
          createdBy: userId,
          createdAt: Date.now(),
        };
      }

      // Update customer balance
      if (orderData.customerId) {
        const custBalRef = ref(database, `companies/${companyId}/customers/${orderData.customerId}/currentBalance`);
        const balSnap = await get(custBalRef);
        const currentBal = balSnap.exists() ? balSnap.val() : 0;
        const orderOutstanding = (order.grandTotal || 0) - (order.amountPaid || 0);
        updates[`companies/${companyId}/customers/${orderData.customerId}/currentBalance`] = currentBal + orderOutstanding;

        // Update customer stats
        const totalOrdersRef = ref(database, `companies/${companyId}/customers/${orderData.customerId}/totalOrders`);
        const totalSalesRef = ref(database, `companies/${companyId}/customers/${orderData.customerId}/totalSales`);
        const toSnap = await get(totalOrdersRef);
        const tsSnap = await get(totalSalesRef);
        updates[`companies/${companyId}/customers/${orderData.customerId}/totalOrders`] = (toSnap.exists() ? toSnap.val() : 0) + 1;
        updates[`companies/${companyId}/customers/${orderData.customerId}/totalSales`] = (tsSnap.exists() ? tsSnap.val() : 0) + (order.grandTotal || 0);
        updates[`companies/${companyId}/customers/${orderData.customerId}/lastOrderDate`] = Date.now();
      }
    }

    // Activity & notification
    const actId = generateId('act');
    updates[`companies/${companyId}/activities/${actId}`] = {
      userId, userName,
      action: `${userName} created Order ${orderNumber}`,
      entityType: 'order', entityId: orderId,
      timestamp: Date.now(),
    };

    const notifId = generateId('notif');
    updates[`companies/${companyId}/notifications/${notifId}`] = {
      type: 'order_created',
      message: `New order ${orderNumber} created by ${userName}`,
      read: false,
      userId,
      userName,
      entityType: 'order', entityId: orderId,
      timestamp: Date.now(),
    };

    // Onboarding
    updates[`companies/${companyId}/onboarding/firstOrder`] = true;

    await update(ref(database), sanitizeFirebaseData(updates));
    
    // Also save in local offline cache for immediate offline viewing later
    await addToCachedCollection(companyId, 'orders', { id: orderId, ...order });

    return { orderId, orderNumber, isOffline: false };
  } catch (err) {
    // If it's a network/connectivity error, gracefully save locally
    if (
      !navigator.onLine || 
      err.message?.includes('network') || 
      err.message?.includes('offline') || 
      err.message?.includes('Failed to fetch') ||
      err.code === 'NETWORK_ERROR' ||
      err.code === 'UNAVAILABLE'
    ) {
      console.warn('[Order Service] Network write failed, saving to offline outbox:', err);
      return createOrderOffline(companyId, orderData, userId, userName);
    }
    throw err;
  }
}

/**
 * Save order locally in IndexedDB Outbox and update local cache for offline operation
 */
export async function createOrderOffline(companyId, orderData, userId, userName) {
  const orderId = generateId('ord');
  
  // Local sequence generator
  let counterKey = `offline_order_counter_${companyId}`;
  let offlineCounter = 100;
  try {
    const saved = localStorage.getItem(counterKey);
    if (saved) offlineCounter = parseInt(saved, 10);
    offlineCounter += 1;
    localStorage.setItem(counterKey, String(offlineCounter));
  } catch (_) {
    offlineCounter = Math.floor(1000 + Math.random() * 9000);
  }

  const deviceSuffix = getDeviceId().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'LOCAL';
  const orderNumber = `ORD-OFF-${deviceSuffix}-${offlineCounter}`;
  const isCash = orderData.paymentType === 'cash';
  const grandTotal = Number(orderData.grandTotal) || 0;
  const amountPaid = isCash ? grandTotal : (Number(orderData.amountPaid) || 0);

  const itemsObj = {};

  if (orderData.items) {
    orderData.items.forEach((item, index) => {
      itemsObj[`item_${index}`] = {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku || '',
        quantity: Number(item.quantity),
        salePrice: Number(item.salePrice),
        costPriceAtSale: Number(item.costPriceAtSale) || 0,
        discount: Number(item.discount) || 0,
        lineTotal: Number(item.lineTotal),
      };

      // Option B: do not decrement cached stock on the employee device.
      // The authoritative stock deduction happens once, transactionally, on sync.
    });
  }

  const order = {
    ...orderData,
    id: orderId,
    orderNumber,
    companyId,
    employeeId: userId,
    createdBy: userId,
    createdByName: userName,
    paymentType: orderData.paymentType || (amountPaid >= grandTotal ? 'cash' : 'credit'),
    amountPaid,
    paymentStatus: isCash ? 'paid' : calculatePaymentStatus(grandTotal, amountPaid),
    items: itemsObj,
    createdAt: orderData.createdAt || Date.now(),
    updatedAt: Date.now(),
    isPendingSync: true, // Marked pending until online sync
  };

  let customerUpdates = null;
  if (orderData.customerId) {
    const orderOutstanding = (order.grandTotal || 0) - (order.amountPaid || 0);
    customerUpdates = {
      customerId: orderData.customerId,
      balanceChange: orderOutstanding,
      totalOrdersInc: 1,
      totalSalesInc: order.grandTotal || 0,
    };
  }

  const actId = generateId('act');
  const activity = {
    id: actId,
    userId,
    userName,
    action: `${userName} created Order ${orderNumber} (Offline)`,
    entityType: 'order',
    entityId: orderId,
    timestamp: Date.now(),
  };

  const notifId = generateId('notif');
  const notification = {
    id: notifId,
    type: 'order_created',
    message: `New order ${orderNumber} created by ${userName}`,
    read: false,
    userId,
    userName,
    entityType: 'order',
    entityId: orderId,
    timestamp: Date.now(),
  };

  // 1. Enqueue to IndexedDB Outbox
  await saveToOutbox({
    companyId,
    actionType: 'create_order',
    payload: {
      orderId,
      orderNumber,
      order,
      customerUpdates,
      activity,
      notification
    },
    userId,
    userName,
    description: `Order ${orderNumber} (${order.customerName || 'Shop'})`
  });

  // Keep pending orders in the creator's outbox, not the shared company cache.
  return { orderId, orderNumber, isOffline: true };
}

/**
 * Update order status
 */
export async function updateOrderStatus(companyId, orderId, newStatus, userId, userName) {
  const orderSnap = await get(ref(database, `companies/${companyId}/orders/${orderId}`));
  if (!orderSnap.exists()) throw new Error('Order not found');
  const order = orderSnap.val();
  const oldStatus = order.status;

  const updates = {};
  updates[`companies/${companyId}/orders/${orderId}/status`] = newStatus;
  updates[`companies/${companyId}/orders/${orderId}/updatedAt`] = Date.now();

  // If cancelling an active order, restore stock
  if (newStatus === 'cancelled' && oldStatus !== 'cancelled' && oldStatus !== 'draft') {
    if (order.items) {
      for (const [key, item] of Object.entries(order.items)) {
        const prodRef = ref(database, `companies/${companyId}/products/${item.productId}/currentStock`);
        const stockSnap = await get(prodRef);
        const currentStock = stockSnap.exists() ? stockSnap.val() : 0;
        updates[`companies/${companyId}/products/${item.productId}/currentStock`] = currentStock + item.quantity;

        const movId = generateId('mov');
        updates[`companies/${companyId}/stockMovements/${movId}`] = {
          type: 'cancel_restore',
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          referenceId: orderId,
          referenceType: 'order_cancel',
          referenceNumber: order.orderNumber,
          createdBy: userId,
          createdAt: Date.now(),
        };
      }
    }

    // Restore customer balance
    if (order.customerId) {
      const orderOutstanding = (order.grandTotal || 0) - (order.amountPaid || 0);
      const custBalRef = ref(database, `companies/${companyId}/customers/${order.customerId}/currentBalance`);
      const balSnap = await get(custBalRef);
      const currentBal = balSnap.exists() ? balSnap.val() : 0;
      updates[`companies/${companyId}/customers/${order.customerId}/currentBalance`] = currentBal - orderOutstanding;
    }

    // Notification
    const notifId = generateId('notif');
    updates[`companies/${companyId}/notifications/${notifId}`] = {
      type: 'order_cancelled',
      message: `Order ${order.orderNumber} was cancelled`,
      read: false,
      entityType: 'order', entityId: orderId,
      timestamp: Date.now(),
    };
  }

  // Activity
  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} changed Order ${order.orderNumber} status to ${newStatus}`,
    entityType: 'order', entityId: orderId,
    timestamp: Date.now(),
  };

  await update(ref(database), sanitizeFirebaseData(updates));
}

/**
 * Update order payment type (Cash vs Credit)
 */
export async function updateOrderPaymentType(companyId, orderId, newPaymentType, userId, userName) {
  const orderSnap = await get(ref(database, `companies/${companyId}/orders/${orderId}`));
  if (!orderSnap.exists()) throw new Error('Order not found');
  const order = orderSnap.val();
  const oldPaymentType = order.paymentType || (order.amountPaid >= order.grandTotal ? 'cash' : 'credit');

  if (oldPaymentType === newPaymentType) return;

  const updates = {};
  const isNowCash = newPaymentType === 'cash';
  const newAmountPaid = isNowCash ? (order.grandTotal || 0) : 0;
  const newPaymentStatus = isNowCash ? 'paid' : 'unpaid';

  updates[`companies/${companyId}/orders/${orderId}/paymentType`] = newPaymentType;
  updates[`companies/${companyId}/orders/${orderId}/amountPaid`] = newAmountPaid;
  updates[`companies/${companyId}/orders/${orderId}/paymentStatus`] = newPaymentStatus;
  updates[`companies/${companyId}/orders/${orderId}/updatedAt`] = Date.now();

  // Adjust customer balance
  if (order.customerId && order.status !== 'cancelled' && order.status !== 'draft') {
    const custBalRef = ref(database, `companies/${companyId}/customers/${order.customerId}/currentBalance`);
    const balSnap = await get(custBalRef);
    const currentBal = balSnap.exists() ? balSnap.val() : 0;

    let balanceChange = 0;
    if (oldPaymentType === 'credit' && isNowCash) {
      // Switched Credit -> Cash: customer debt decreases
      balanceChange = -(order.grandTotal || 0);
    } else if (oldPaymentType === 'cash' && !isNowCash) {
      // Switched Cash -> Credit: customer debt increases
      balanceChange = (order.grandTotal || 0);
    }

    updates[`companies/${companyId}/customers/${order.customerId}/currentBalance`] = Math.max(0, currentBal + balanceChange);
  }

  // Activity log
  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} updated Order ${order.orderNumber} payment type to ${newPaymentType.toUpperCase()}`,
    entityType: 'order', entityId: orderId,
    timestamp: Date.now(),
  };

  await update(ref(database), sanitizeFirebaseData(updates));
}

/**
 * Delete an order and adjust stock and customer balance
 */
export async function deleteOrder(companyId, orderId, orderNumber, userId, userName) {
  const orderSnap = await get(ref(database, `companies/${companyId}/orders/${orderId}`));
  if (!orderSnap.exists()) return;
  const order = orderSnap.val();

  const updates = {};
  updates[`companies/${companyId}/orders/${orderId}`] = null;

  // Restore stock if active order
  if (order.status !== 'cancelled' && order.status !== 'draft' && order.items) {
    for (const [key, item] of Object.entries(order.items)) {
      const prodRef = ref(database, `companies/${companyId}/products/${item.productId}/currentStock`);
      const stockSnap = await get(prodRef);
      const currentStock = stockSnap.exists() ? stockSnap.val() : 0;
      updates[`companies/${companyId}/products/${item.productId}/currentStock`] = currentStock + Number(item.quantity);
    }

    // Deduct customer balance if it was credit
    if (order.customerId) {
      const orderOutstanding = (order.paymentType === 'credit' || order.paymentStatus === 'unpaid') ? (order.grandTotal || 0) : 0;
      if (orderOutstanding > 0) {
        const custBalRef = ref(database, `companies/${companyId}/customers/${order.customerId}/currentBalance`);
        const balSnap = await get(custBalRef);
        const currentBal = balSnap.exists() ? balSnap.val() : 0;
        updates[`companies/${companyId}/customers/${order.customerId}/currentBalance`] = Math.max(0, currentBal - orderOutstanding);
      }
    }
  }

  // Activity log
  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} deleted Order ${orderNumber || orderId}`,
    entityType: 'order', entityId: orderId,
    timestamp: Date.now(),
  };

  await update(ref(database), sanitizeFirebaseData(updates));
}

/**
 * Update an existing order
 */
export async function updateOrder(companyId, orderId, newOrderData, userId, userName) {
  const oldOrderSnap = await get(ref(database, `companies/${companyId}/orders/${orderId}`));
  if (!oldOrderSnap.exists()) throw new Error('Order not found');
  const oldOrder = oldOrderSnap.val();

  const isCash = newOrderData.paymentType === 'cash';
  const grandTotal = Number(newOrderData.grandTotal) || 0;
  const amountPaid = isCash ? grandTotal : (Number(newOrderData.amountPaid) || 0);

  const updatedOrder = {
    ...oldOrder,
    ...newOrderData,
    amountPaid,
    paymentType: newOrderData.paymentType,
    paymentStatus: isCash ? 'paid' : calculatePaymentStatus(grandTotal, amountPaid),
    updatedAt: Date.now(),
  };

  // Preserve returnedAmount and returns records from oldOrder
  if (oldOrder.returnedAmount !== undefined && newOrderData.returnedAmount === undefined) {
    updatedOrder.returnedAmount = oldOrder.returnedAmount;
  }
  if (oldOrder.returns !== undefined && newOrderData.returns === undefined) {
    updatedOrder.returns = oldOrder.returns;
  }

  // Convert items array to object for Firebase, preserving returnedQty
  const itemsObj = {};
  if (newOrderData.items) {
    newOrderData.items.forEach((item, index) => {
      let existingRetQty = Number(item.returnedQty) || 0;
      if (!existingRetQty && oldOrder.items) {
        const matchOld = Object.values(oldOrder.items).find(oldIt => oldIt.productId === item.productId);
        if (matchOld) {
          existingRetQty = Number(matchOld.returnedQty) || 0;
        }
      }

      itemsObj[`item_${index}`] = {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku || '',
        quantity: Number(item.quantity),
        returnedQty: existingRetQty,
        salePrice: Number(item.salePrice),
        costPriceAtSale: Number(item.costPriceAtSale) || 0,
        discount: Number(item.discount) || 0,
        lineTotal: Number(item.lineTotal || (item.salePrice * item.quantity)),
      };
    });
  }
  updatedOrder.items = itemsObj;

  const updates = {};
  updates[`companies/${companyId}/orders/${orderId}`] = updatedOrder;

  // Revert old items stock
  if (oldOrder.items) {
    for (const [key, item] of Object.entries(oldOrder.items)) {
      const prodRef = ref(database, `companies/${companyId}/products/${item.productId}/currentStock`);
      const stockSnap = await get(prodRef);
      const currentStock = stockSnap.exists() ? stockSnap.val() : 0;
      updates[`companies/${companyId}/products/${item.productId}/currentStock`] = currentStock + Number(item.quantity);
    }
  }

  // Apply new items stock
  for (const item of newOrderData.items || []) {
    const prodRef = ref(database, `companies/${companyId}/products/${item.productId}/currentStock`);
    const stockSnap = await get(prodRef);
    const currentStock = stockSnap.exists() ? stockSnap.val() : 0;
    const netCurrent = updates[`companies/${companyId}/products/${item.productId}/currentStock`] !== undefined 
      ? updates[`companies/${companyId}/products/${item.productId}/currentStock`] 
      : currentStock;
    updates[`companies/${companyId}/products/${item.productId}/currentStock`] = netCurrent - Number(item.quantity);
  }

  // Adjust customer balance
  if (oldOrder.customerId) {
    const oldOutstanding = (oldOrder.paymentType === 'credit' || oldOrder.paymentStatus === 'unpaid') ? (oldOrder.grandTotal || 0) : 0;
    const custBalRef = ref(database, `companies/${companyId}/customers/${oldOrder.customerId}/currentBalance`);
    const balSnap = await get(custBalRef);
    const currentBal = balSnap.exists() ? balSnap.val() : 0;
    updates[`companies/${companyId}/customers/${oldOrder.customerId}/currentBalance`] = Math.max(0, currentBal - oldOutstanding);
  }

  if (newOrderData.customerId) {
    const newOutstanding = (newOrderData.paymentType === 'credit') ? grandTotal : 0;
    if (newOutstanding > 0) {
      const custBalRef = ref(database, `companies/${companyId}/customers/${newOrderData.customerId}/currentBalance`);
      const balSnap = await get(custBalRef);
      const currentBal = (updates[`companies/${companyId}/customers/${newOrderData.customerId}/currentBalance`] !== undefined)
        ? updates[`companies/${companyId}/customers/${newOrderData.customerId}/currentBalance`]
        : (balSnap.exists() ? balSnap.val() : 0);
      updates[`companies/${companyId}/customers/${newOrderData.customerId}/currentBalance`] = currentBal + newOutstanding;
    }
  }

  // Activity log
  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} updated Order ${oldOrder.orderNumber}`,
    entityType: 'order', entityId: orderId,
    timestamp: Date.now(),
  };

  await update(ref(database), sanitizeFirebaseData(updates));
}

/**
 * Get all orders for a company (with offline cache support and local outbox merge)
 */
export async function getOrders(companyId) {
  // If offline, return cached orders merged with pending outbox items
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = (await getCachedCollection(companyId, 'orders')).filter(order => !order.isPendingSync);
    const uid = getActiveCachedUserId();
    const pending = (await getOutboxItems(companyId))
      .filter(item => item.userId === uid && item.actionType === 'create_order' && item.payload?.order)
      .map(item => ({ ...item.payload.order, id: item.payload.orderId || item.payload.order.id, isPendingSync: true }));
    const map = new Map(cached.map(order => [order.id || order.orderNumber, order]));
    pending.forEach(order => map.set(order.id || order.orderNumber, order));
    return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  try {
    const snap = await get(ref(database, `companies/${companyId}/orders`));
    const orders = [];
    if (snap.exists()) {
      snap.forEach(child => {
        orders.push({ id: child.key, ...child.val() });
      });
    }

    // Merge any pending outbox orders that haven't synced yet
    const activeUid = getActiveCachedUserId();
    const pendingOutbox = await getOutboxItems(companyId);
    const pendingOrders = pendingOutbox
      .filter(item => item.userId === activeUid && item.actionType === 'create_order' && item.payload?.order)
      .map(item => ({
        ...item.payload.order,
        id: item.payload.orderId || item.payload.order.id,
        isPendingSync: true,
      }));

    // Deduplicate
    const orderMap = new Map();
    orders.forEach(o => orderMap.set(o.id || o.orderNumber, o));
    pendingOrders.forEach(o => orderMap.set(o.id || o.orderNumber, o));

    const merged = Array.from(orderMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Update local cache for future offline browsing
    await cacheCollection(companyId, 'orders', orders);

    return merged;
  } catch (err) {
    console.warn('[Order Service] Failed to fetch orders from server, loading from cache:', err);
    const cached = (await getCachedCollection(companyId, 'orders')).filter(order => !order.isPendingSync);
    const uid = getActiveCachedUserId();
    const pending = (await getOutboxItems(companyId)).filter(item => item.userId === uid && item.actionType === 'create_order' && item.payload?.order)
      .map(item => ({ ...item.payload.order, id: item.payload.orderId || item.payload.order.id, isPendingSync: true }));
    const map = new Map(cached.map(order => [order.id || order.orderNumber, order]));
    pending.forEach(order => map.set(order.id || order.orderNumber, order));
    return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
}

/**
 * Get single order (with offline cache fallback)
 */
export async function getOrder(companyId, orderId) {
  // If offline, check local cache and outbox
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return getOrderOffline(companyId, orderId);
  }

  try {
    const snap = await get(ref(database, `companies/${companyId}/orders/${orderId}`));
    if (snap.exists()) {
      return { id: orderId, ...snap.val() };
    }
    // If not found in server, maybe it's a pending offline order
    return getOrderOffline(companyId, orderId);
  } catch (err) {
    console.warn('[Order Service] Failed to get order from server, checking local cache:', err);
    return getOrderOffline(companyId, orderId);
  }
}

async function getOrderOffline(companyId, orderId) {
  // 1. Check outbox pending items
  const activeUid = getActiveCachedUserId();
  const outboxItems = await getOutboxItems(companyId);
  const foundOutbox = outboxItems.find(
    i => (!activeUid || i.userId === activeUid) && i.actionType === 'create_order' && 
         (i.payload?.orderId === orderId || i.payload?.order?.id === orderId || i.payload?.orderNumber === orderId)
  );
  if (foundOutbox && foundOutbox.payload?.order) {
    return { ...foundOutbox.payload.order, id: orderId, isPendingSync: true };
  }

  // 2. Check local collection cache
  const cachedOrders = (await getCachedCollection(companyId, 'orders')).filter(order => !order.isPendingSync);
  const found = cachedOrders.find(o => o.id === orderId || o.orderNumber === orderId);
  return found || null;
}

/**
 * Process a return for an order
 */
export async function processOrderReturn(companyId, orderId, returnItems, reason, userId, userName) {
  const orderSnap = await get(ref(database, `companies/${companyId}/orders/${orderId}`));
  if (!orderSnap.exists()) throw new Error('Order not found');
  const order = orderSnap.val();

  let totalReturnAmount = 0;
  const returnedItemsList = [];
  const updates = {};
  const discountPct = Number(order.discount) || 0;

  const itemsMap = order.items ? { ...order.items } : {};

  for (const retItem of returnItems) {
    const { itemKey, productId, productName, returnQty, salePrice } = retItem;
    if (!returnQty || returnQty <= 0) continue;

    const existingItem = itemsMap[itemKey];
    if (!existingItem) continue;

    const orderedQty = Number(existingItem.quantity) || 0;
    const currentReturned = Number(existingItem.returnedQty) || 0;
    const maxRet = Math.max(0, orderedQty - currentReturned);

    const actualReturnQty = Math.min(returnQty, maxRet);
    if (actualReturnQty <= 0) continue;

    // Calculate effective item price with discount
    const effectivePrice = Number(salePrice) * (1 - (discountPct / 100));
    const itemRefund = actualReturnQty * effectivePrice;
    totalReturnAmount += itemRefund;

    // Update item returned quantity in order
    itemsMap[itemKey] = {
      ...existingItem,
      returnedQty: currentReturned + actualReturnQty
    };

    returnedItemsList.push({
      productId,
      productName,
      returnQty: actualReturnQty,
      salePrice: Number(salePrice),
      itemRefund
    });

    // Restore product stock
    const prodRef = ref(database, `companies/${companyId}/products/${productId}/currentStock`);
    const stockSnap = await get(prodRef);
    const currentStock = stockSnap.exists() ? Number(stockSnap.val()) : 0;
    updates[`companies/${companyId}/products/${productId}/currentStock`] = currentStock + actualReturnQty;

    // Record stock movement
    const movId = generateId('mov');
    updates[`companies/${companyId}/stockMovements/${movId}`] = {
      type: 'order_return',
      productId,
      productName,
      quantity: actualReturnQty,
      referenceId: orderId,
      referenceType: 'order_return',
      referenceNumber: order.orderNumber,
      createdBy: userId,
      createdAt: Date.now(),
    };
  }

  if (returnedItemsList.length === 0) {
    throw new Error('Please select at least one item and quantity to return');
  }

  // Update order object
  const newTotalReturnedAmount = (Number(order.returnedAmount) || 0) + totalReturnAmount;
  const returnId = generateId('ret');
  const returnRecord = {
    returnId,
    items: returnedItemsList,
    totalReturnAmount,
    reason: reason || '',
    createdAt: Date.now(),
    createdBy: userName
  };

  const returnsObj = order.returns ? { ...order.returns, [returnId]: returnRecord } : { [returnId]: returnRecord };

  updates[`companies/${companyId}/orders/${orderId}/items`] = itemsMap;
  updates[`companies/${companyId}/orders/${orderId}/returnedAmount`] = newTotalReturnedAmount;
  updates[`companies/${companyId}/orders/${orderId}/returns`] = returnsObj;
  updates[`companies/${companyId}/orders/${orderId}/updatedAt`] = Date.now();

  // Deduct from customer balance if order was credit or unpaid
  if (order.customerId) {
    const custBalRef = ref(database, `companies/${companyId}/customers/${order.customerId}/currentBalance`);
    const balSnap = await get(custBalRef);
    const currentBal = balSnap.exists() ? Number(balSnap.val()) : 0;
    updates[`companies/${companyId}/customers/${order.customerId}/currentBalance`] = Math.max(0, currentBal - totalReturnAmount);
  }

  // Activity log
  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} processed a return of ${totalReturnAmount.toFixed(2)} for Order ${order.orderNumber}`,
    entityType: 'order', entityId: orderId,
    timestamp: Date.now(),
  };

  await update(ref(database), sanitizeFirebaseData(updates));
  return { returnId, totalReturnAmount };
}

/**
 * Real-time listener for orders created offline by removed employees requiring Admin approval
 */
export function listenPendingRemovedOrders(companyId, callback) {
  if (!companyId) return () => {};
  const pendingRef = ref(database, `companies/${companyId}/pendingRemovedEmployeeOrders`);
  return onValue(pendingRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const list = [];
    snap.forEach((child) => {
      const val = child.val();
      if (val) {
        list.push({ id: child.key, ...val });
      }
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  }, (err) => {
    console.warn('[orderService] Error listening to pending removed employee orders:', err);
    callback([]);
  });
}

/**
 * Admin accepts order created offline by a removed employee:
 * Moves it to active orders, deducts inventory stock, updates customer ledger.
 */
export async function approveRemovedEmployeeOrder(companyId, orderId, adminId, adminName) {
  const companyRef = ref(database, `companies/${companyId}`);
  const now = Date.now();
  let approvedOrderNumber = '';

  await runTransaction(companyRef, (company) => {
    if (!company) return;
    const pending = company.pendingRemovedEmployeeOrders?.[orderId];
    if (!pending) return company;

    approvedOrderNumber = pending.orderNumber || orderId;
    company.orders ||= {};
    company.products ||= {};
    company.stockMovements ||= {};
    company.activities ||= {};
    company.notifications ||= {};

    // Move to active orders
    const approvedOrder = {
      ...pending,
      requiresAdminApproval: false,
      reviewStatus: 'approved',
      approvedBy: adminName || 'Admin',
      approvedById: adminId || '',
      approvedAt: now,
    };
    company.orders[orderId] = approvedOrder;

    // Deduct stock
    if (approvedOrder.status !== 'draft') {
      const items = Array.isArray(approvedOrder.items)
        ? approvedOrder.items
        : Object.values(approvedOrder.items || {});
      for (const line of items) {
        if (!line?.productId) continue;
        const qty = Number(line.quantity) || 0;
        const prod = company.products[line.productId];
        if (prod) {
          prod.currentStock = (Number(prod.currentStock) || 0) - qty;
          const movementId = `sale_${orderId}_${line.productId}`;
          company.stockMovements[movementId] = {
            id: movementId,
            type: 'sale',
            productId: line.productId,
            productName: prod.name || line.productName || 'Product',
            quantity: -qty,
            referenceId: orderId,
            referenceType: 'order',
            referenceNumber: approvedOrderNumber,
            createdBy: adminId || '',
            createdAt: now,
          };
        }
      }

      // Update customer balance if applicable
      const custId = approvedOrder.customerId || approvedOrder.customerUpdates?.customerId;
      if (custId && company.customers?.[custId]) {
        const cust = company.customers[custId];
        const balChange = Number(approvedOrder.customerUpdates?.balanceChange ?? (approvedOrder.paymentType === 'cash' ? 0 : approvedOrder.grandTotal)) || 0;
        cust.currentBalance = (Number(cust.currentBalance) || 0) + balChange;
        cust.totalOrders = (Number(cust.totalOrders) || 0) + 1;
        cust.totalSales = (Number(cust.totalSales) || 0) + (Number(approvedOrder.grandTotal) || 0);
        cust.lastOrderDate = now;
      }
    }

    // Activity log
    const actId = generateId('act');
    company.activities[actId] = {
      id: actId,
      userId: adminId || '',
      userName: adminName || 'Admin',
      action: `${adminName || 'Admin'} accepted post-removal offline order #${approvedOrderNumber}`,
      entityType: 'order',
      entityId: orderId,
      timestamp: now,
    };

    // Remove from pending
    delete company.pendingRemovedEmployeeOrders[orderId];

    // Update notification status if exists
    if (company.notifications) {
      for (const notif of Object.values(company.notifications)) {
        if (notif?.orderId === orderId) {
          notif.reviewStatus = 'accepted';
          notif.read = true;
        }
      }
    }

    return company;
  });

  return { success: true, orderNumber: approvedOrderNumber };
}

/**
 * Admin rejects order created offline by a removed employee:
 * Deletes it permanently from DB without affecting stock or customer balances.
 */
export async function rejectRemovedEmployeeOrder(companyId, orderId, adminId, adminName) {
  const companyRef = ref(database, `companies/${companyId}`);
  const now = Date.now();
  let rejectedOrderNumber = '';

  await runTransaction(companyRef, (company) => {
    if (!company) return;
    const pending = company.pendingRemovedEmployeeOrders?.[orderId];
    if (!pending) return company;

    rejectedOrderNumber = pending.orderNumber || orderId;

    // Delete completely from pending
    delete company.pendingRemovedEmployeeOrders[orderId];

    // Activity log
    company.activities ||= {};
    const actId = generateId('act');
    company.activities[actId] = {
      id: actId,
      userId: adminId || '',
      userName: adminName || 'Admin',
      action: `${adminName || 'Admin'} rejected post-removal offline order #${rejectedOrderNumber}`,
      entityType: 'order',
      entityId: orderId,
      timestamp: now,
    };

    // Update notification status if exists
    if (company.notifications) {
      for (const notif of Object.values(company.notifications)) {
        if (notif?.orderId === orderId) {
          notif.reviewStatus = 'rejected';
          notif.read = true;
        }
      }
    }

    return company;
  });

  return { success: true, orderNumber: rejectedOrderNumber };
}

function calculatePaymentStatus(grandTotal, amountPaid) {
  if (!grandTotal || grandTotal <= 0) return 'paid';
  if (!amountPaid || amountPaid <= 0) return 'unpaid';
  if (amountPaid >= grandTotal) return 'paid';
  return 'partially_paid';
}

function sanitizeFirebaseData(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeFirebaseData).filter(item => item !== undefined);

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeFirebaseData(value);
    }
  }
  return cleaned;
}
