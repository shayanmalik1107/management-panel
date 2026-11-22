// Product Service — CRUD operations for products with duplicate prevention and validation
import { ref, push, get, update, remove, set } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';
import { saveToOutbox, addToCachedCollection, cacheCollection, getCachedCollection, getOutboxItems, getActiveCachedUserId } from './offlineStorage';

export async function createProduct(companyId, productData, userId, userName) {
  const nameTrimmed = (productData.name || '').trim();
  const skuTrimmed = (productData.sku || '').trim();

  if (!nameTrimmed) {
    throw new Error('Product name is required');
  }
  if (!skuTrimmed) {
    throw new Error('SKU / Barcode is required');
  }
  if (Number(productData.purchasePrice) <= 0) {
    throw new Error('Purchase price must be greater than 0');
  }
  if (Number(productData.salePrice) <= 0) {
    throw new Error('Sale price must be greater than 0');
  }

  // Check duplicate name and SKU in existing products
  const existingProducts = await getProducts(companyId);
  const nameDuplicate = existingProducts.find(
    p => (p.name || '').trim().toLowerCase() === nameTrimmed.toLowerCase()
  );
  if (nameDuplicate) {
    throw new Error(`A product named "${nameTrimmed}" already exists.`);
  }

  const skuDuplicate = existingProducts.find(
    p => p.sku && p.sku.trim().toLowerCase() === skuTrimmed.toLowerCase()
  );
  if (skuDuplicate) {
    throw new Error(`A product with SKU "${skuTrimmed}" already exists.`);
  }

  const productId = generateId('prod');
  const product = {
    ...productData,
    name: nameTrimmed,
    sku: skuTrimmed,
    companyId,
    warehouseId: productData.warehouseId || '',
    warehouseName: productData.warehouseName || '',
    currentStock: Number(productData.currentStock) || 0,
    purchasePrice: Number(productData.purchasePrice) || 0,
    salePrice: Number(productData.salePrice) || 0,
    minimumStock: Number(productData.minimumStock) || 0,
    createdBy: userId || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // If offline, save locally
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return createProductOffline(companyId, productId, product, nameTrimmed, userId, userName);
  }

  try {
    const updates = {};
    updates[`companies/${companyId}/products/${productId}`] = product;

    // Activity log
    const actId = generateId('act');
    updates[`companies/${companyId}/activities/${actId}`] = {
      userId: userId || '',
      userName: userName || 'User',
      action: `${userName || 'User'} added product "${nameTrimmed}"`,
      entityType: 'product',
      entityId: productId,
      timestamp: Date.now(),
    };

    // If supplier name is provided with initial stock, also record initial stock purchase
    if (productData.supplierName && Number(productData.currentStock) > 0) {
      const purId = generateId('pur');
      const cost = Number(productData.purchasePrice) || 0;
      const qty = Number(productData.currentStock) || 0;
      const total = cost * qty;

      let purchaseTimestamp = Date.now();
      if (productData.purchaseDate) {
        const selectedDate = new Date(productData.purchaseDate);
        const now = new Date();
        selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        purchaseTimestamp = selectedDate.getTime();
      }

      updates[`companies/${companyId}/purchases/${purId}`] = {
        id: purId,
        companyId,
        supplierName: productData.supplierName,
        reference: productData.reference || 'Initial Stock',
        grandTotal: total,
        items: [{
          productId: productId,
          productName: nameTrimmed,
          sku: skuTrimmed,
          quantity: qty,
          purchasePrice: cost,
          salePrice: Number(productData.salePrice) || 0,
          lineTotal: total
        }],
        notes: productData.notes ? productData.notes : `Initial stock purchase for ${nameTrimmed}`,
        createdBy: userId || '',
        createdByName: userName || 'User',
        createdAt: purchaseTimestamp,
        updatedAt: Date.now()
      };
    }

    // Update onboarding
    updates[`companies/${companyId}/onboarding/firstProduct`] = true;

    await update(ref(database), updates);
    await addToCachedCollection(companyId, 'products', { id: productId, ...product });
    return productId;
  } catch (err) {
    if (!navigator.onLine || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
      console.warn('[Product Service] Network write failed, saving to offline outbox:', err);
      return createProductOffline(companyId, productId, product, nameTrimmed, userId, userName);
    }
    throw err;
  }
}

async function createProductOffline(companyId, productId, product, nameTrimmed, userId, userName) {
  const localProduct = { ...product, id: productId, isPendingSync: true };
  const actId = generateId('act');
  const activity = {
    id: actId,
    userId: userId || '',
    userName: userName || 'User',
    action: `${userName || 'User'} added product "${nameTrimmed}" (Offline)`,
    entityType: 'product',
    entityId: productId,
    timestamp: Date.now(),
  };
  let initialPurchase = null;
  if (product.supplierName && Number(product.currentStock) > 0) {
    const purchaseId = generateId('pur');
    let purchaseTimestamp = Date.now();
    if (product.purchaseDate) {
      const selectedDate = new Date(product.purchaseDate);
      const now = new Date();
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      purchaseTimestamp = selectedDate.getTime();
    }
    const quantity = Number(product.currentStock) || 0;
    const cost = Number(product.purchasePrice) || 0;
    initialPurchase = {
      id: purchaseId, companyId, supplierName: product.supplierName,
      reference: product.reference || 'Initial Stock', grandTotal: quantity * cost,
      items: [{ productId, productName: nameTrimmed, sku: product.sku, quantity, purchasePrice: cost, salePrice: Number(product.salePrice) || 0, lineTotal: quantity * cost }],
      notes: product.notes || `Initial stock purchase for ${nameTrimmed}`,
      createdBy: userId || '', createdByName: userName || 'User',
      createdAt: purchaseTimestamp, updatedAt: Date.now(),
    };
  }

  await saveToOutbox({
    companyId,
    actionType: 'create_product',
    payload: {
      productId,
      product: localProduct,
      activity
    },
    userId,
    userName,
    description: `Product "${nameTrimmed}"`
  });

  // Keep this product in the creator's pending outbox only. It must not leak
  // into the shared company snapshot on a browser used by another account.
  return productId;
}

export async function updateProduct(companyId, productId, productData, userId, userName) {
  const nameTrimmed = (productData.name || '').trim();
  const skuTrimmed = (productData.sku || '').trim();

  if (!nameTrimmed) {
    throw new Error('Product name is required');
  }
  if (!skuTrimmed) {
    throw new Error('SKU / Barcode is required');
  }
  if (Number(productData.purchasePrice) <= 0) {
    throw new Error('Purchase price must be greater than 0');
  }
  if (Number(productData.salePrice) <= 0) {
    throw new Error('Sale price must be greater than 0');
  }

  // Check duplicate name and SKU (excluding current productId)
  const existingProducts = await getProducts(companyId);
  const nameDuplicate = existingProducts.find(
    p => p.id !== productId && (p.name || '').trim().toLowerCase() === nameTrimmed.toLowerCase()
  );
  if (nameDuplicate) {
    throw new Error(`Another product named "${nameTrimmed}" already exists.`);
  }

  const skuDuplicate = existingProducts.find(
    p => p.id !== productId && p.sku && p.sku.trim().toLowerCase() === skuTrimmed.toLowerCase()
  );
  if (skuDuplicate) {
    throw new Error(`Another product with SKU "${skuTrimmed}" already exists.`);
  }

  const updates = {};
  const updatedProduct = {
    ...productData,
    name: nameTrimmed,
    sku: skuTrimmed,
    warehouseId: productData.warehouseId !== undefined ? productData.warehouseId : '',
    warehouseName: productData.warehouseName !== undefined ? productData.warehouseName : '',
    purchasePrice: Number(productData.purchasePrice) || 0,
    salePrice: Number(productData.salePrice) || 0,
    minimumStock: Number(productData.minimumStock) || 0,
    updatedAt: Date.now(),
  };

  // Don't overwrite currentStock through product edit (use inventory for that)
  delete updatedProduct.currentStock;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const localProduct = { ...updatedProduct, id: productId, companyId, isPendingSync: true };
    const actId = generateId('act');
    const activity = {
      id: actId, userId: userId || '', userName: userName || 'User',
      action: `${userName || 'User'} updated product \"${nameTrimmed}\" (Offline)`,
      entityType: 'product', entityId: productId, timestamp: Date.now(),
    };
    await saveToOutbox({
      companyId, actionType: 'update_product', userId, userName,
      payload: { productId, product: localProduct, activity },
      description: `Update product \"${nameTrimmed}\"`,
    });
    return { isOffline: true, productId };
  }

  Object.keys(updatedProduct).forEach(key => {
    if (updatedProduct[key] !== undefined) {
      updates[`companies/${companyId}/products/${productId}/${key}`] = updatedProduct[key];
    }
  });

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId: userId || '',
    userName: userName || 'User',
    action: `${userName || 'User'} updated product "${nameTrimmed}"`,
    entityType: 'product',
    entityId: productId,
    timestamp: Date.now(),
  };

  try {
    await update(ref(database), updates);
  } catch (error) {
    if (!navigator.onLine || /network|offline|failed to fetch|unavailable/i.test(error?.message || '')) {
      const localProduct = { ...updatedProduct, id: productId, companyId, isPendingSync: true };
      const activity = {
        id: actId, userId: userId || '', userName: userName || 'User',
        action: `${userName || 'User'} updated product \"${nameTrimmed}\" (Offline)`,
        entityType: 'product', entityId: productId, timestamp: Date.now(),
      };
      await saveToOutbox({ companyId, actionType: 'update_product', userId, userName, payload: { productId, product: localProduct, activity }, description: `Update product \"${nameTrimmed}\"` });
      return { isOffline: true, productId };
    }
    throw error;
  }
}

export async function getProducts(companyId) {
  const userId = getActiveCachedUserId();
  let cloudProducts = [];
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const snap = await get(ref(database, `companies/${companyId}/products`));
      if (snap.exists()) {
        snap.forEach(child => {
          const value = child.val();
          if (value && value.name && String(value.name).trim()) cloudProducts.push({ id: child.key, ...value });
        });
      }
      // Store only server-confirmed products in the shared company snapshot.
      await cacheCollection(companyId, 'products', cloudProducts);
    } catch (error) {
      console.warn('[Product Service] Server fetch failed, using local snapshot:', error);
      cloudProducts = (await getCachedCollection(companyId, 'products')).filter(product => !product.isPendingSync);
    }
  } else {
    cloudProducts = (await getCachedCollection(companyId, 'products')).filter(product => !product.isPendingSync);
  }

  const pending = await getOutboxItems(companyId);
  // Pending admin product changes are visible only to the account that created them.
  const ownPending = pending.filter(item => item.userId === userId);
  const map = new Map(cloudProducts.map(product => [product.id, product]));
  ownPending.forEach(item => {
    const product = item.payload?.product;
    const productId = item.payload?.productId || product?.id;
    if (!product || !productId) return;
    if (item.actionType === 'create_product' || item.actionType === 'update_product') {
      map.set(productId, { ...map.get(productId), ...product, id: productId, isPendingSync: true });
    }
  });
  return Array.from(map.values());
}

export async function getProduct(companyId, productId) {
  const products = await getProducts(companyId);
  return products.find(product => product.id === productId) || null;
}

export async function deleteProduct(companyId, productId, productName, userId, userName) {
  const updates = {};
  updates[`companies/${companyId}/products/${productId}`] = null;

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId: userId || '',
    userName: userName || 'User',
    action: `${userName || 'User'} deleted product "${productName || 'Product'}"`,
    entityType: 'product',
    entityId: productId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
}

/**
 * Remove nameless entries and duplicate products from Firebase database
 */
export async function cleanUpDuplicateProducts(companyId) {
  const snap = await get(ref(database, `companies/${companyId}/products`));
  if (!snap.exists()) return 0;

  const updates = {};
  const seenNames = new Map();
  let removedCount = 0;

  snap.forEach(child => {
    const p = child.val();
    const id = child.key;
    const nameKey = (p && p.name ? String(p.name).trim().toLowerCase() : '');

    // If nameless or empty product, delete from Firebase
    if (!nameKey) {
      updates[`companies/${companyId}/products/${id}`] = null;
      removedCount++;
      return;
    }

    // If duplicate name already seen, keep first and delete duplicate
    if (seenNames.has(nameKey)) {
      updates[`companies/${companyId}/products/${id}`] = null;
      removedCount++;
    } else {
      seenNames.set(nameKey, id);
    }
  });

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }

  return removedCount;
}
