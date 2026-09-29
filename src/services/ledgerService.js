// Ledger Service — CRUD & Realtime listening for Ledger Entries
import { ref, get, update, onValue } from 'firebase/database';
import { database } from '../firebase';
import { generateId } from '../utils/codeGenerator';

export async function createLedgerEntry(companyId, entryData, userId, userName) {
  const entryId = generateId('led');
  const entry = {
    ...entryData,
    companyId,
    date: entryData.date || new Date().toISOString().split('T')[0],
    payment: Number(entryData.payment) || 0,
    purchase: Number(entryData.purchase) || 0,
    supplierName: entryData.supplierName || '',
    description: entryData.description || '',
    reference: entryData.reference || '',
    createdBy: userId || '',
    createdByName: userName || 'User',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updates = {};
  updates[`companies/${companyId}/ledger/${entryId}`] = entry;

  const actId = generateId('act');
  updates[`companies/${companyId}/activities/${actId}`] = {
    userId: userId || '',
    userName: userName || 'User',
    action: `${userName || 'User'} added ledger entry (Purchase: Rs ${entry.purchase}, Payment: Rs ${entry.payment})`,
    entityType: 'ledger',
    entityId: entryId,
    timestamp: Date.now(),
  };

  await update(ref(database), updates);
  return entryId;
}

export async function getLedgerEntries(companyId) {
  if (!companyId) return [];
  const snap = await get(ref(database, `companies/${companyId}/ledger`));
  if (!snap.exists()) return [];
  const entries = [];
  snap.forEach(child => {
    entries.push({ id: child.key, ...child.val() });
  });
  return entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

export function listenLedgerEntries(companyId, callback, errorCallback) {
  if (!companyId) return () => {};
  const ledgerRef = ref(database, `companies/${companyId}/ledger`);
  const unsubscribe = onValue(
    ledgerRef,
    (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push({ id: child.key, ...child.val() });
        });
      }
      list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      callback(list);
    },
    (err) => {
      if (errorCallback) errorCallback(err);
    }
  );
  return unsubscribe;
}

export async function updateLedgerEntry(companyId, entryId, entryData) {
  const updates = {};
  const updated = {
    date: entryData.date || new Date().toISOString().split('T')[0],
    payment: Number(entryData.payment) || 0,
    purchase: Number(entryData.purchase) || 0,
    supplierName: entryData.supplierName || '',
    description: entryData.description || '',
    reference: entryData.reference || '',
    updatedAt: Date.now(),
  };

  Object.keys(updated).forEach(key => {
    updates[`companies/${companyId}/ledger/${entryId}/${key}`] = updated[key];
  });

  await update(ref(database), updates);
}

export async function deleteLedgerEntry(companyId, entryId) {
  await update(ref(database), { [`companies/${companyId}/ledger/${entryId}`]: null });
}
