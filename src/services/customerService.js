// Customer Service — CRUD for customers/shops
import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';

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
  const snap = await get(ref(database, `companies/${companyId}/customers`));
  if (!snap.exists()) return [];
  const customers = [];
  snap.forEach(child => {
    customers.push({ id: child.key, ...child.val() });
  });
  return customers;
}

export async function getCustomer(companyId, customerId) {
  const snap = await get(ref(database, `companies/${companyId}/customers/${customerId}`));
  return snap.exists() ? { id: customerId, ...snap.val() } : null;
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

