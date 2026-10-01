// Supplier Service
import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';

export async function createSupplier(companyId, supplierData, userId, userName) {
  const supplierId = generateId('sup');
  const supplier = {
    ...supplierData,
    companyId,
    totalPurchases: 0,
    amountPaid: 0,
    outstandingBalance: 0,
    createdBy: userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updates = {};
  updates[`companies/${companyId}/suppliers/${supplierId}`] = supplier;

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId, userName,
    action: `${userName} added supplier "${supplierData.name}"`,
    entityType: 'supplier', entityId: supplierId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
  return supplierId;
}

export async function getSuppliers(companyId) {
  const snap = await get(ref(database, `companies/${companyId}/suppliers`));
  if (!snap.exists()) return [];
  const suppliers = [];
  snap.forEach(child => {
    suppliers.push({ id: child.key, ...child.val() });
  });
  return suppliers;
}

export async function updateSupplier(companyId, supplierId, data) {
  const updates = {};
  Object.keys(data).forEach(key => {
    updates[`companies/${companyId}/suppliers/${supplierId}/${key}`] = data[key];
  });
  updates[`companies/${companyId}/suppliers/${supplierId}/updatedAt`] = Date.now();
  await update(ref(database), updates);
}

/**
 * Fetch all unique supplier names across registered suppliers, purchases, payments, and ledger
 */
export async function fetchAllCompanySuppliers(companyId) {
  try {
    const [supSnap, purSnap, paySnap, ledSnap] = await Promise.all([
      get(ref(database, `companies/${companyId}/suppliers`)),
      get(ref(database, `companies/${companyId}/purchases`)),
      get(ref(database, `companies/${companyId}/payments`)),
      get(ref(database, `companies/${companyId}/ledger`))
    ]);

    const supplierSet = new Set();

    if (supSnap.exists()) {
      supSnap.forEach(c => {
        const val = c.val();
        const name = val?.name || val?.supplierName;
        if (name && String(name).trim()) supplierSet.add(String(name).trim());
      });
    }

    if (purSnap.exists()) {
      purSnap.forEach(c => {
        const val = c.val();
        if (val?.supplierName && String(val.supplierName).trim()) {
          supplierSet.add(String(val.supplierName).trim());
        }
      });
    }

    if (paySnap.exists()) {
      paySnap.forEach(c => {
        const val = c.val();
        if (val?.supplierName && String(val.supplierName).trim()) {
          supplierSet.add(String(val.supplierName).trim());
        }
      });
    }

    if (ledSnap.exists()) {
      ledSnap.forEach(c => {
        const val = c.val();
        if (val?.supplierName && String(val.supplierName).trim()) {
          supplierSet.add(String(val.supplierName).trim());
        }
      });
    }

    return Array.from(supplierSet).sort();
  } catch (err) {
    console.error('Error in fetchAllCompanySuppliers:', err);
    return [];
  }
}
