// Warehouse Service — CRUD operations for Warehouses
import { ref, get, update, onValue } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';

export async function createWarehouse(companyId, warehouseData, userId, userName) {
  const nameTrimmed = (warehouseData.name || '').trim();

  if (!nameTrimmed) {
    throw new Error('Warehouse name is required');
  }

  // Check duplicate warehouse name
  const existingWarehouses = await getWarehouses(companyId);
  const duplicate = existingWarehouses.find(
    w => (w.name || '').trim().toLowerCase() === nameTrimmed.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A warehouse named "${nameTrimmed}" already exists.`);
  }

  const warehouseId = generateId('wh');
  const warehouse = {
    name: nameTrimmed,
    creationDate: warehouseData.creationDate || new Date().toISOString().split('T')[0],
    address: (warehouseData.address || '').trim(),
    notes: (warehouseData.notes || '').trim(),
    companyId,
    createdBy: userId || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updates = {};
  updates[`companies/${companyId}/warehouses/${warehouseId}`] = warehouse;

  // Activity log
  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId: userId || '',
    userName: userName || 'User',
    action: `${userName || 'User'} created warehouse "${nameTrimmed}"`,
    entityType: 'warehouse',
    entityId: warehouseId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
  return warehouseId;
}

export async function updateWarehouse(companyId, warehouseId, warehouseData, userId, userName) {
  const nameTrimmed = (warehouseData.name || '').trim();

  if (!nameTrimmed) {
    throw new Error('Warehouse name is required');
  }

  const existingWarehouses = await getWarehouses(companyId);
  const duplicate = existingWarehouses.find(
    w => w.id !== warehouseId && (w.name || '').trim().toLowerCase() === nameTrimmed.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`Another warehouse named "${nameTrimmed}" already exists.`);
  }

  const updates = {};
  const updatedWarehouse = {
    name: nameTrimmed,
    creationDate: warehouseData.creationDate || new Date().toISOString().split('T')[0],
    address: (warehouseData.address || '').trim(),
    notes: (warehouseData.notes || '').trim(),
    updatedAt: Date.now(),
  };

  Object.keys(updatedWarehouse).forEach(key => {
    if (updatedWarehouse[key] !== undefined) {
      updates[`companies/${companyId}/warehouses/${warehouseId}/${key}`] = updatedWarehouse[key];
    }
  });

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId: userId || '',
    userName: userName || 'User',
    action: `${userName || 'User'} updated warehouse "${nameTrimmed}"`,
    entityType: 'warehouse',
    entityId: warehouseId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
}

export async function deleteWarehouse(companyId, warehouseId, warehouseName, userId, userName) {
  const updates = {};
  updates[`companies/${companyId}/warehouses/${warehouseId}`] = null;

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId: userId || '',
    userName: userName || 'User',
    action: `${userName || 'User'} deleted warehouse "${warehouseName || 'Warehouse'}"`,
    entityType: 'warehouse',
    entityId: warehouseId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
}

export async function getWarehouses(companyId) {
  if (!companyId) return [];
  const snap = await get(ref(database, `companies/${companyId}/warehouses`));
  if (!snap.exists()) return [];
  const list = [];
  snap.forEach(child => {
    const val = child.val();
    if (val && val.name) {
      list.push({ id: child.key, ...val });
    }
  });
  return list;
}

export async function getWarehouse(companyId, warehouseId) {
  if (!companyId || !warehouseId) return null;
  const snap = await get(ref(database, `companies/${companyId}/warehouses/${warehouseId}`));
  return snap.exists() ? { id: warehouseId, ...snap.val() } : null;
}

export function listenWarehouses(companyId, callback, errorCallback) {
  if (!companyId) return () => {};
  const warehousesRef = ref(database, `companies/${companyId}/warehouses`);
  const unsubscribe = onValue(
    warehousesRef,
    (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();
          if (val && val.name) {
            list.push({ id: child.key, ...val });
          }
        });
      }
      // Sort by creation date or name
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      callback(list);
    },
    (err) => {
      if (errorCallback) errorCallback(err);
    }
  );
  return unsubscribe;
}
