import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';

export async function createPurchase(companyId, purchaseData, userId, userName) {
  const purchaseId = generateId('pur');
  const purchase = {
    ...purchaseData,
    companyId,
    grandTotal: Number(purchaseData.grandTotal),
    createdBy: userId,
    createdByName: userName,
    createdAt: purchaseData.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  const updates = {};
  updates[`companies/${companyId}/purchases/${purchaseId}`] = purchase;

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} recorded stock purchase from ${purchaseData.supplierName} - Rs ${purchaseData.grandTotal}`,
    entityType: 'purchase', entityId: purchaseId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
  return purchaseId;
}

export async function updatePurchase(companyId, purchaseId, purchaseData, userId, userName) {
  const updates = {};
  const updated = {
    supplierName: purchaseData.supplierName || 'General Supplier',
    reference: purchaseData.reference || '',
    grandTotal: Number(purchaseData.grandTotal) || 0,
    notes: purchaseData.notes || '',
    updatedAt: Date.now(),
  };

  Object.keys(updated).forEach(key => {
    updates[`companies/${companyId}/purchases/${purchaseId}/${key}`] = updated[key];
  });

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} updated purchase ${purchaseId}`,
    entityType: 'purchase', entityId: purchaseId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
}

export async function deletePurchase(companyId, purchaseId) {
  await update(ref(database), { [`companies/${companyId}/purchases/${purchaseId}`]: null });
}

export async function getPurchases(companyId) {
  const snap = await get(ref(database, `companies/${companyId}/purchases`));
  if (!snap.exists()) return [];
  const purchases = [];
  snap.forEach(child => {
    purchases.push({ id: child.key, ...child.val() });
  });
  return purchases.sort((a, b) => b.createdAt - a.createdAt);
}
