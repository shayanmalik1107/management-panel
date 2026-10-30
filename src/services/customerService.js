// Customer Service — CRUD for customers/shops with offline support
import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';
import { saveToOutbox, addToCachedCollection, cacheCollection, getCachedCollection, getOutboxItems } from './offlineStorage';

export async function createCustomer(companyId, customerData, userId, userName) {
  const customerId = generateId('cust');
  const customer = {
    ...customerData,
    companyId,
    openingBalance: Number(customerData.openingBalance) || 0,
    currentBalance: Number(customerData.openingBalance) || 0,
    totalOrders: 0,
    totalSales: 0,
    createdBy: userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // If offline, save locally
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return createCustomerOffline(companyId, customerId, customer, userId, userName);
  }

  try {
    const updates = {};
    updates[`companies/${companyId}/customers/${customerId}`] = customer;

    const actId = generateId('act');
    updates[`companies/${companyId}/activities/${actId}`] = {
      userId, userName,
      action: `${userName} added customer "${customerData.shopName}"`,
      entityType: 'customer', entityId: customerId,
      timestamp: Date.now(),
    };

    updates[`companies/${companyId}/onboarding/firstCustomer`] = true;

    await update(ref(database), updates);
    await addToCachedCollection(companyId, 'customers', { id: customerId, ...customer });
    return customerId;
  } catch (err) {
    if (!navigator.onLine || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
      console.warn('[Customer Service] Network write failed, saving to offline outbox:', err);
      return createCustomerOffline(companyId, customerId, customer, userId, userName);
    }
    throw err;
  }
}

async function createCustomerOffline(companyId, customerId, customer, userId, userName) {
  const localCustomer = { ...customer, id: customerId, isPendingSync: true };
  const actId = generateId('act');
  const activity = {
    id: actId,
    userId,
    userName,
    action: `${userName} added customer "${customer.shopName}" (Offline)`,
    entityType: 'customer',
    entityId: customerId,
    timestamp: Date.now(),
  };

  await saveToOutbox({
    companyId,
    actionType: 'create_customer',
    payload: {
      customerId,
      customer: localCustomer,
      activity
    },
    userId,
    userName,
    description: `Shop "${customer.shopName}"`
  });

  await addToCachedCollection(companyId, 'customers', localCustomer);
  return customerId;
}

export async function updateCustomer(companyId, customerId, customerData, userId, userName) {
  const updates = {};
  const updatedCustomer = {
    ...customerData,
    updatedAt: Date.now(),
  };

  // Don't overwrite computed fields
  delete updatedCustomer.currentBalance;
  delete updatedCustomer.totalOrders;
  delete updatedCustomer.totalSales;

  Object.keys(updatedCustomer).forEach(key => {
    updates[`companies/${companyId}/customers/${customerId}/${key}`] = updatedCustomer[key];
  });

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} updated customer "${customerData.shopName}"`,
    entityType: 'customer', entityId: customerId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
}

export async function getCustomers(companyId) {
  // If offline, return cached customers merged with pending outbox customers
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = await getCachedCollection(companyId, 'customers');
    return cached;
  }

  try {
    const snap = await get(ref(database, `companies/${companyId}/customers`));
    const customers = [];
    if (snap.exists()) {
      snap.forEach(child => {
        customers.push({ id: child.key, ...child.val() });
      });
    }

    // Merge pending outbox items
    const pendingOutbox = await getOutboxItems(companyId);
    const pendingCusts = pendingOutbox
      .filter(item => item.actionType === 'create_customer' && item.payload?.customer)
      .map(item => ({
        ...item.payload.customer,
        id: item.payload.customerId || item.payload.customer.id,
        isPendingSync: true,
      }));

    const custMap = new Map();
    customers.forEach(c => custMap.set(c.id, c));
    pendingCusts.forEach(c => custMap.set(c.id, c));

    const merged = Array.from(custMap.values());
    await cacheCollection(companyId, 'customers', merged);
    return merged;
  } catch (err) {
    console.warn('[Customer Service] Failed to fetch customers from server, returning cache:', err);
    return getCachedCollection(companyId, 'customers');
  }
}

export async function getCustomer(companyId, customerId) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return getCustomerOffline(companyId, customerId);
  }

  try {
    const snap = await get(ref(database, `companies/${companyId}/customers/${customerId}`));
    if (snap.exists()) {
      return { id: customerId, ...snap.val() };
    }
    return getCustomerOffline(companyId, customerId);
  } catch (err) {
    return getCustomerOffline(companyId, customerId);
  }
}

async function getCustomerOffline(companyId, customerId) {
  const outboxItems = await getOutboxItems(companyId);
  const foundOutbox = outboxItems.find(
    i => i.actionType === 'create_customer' && 
         (i.payload?.customerId === customerId || i.payload?.customer?.id === customerId)
  );
  if (foundOutbox && foundOutbox.payload?.customer) {
    return { ...foundOutbox.payload.customer, id: customerId, isPendingSync: true };
  }

  const cached = await getCachedCollection(companyId, 'customers');
  return cached.find(c => c.id === customerId) || null;
}

export async function deleteCustomer(companyId, customerId, shopName, userId, userName) {
  const updates = {};
  updates[`companies/${companyId}/customers/${customerId}`] = null;

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId: userId || '',
    userName: userName || 'User',
    action: `${userName || 'User'} deleted customer "${shopName || 'Customer'}"`,
    entityType: 'customer',
    entityId: customerId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
}

