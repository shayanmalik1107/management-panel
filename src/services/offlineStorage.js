// Offline Storage Service — Resilient IndexedDB with Persistent Storage API
const DB_NAME = 'lamba_offline_db';
const DB_VERSION = 1;

let dbPromise = null;

/**
 * Initialize IndexedDB with 'outbox' and 'cache' stores
 */
export function getDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this browser environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Outbox store: Holds pending offline actions (orders, shops, products, payments)
      if (!db.objectStoreNames.contains('outbox')) {
        const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
        outboxStore.createIndex('companyId', 'companyId', { unique: false });
        outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
        outboxStore.createIndex('actionType', 'actionType', { unique: false });
      }

      // 2. Cache store: Holds snapshot data (catalog, customers, recent orders) for offline browsing
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('[Offline Storage] Failed to open IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

/**
 * Request persistent browser storage so device memory is never automatically evicted
 */
export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Offline Storage] Persistent storage granted: ${isPersisted}`);
      return isPersisted;
    } catch (err) {
      console.warn('[Offline Storage] Could not request persistent storage:', err);
    }
  }
  return false;
}

/**
 * Save action to offline outbox queue
 */
export async function saveToOutbox(action) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    
    const record = {
      id: action.id || `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      actionType: action.actionType, // 'create_order', 'create_customer', 'create_product', 'create_payment'
      companyId: action.companyId,
      userId: action.userId,
      userName: action.userName || 'User',
      payload: action.payload,
      createdAt: action.createdAt || Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    const request = store.put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all queued outbox actions for a company (or all)
 */
export async function getOutboxItems(companyId) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const request = store.getAll();

    request.onsuccess = () => {
      let items = request.result || [];
      if (companyId) {
        items = items.filter(item => item.companyId === companyId);
      }
      // Sort chronologically (oldest first for FIFO processing)
      items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      resolve(items);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Remove an item from outbox once synced
 */
export async function removeOutboxItem(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Update an item in outbox (e.g. status = 'syncing' or retry count)
 */
export async function updateOutboxItem(id, updates) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return resolve(null);
      const updated = { ...item, ...updates };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = (e) => reject(e.target.error);
    };
    getReq.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Store snapshot in local cache
 */
export async function setCache(key, data) {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      const request = store.put({ key, data, updatedAt: Date.now() });
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn(`[Offline Cache] Error saving cache for ${key}:`, err);
  }
}

/**
 * Get snapshot from local cache
 */
export async function getCache(key) {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readonly');
      const store = tx.objectStore('cache');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn(`[Offline Cache] Error reading cache for ${key}:`, err);
    return null;
  }
}

/**
 * Save an entire collection (e.g. 'orders', 'customers', 'products') to local cache
 */
export async function cacheCollection(companyId, collectionName, items) {
  const key = `${collectionName}_${companyId}`;
  return setCache(key, items);
}

/**
 * Get an entire collection from local cache
 */
export async function getCachedCollection(companyId, collectionName) {
  const key = `${collectionName}_${companyId}`;
  return (await getCache(key)) || [];
}

/**
 * Add or prepend a newly created item to the local collection cache
 */
export async function addToCachedCollection(companyId, collectionName, newItem) {
  try {
    const items = await getCachedCollection(companyId, collectionName);
    const existingIndex = items.findIndex(i => (i.id && i.id === newItem.id) || (i.orderNumber && i.orderNumber === newItem.orderNumber));
    let updated;
    if (existingIndex >= 0) {
      updated = [...items];
      updated[existingIndex] = { ...updated[existingIndex], ...newItem };
    } else {
      updated = [newItem, ...items];
    }
    await cacheCollection(companyId, collectionName, updated);
    return updated;
  } catch (err) {
    console.warn(`[Offline Cache] Error updating cached collection ${collectionName}:`, err);
    return [];
  }
}
