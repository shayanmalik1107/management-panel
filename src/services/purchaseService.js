import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';

export async function createPurchase(companyId, purchaseData, userId, userName) {
  const purchaseId = generateId('pur');
  const items = purchaseData.items || [];
  
  const purchase = {
    ...purchaseData,
    companyId,
    grandTotal: Number(purchaseData.grandTotal) || 0,
    items: items,
    createdBy: userId,
    createdByName: userName,
    createdAt: purchaseData.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  const updates = {};
  updates[`companies/${companyId}/purchases/${purchaseId}`] = purchase;

  // Process items to update stock, weighted average cost price, and sale price
  if (items.length > 0) {
    // Fetch all current products snapshot
    const prodSnap = await get(ref(database, `companies/${companyId}/products`));
    const allProducts = prodSnap.exists() ? prodSnap.val() : {};

    for (const item of items) {
      if (!item.productId) continue;

      const prod = allProducts[item.productId];
      if (!prod) continue;

      const existingStock = Number(prod.currentStock) || 0;
      const existingCostPrice = Number(prod.purchasePrice || prod.costPrice) || 0;
      const purchasedQty = Number(item.quantity) || 0;
      const newPurchaseCost = Number(item.purchasePrice) || 0;

      const newTotalStock = existingStock + purchasedQty;

      // Calculate Weighted Average Cost Price
      let weightedCostPrice = newPurchaseCost;
      if (existingStock > 0 && newTotalStock > 0) {
        const oldTotalValue = existingStock * existingCostPrice;
        const newTotalValue = purchasedQty * newPurchaseCost;
        weightedCostPrice = Math.round(((oldTotalValue + newTotalValue) / newTotalStock) * 100) / 100;
      }

      // Update Sale Price if provided
      const newSalePrice = item.salePrice !== undefined && Number(item.salePrice) > 0 
        ? Number(item.salePrice) 
        : (Number(prod.salePrice) || 0);

      // Apply updates to Firebase
      updates[`companies/${companyId}/products/${item.productId}/currentStock`] = newTotalStock;
      updates[`companies/${companyId}/products/${item.productId}/purchasePrice`] = weightedCostPrice;
      updates[`companies/${companyId}/products/${item.productId}/costPrice`] = weightedCostPrice;
      updates[`companies/${companyId}/products/${item.productId}/salePrice`] = newSalePrice;
      updates[`companies/${companyId}/products/${item.productId}/updatedAt`] = Date.now();
    }
  }

  // Record Activity Log
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
