// Offline Context — Tracks connectivity, outbox queue count, and PWA installation
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
  
  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);

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

  // PWA beforeinstallprompt & standalone detection
  useEffect(() => {
    // Check if already in standalone display mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsAppInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsAppInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trigger app installation (Desktop & Mobile)
  const installApp = async () => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setCanInstall(false);
      }
      setDeferredPrompt(null);
    } else if (isIos && !isAppInstalled) {
      setShowIosInstallGuide(true);
    } else {
      // Direct instructions for Chromium Desktop (Mac / Windows)
      alert(
        'To install LAMBA as a desktop or mobile app:\n\n' +
        '• On Chrome / Edge (Mac / PC): Click the Install icon (⊞ or ⬇) in the browser address bar.\n' +
        '• On Android: Tap Menu (⋮) -> "Install App" or "Add to Home Screen".\n' +
        '• On iOS (Safari): Tap the Share button (⎙) -> "Add to Home Screen".'
      );
    }
  };

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
        canInstall,
        isAppInstalled,
        installApp,
        showIosInstallGuide,
        setShowIosInstallGuide,
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
