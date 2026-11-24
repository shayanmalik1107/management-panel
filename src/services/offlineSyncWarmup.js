// Offline Sync Warm-Up Worker
// Silently pre-fetches and saves all necessary collections (products, customers, orders,
// payments, expenses, purchases, company profiles) into local IndexedDB/cache
// immediately upon login, so both Admins and Employees have 100% offline access.

import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { cacheCollection, setCache } from './offlineStorage';

let isWarmupRunning = false;

/**
 * Normalizes Firebase snapshot object / array into a clean array of records
 */
function snapToArray(snap) {
  if (!snap || !snap.exists()) return [];
  const val = snap.val();
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'object') {
    return Object.entries(val).map(([id, item]) => ({
      id,
      ...(typeof item === 'object' ? item : { value: item })
    }));
  }
  return [];
}

/**
 * Pre-cache all core collections for a given companyId
 */
export async function cacheCompanyFullData(companyId) {
  if (!companyId) return;

  try {
    const [infoSnap, prodsSnap, custsSnap, ordersSnap, paymentsSnap, expensesSnap, purchasesSnap] = await Promise.all([
      get(ref(database, `companies/${companyId}/info`)).catch(() => null),
      get(ref(database, `companies/${companyId}/products`)).catch(() => null),
      get(ref(database, `companies/${companyId}/customers`)).catch(() => null),
      get(ref(database, `companies/${companyId}/orders`)).catch(() => null),
      get(ref(database, `companies/${companyId}/payments`)).catch(() => null),
      get(ref(database, `companies/${companyId}/expenses`)).catch(() => null),
      get(ref(database, `companies/${companyId}/purchases`)).catch(() => null),
    ]);

    // 1. Company Info
    if (infoSnap && infoSnap.exists()) {
      const info = { id: companyId, ...infoSnap.val() };
      await setCache(`company_info_${companyId}`, info);
      try {
        localStorage.setItem(`lamba_company_info_${companyId}`, JSON.stringify(info));
      } catch (_) {}
    }

    // 2. Products
    const products = snapToArray(prodsSnap);
    if (products.length > 0) {
      await cacheCollection(companyId, 'products', products);
    }

    // 3. Customers / Shops
    const customers = snapToArray(custsSnap);
    if (customers.length > 0) {
      await cacheCollection(companyId, 'customers', customers);
    }

    // 4. Orders
    const orders = snapToArray(ordersSnap);
    if (orders.length > 0) {
      await cacheCollection(companyId, 'orders', orders);
    }

    // 5. Payments
    const payments = snapToArray(paymentsSnap);
    if (payments.length > 0) {
      await cacheCollection(companyId, 'payments', payments);
    }

    // 6. Expenses
    const expenses = snapToArray(expensesSnap);
    if (expenses.length > 0) {
      await cacheCollection(companyId, 'expenses', expenses);
    }

    // 7. Purchases
    const purchases = snapToArray(purchasesSnap);
    if (purchases.length > 0) {
      await cacheCollection(companyId, 'purchases', purchases);
    }

    console.log(`[Offline Warm-Up] Cached company ${companyId}: ${products.length} products, ${customers.length} customers, ${orders.length} orders.`);
  } catch (err) {
    console.warn(`[Offline Warm-Up] Error caching company ${companyId}:`, err);
  }
}

/**
 * Master warm-up trigger on login / app start
 * Caches all data for the active account and all companies owned by the admin.
 */
export async function warmupOfflineData(userProfile, currentUser) {
  if (isWarmupRunning) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[Offline Warm-Up] Device is offline; skipping network warm-up.');
    return;
  }

  const targetUid = userProfile?.uid || currentUser?.uid;
  if (!targetUid) return;

  isWarmupRunning = true;
  try {
    const isAdmin = userProfile?.role === 'admin';
    const primaryCompanyId = userProfile?.companyId;

    // 1. Employee Account Warm-Up: cache their active assigned company
    if (!isAdmin && primaryCompanyId) {
      await cacheCompanyFullData(primaryCompanyId);
      return;
    }

    // 2. Admin Account Warm-Up: discover all companies owned by this admin
    const companyIds = new Set();
    if (primaryCompanyId) companyIds.add(primaryCompanyId);

    try {
      // Check adminCodes index
      const adminCodesSnap = await get(ref(database, 'adminCodes'));
      if (adminCodesSnap.exists()) {
        adminCodesSnap.forEach((child) => {
          const val = child.val();
          if (val && val.adminUid === targetUid && val.companyId) {
            companyIds.add(val.companyId);
          }
        });
      }
    } catch (_) {}

    try {
      // Check companies owned by targetUid
      const compsSnap = await get(ref(database, 'companies'));
      if (compsSnap.exists()) {
        compsSnap.forEach((child) => {
          const val = child.val();
          const info = val ? val.info : null;
          if (info && (info.ownerUid === targetUid || info.adminUid === targetUid)) {
            companyIds.add(child.key);
          }
        });
      }
    } catch (_) {}

    // Save full list of user companies to local storage
    const discoveredCompanies = [];
    for (const cid of companyIds) {
      try {
        const infoSnap = await get(ref(database, `companies/${cid}/info`));
        if (infoSnap.exists()) {
          const cInfo = { id: cid, ...infoSnap.val() };
          discoveredCompanies.push(cInfo);
          await setCache(`company_info_${cid}`, cInfo);
        }
      } catch (_) {}
    }

    if (discoveredCompanies.length > 0) {
      const cacheKey = `lamba_user_companies_${targetUid}`;
      localStorage.setItem(cacheKey, JSON.stringify(discoveredCompanies));
      await setCache(`user_companies_${targetUid}`, discoveredCompanies);
      console.log(`[Offline Warm-Up] Discovered and saved ${discoveredCompanies.length} companies for Admin ${targetUid}.`);
    }

    // 3. Cache full data for every discovered company so Admin can switch offline
    for (const cid of companyIds) {
      await cacheCompanyFullData(cid);
    }
  } catch (err) {
    console.warn('[Offline Warm-Up] Failed during initial warm-up:', err);
  } finally {
    isWarmupRunning = false;
  }
}
