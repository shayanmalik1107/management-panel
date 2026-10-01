// Product Service — CRUD operations for products with duplicate prevention and validation
import { ref, push, get, update, remove, set } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';

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

  await update(ref(database), updates);
}

export async function getProducts(companyId) {
  const snap = await get(ref(database, `companies/${companyId}/products`));
  if (!snap.exists()) return [];
  const products = [];
  snap.forEach(child => {
    const val = child.val();
    if (val && val.name && String(val.name).trim()) {
      products.push({ id: child.key, ...val });
    }
  });
  return products;
}

export async function getProduct(companyId, productId) {
  const snap = await get(ref(database, `companies/${companyId}/products/${productId}`));
  return snap.exists() ? { id: productId, ...snap.val() } : null;
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
