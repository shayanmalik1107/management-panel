// Order Service — Full order lifecycle with stock management
import { ref, get, update, runTransaction } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';
import { generateSequentialNumber } from '../utils/formatters';

/**
 * Create a new order with stock validation and atomic updates
 */
export async function createOrder(companyId, orderData, userId, userName) {
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
  return { orderId, orderNumber };
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
 * Get all orders for a company
 */
export async function getOrders(companyId) {
  const snap = await get(ref(database, `companies/${companyId}/orders`));
  if (!snap.exists()) return [];
  const orders = [];
  snap.forEach(child => {
    orders.push({ id: child.key, ...child.val() });
  });
  return orders.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get single order
 */
export async function getOrder(companyId, orderId) {
  const snap = await get(ref(database, `companies/${companyId}/orders/${orderId}`));
  return snap.exists() ? { id: orderId, ...snap.val() } : null;
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
