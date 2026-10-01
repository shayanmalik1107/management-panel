import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';

export async function createSupplierPayment(companyId, paymentData, userId, userName) {
  const paymentId = generateId('pay');
  const payment = {
    ...paymentData,
    companyId,
    amount: Number(paymentData.amount),
    type: 'supplier_payment',
    createdBy: userId,
    createdByName: userName,
    createdAt: paymentData.createdAt || Date.now(),
  };

  const updates = {};
  updates[`companies/${companyId}/payments/${paymentId}`] = payment;

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} recorded payment of Rs ${paymentData.amount} to supplier ${paymentData.supplierName}`,
    entityType: 'payment', entityId: paymentId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
  return paymentId;
}

export async function updateSupplierPayment(companyId, paymentId, paymentData, userId, userName) {
  const updates = {};
  const updated = {
    supplierName: paymentData.supplierName || 'General Supplier',
    amount: Number(paymentData.amount) || 0,
    paymentMethod: paymentData.paymentMethod || 'Cash',
    reference: paymentData.reference || '',
    notes: paymentData.notes || '',
    updatedAt: Date.now(),
  };

  Object.keys(updated).forEach(key => {
    updates[`companies/${companyId}/payments/${paymentId}/${key}`] = updated[key];
  });

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} updated payment ${paymentId}`,
    entityType: 'payment', entityId: paymentId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
}

export async function deleteSupplierPayment(companyId, paymentId) {
  await update(ref(database), { [`companies/${companyId}/payments/${paymentId}`]: null });
}

export async function getSupplierPayments(companyId) {
  const snap = await get(ref(database, `companies/${companyId}/payments`));
  if (!snap.exists()) return [];
  const payments = [];
  snap.forEach(child => {
    const p = child.val();
    if (p.type === 'supplier_payment') {
      payments.push({ id: child.key, ...p });
    }
  });
  return payments.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSupplierBalances(companyId) {
  // Aggregate purchases per supplier
  const pSnap = await get(ref(database, `companies/${companyId}/purchases`));
  const suppliers = {};
  
  if (pSnap.exists()) {
    pSnap.forEach(child => {
      const pur = child.val();
      const name = pur.supplierName;
      if (name) {
        if (!suppliers[name]) suppliers[name] = { totalPurchases: 0, totalPayments: 0 };
        suppliers[name].totalPurchases += (pur.grandTotal || 0);
      }
    });
  }

  // Aggregate payments per supplier
  const paySnap = await get(ref(database, `companies/${companyId}/payments`));
  if (paySnap.exists()) {
    paySnap.forEach(child => {
      const pay = child.val();
      if (pay.type === 'supplier_payment' && pay.supplierName) {
        if (!suppliers[pay.supplierName]) suppliers[pay.supplierName] = { totalPurchases: 0, totalPayments: 0 };
        suppliers[pay.supplierName].totalPayments += (pay.amount || 0);
      }
    });
  }

  // Map to array and calculate balance
  return Object.keys(suppliers).map(name => {
    const s = suppliers[name];
    return {
      supplierName: name,
      totalPurchases: s.totalPurchases,
      totalPayments: s.totalPayments,
      balance: s.totalPurchases - s.totalPayments
    };
  }).filter(s => s.balance > 0); // Only return suppliers that have a balance
}

export async function createCustomerPaymentReceived(companyId, paymentData, userId, userName) {
  if (!paymentData.customerId) {
    throw new Error('Customer / Shop selection is required');
  }

  const payAmount = Number(paymentData.amount) || 0;
  if (payAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  // Fetch target customer to check current credit balance
  const custSnap = await get(ref(database, `companies/${companyId}/customers/${paymentData.customerId}`));
  if (!custSnap.exists()) {
    throw new Error('Selected customer / shop was not found');
  }

  const customer = custSnap.val();
  const currentCredit = Number(customer.currentBalance) || 0;

  // Strict Validation: Cannot write more amount than credit!
  if (payAmount > currentCredit) {
    throw new Error(`Payment amount (Rs ${payAmount}) cannot exceed shop's current credit balance of Rs ${currentCredit}`);
  }

  const paymentId = generateId('pay');
  const newCreditBalance = Math.max(0, currentCredit - payAmount);

  const payment = {
    ...paymentData,
    companyId,
    customerId: paymentData.customerId,
    customerName: customer.shopName || customer.customerName || 'Shop',
    amount: payAmount,
    type: 'customer_payment',
    paymentMethod: paymentData.paymentMethod || 'Cash',
    reference: paymentData.reference || '',
    notes: paymentData.notes || '',
    createdBy: userId || '',
    createdByName: userName || 'User',
    createdAt: paymentData.createdAt || Date.now(),
  };

  const updates = {};
  updates[`companies/${companyId}/payments/${paymentId}`] = payment;
  updates[`companies/${companyId}/customers/${paymentData.customerId}/currentBalance`] = newCreditBalance;
  updates[`companies/${companyId}/customers/${paymentData.customerId}/updatedAt`] = Date.now();

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId: userId || '',
    userName: userName || 'User',
    action: `${userName || 'User'} received payment of Rs ${payAmount} from shop "${customer.shopName || 'Shop'}"`,
    entityType: 'payment',
    entityId: paymentId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
  return paymentId;
}

export async function getCustomerPayments(companyId) {
  const snap = await get(ref(database, `companies/${companyId}/payments`));
  if (!snap.exists()) return [];
  const payments = [];
  snap.forEach(child => {
    const p = child.val();
    if (p.type === 'customer_payment') {
      payments.push({ id: child.key, ...p });
    }
  });
  return payments.sort((a, b) => b.createdAt - a.createdAt);
}

