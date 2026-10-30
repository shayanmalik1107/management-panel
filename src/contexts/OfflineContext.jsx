// Offline Context — Tracks connectivity and outbox queue sync
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getOutboxItems, requestPersistentStorage } from '../services/offlineStorage';
import { processOutbox, onSyncStatusChange, initAutoSync } from '../services/syncEngine';

const OfflineContext = createContext();

export function OfflineProvider({ children }) {
  const { companyId } = useAuth();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingItems, setPendingItems] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Load outbox count
  const refreshOutbox = useCallback(async () => {
    try {
      const items = await getOutboxItems(companyId);
      setPendingItems(items);
    } catch (err) {
      console.warn('[Offline Context] Error reading outbox items:', err);
    }
  }, [companyId]);

  useEffect(() => {
    refreshOutbox();
    requestPersistentStorage();
  }, [refreshOutbox]);

  // Listen to sync engine status
  useEffect(() => {
    const unsubStatus = onSyncStatusChange((status) => {
      if (status.isSyncing !== undefined) setIsSyncing(status.isSyncing);
      if (status.isOnline !== undefined) setIsOnline(status.isOnline);
      if (status.lastSyncTime) setLastSyncTime(status.lastSyncTime);
      refreshOutbox();
    });

    const unsubAutoSync = initAutoSync(companyId);

    const handleOnline = () => {
      setIsOnline(true);
      refreshOutbox();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshOutbox();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubStatus();
      if (unsubAutoSync) unsubAutoSync();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [companyId, refreshOutbox]);

  const syncNow = async () => {
    if (isSyncing) return;
    await processOutbox(companyId);
    await refreshOutbox();
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount: pendingItems.length,
        pendingItems,
        lastSyncTime,
        syncNow,
        refreshOutbox,
        showSyncModal,
        setShowSyncModal,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
