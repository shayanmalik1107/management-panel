// Auth Context: Centralized authentication and user state
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, update } from 'firebase/database';
import { auth, database } from '../firebase';
import { warmupOfflineData } from '../services/offlineSyncWarmup';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// Read cached offline session so app opens and logs in instantly offline
function getCachedAuthSession() {
  try {
    const raw = localStorage.getItem('lamba_auth_session');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[AuthContext] Failed to read cached session:', e);
  }
  return null;
}

function saveCachedAuthSession(user, profile, company) {
  try {
    if (user && profile) {
      localStorage.setItem('lamba_auth_session', JSON.stringify({
        currentUser: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || profile.name,
        },
        userProfile: profile,
        companyInfo: company,
        savedAt: Date.now(),
      }));
    }
  } catch (e) {
    console.warn('[AuthContext] Failed to save session to cache:', e);
  }
}

export function AuthProvider({ children }) {
  const cached = getCachedAuthSession();

  const [currentUser, setCurrentUser] = useState(cached?.currentUser || null);
  const [userProfile, setUserProfile] = useState(cached?.userProfile || null);
  const [companyInfo, setCompanyInfo] = useState(cached?.companyInfo || null);
  // If we already have a cached session, do not block the UI on network!
  const [loading, setLoading] = useState(!cached);

  // Track active listeners so we can clean them up properly
  const companyUnsubRef = useRef(null);
  const userUnsubRef = useRef(null);

  useEffect(() => {
    // If offline on initial load, ensure loading spinner is removed immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine && cached) {
      setLoading(false);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // If user is null but we are offline and have a cached session, preserve it!
      const explicitLogout = localStorage.getItem('lamba_explicit_logout') === '1';
      if (!user && !navigator.onLine && cached && !explicitLogout) {
        console.log('[AuthContext] Offline mode: retaining cached session.');
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      // Clean up previous user listener
      if (userUnsubRef.current) {
        userUnsubRef.current();
        userUnsubRef.current = null;
      }
      // Clean up previous company listener
      if (companyUnsubRef.current) {
        companyUnsubRef.current();
        companyUnsubRef.current = null;
      }

      if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        const unsubUser = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const profile = { uid: user.uid, ...snapshot.val(), permissionsSyncedAt: Date.now() };
            setUserProfile(profile);

            // Silently warm up all offline collections in the background
            warmupOfflineData(profile, user);

            const activeLocalCompId = localStorage.getItem(`lamba_selected_company_${user.uid}`);
            const companyId = activeLocalCompId || profile.companyId;

            // Clean up previous company listener before creating new one
            if (companyUnsubRef.current) {
              companyUnsubRef.current();
              companyUnsubRef.current = null;
            }

            if (companyId) {
              const companyRef = ref(database, `companies/${companyId}/info`);
              const unsubCompany = onValue(companyRef, (companySnap) => {
                let comp = null;
                if (companySnap.exists()) {
                  comp = { id: companyId, ...companySnap.val() };
                  setCompanyInfo(comp);
                } else {
                  // Fallback to local storage cached company info
                  try {
                    const localCached = localStorage.getItem(`lamba_company_info_${companyId}`);
                    if (localCached) comp = JSON.parse(localCached);
                  } catch (_) {}
                  setCompanyInfo(comp || null);
                }
                saveCachedAuthSession(user, profile, comp);
                setLoading(false);
              }, (err) => {
                console.warn('[AuthContext] Company info offline fallback:', err);
                try {
                  const localCached = localStorage.getItem(`lamba_company_info_${companyId}`);
                  if (localCached) setCompanyInfo(JSON.parse(localCached));
                } catch (_) {}
                setLoading(false);
              });
              companyUnsubRef.current = unsubCompany;
            } else {
              setCompanyInfo(null);
              saveCachedAuthSession(user, profile, null);
              setLoading(false);
            }
          } else {
            setUserProfile(null);
            setCompanyInfo(null);
            setLoading(false);
          }
        }, (err) => {
          console.warn('[AuthContext] User profile offline fallback:', err);
          setLoading(false);
        });
        userUnsubRef.current = unsubUser;
      } else {
        // Explicit logout must clear the offline shortcut even without internet.
        setUserProfile(null);
        setCompanyInfo(null);
        localStorage.removeItem('lamba_auth_session');
        localStorage.removeItem('lamba_explicit_logout');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (userUnsubRef.current) userUnsubRef.current();
      if (companyUnsubRef.current) companyUnsubRef.current();
    };
  }, []);

  const isAdmin = userProfile?.role === 'admin';
  const isEmployee = userProfile?.role === 'employee';
  const targetUid = userProfile?.uid || currentUser?.uid;
  const activeLocalCompId = targetUid ? localStorage.getItem(`lamba_selected_company_${targetUid}`) : null;
  const companyId = activeLocalCompId || userProfile?.companyId;
  const permissions = userProfile?.permissions || {};
  const isDisabled = userProfile?.status === 'disabled';
  const isCompanyClosed = companyInfo?.status === 'closed' || companyInfo?.status === 'disabled';
  const isCompanyPending = companyInfo?.status === 'pending';

  const switchCompany = async (newCompanyId) => {
    if (!newCompanyId) return;
    const uid = userProfile?.uid || currentUser?.uid;
    if (uid) {
      localStorage.setItem(`lamba_selected_company_${uid}`, newCompanyId);
    }
    
    // 1. Immediately update userProfile state
    setUserProfile(prev => prev ? ({ ...prev, companyId: newCompanyId }) : prev);

    // 2. Read cached company info for instant 0ms offline switch
    let newCompInfo = null;
    try {
      const localCached = localStorage.getItem(`lamba_company_info_${newCompanyId}`);
      if (localCached) newCompInfo = JSON.parse(localCached);
      if (!newCompInfo) {
        const userComps = JSON.parse(localStorage.getItem(`lamba_user_companies_${uid}`) || '[]');
        newCompInfo = userComps.find(c => c.id === newCompanyId);
      }
    } catch (_) {}
    if (newCompInfo) {
      setCompanyInfo(newCompInfo);
    }

    // 3. Update cached auth session
    saveCachedAuthSession(currentUser, { ...userProfile, companyId: newCompanyId }, newCompInfo || companyInfo);

    // 4. Try updating Firebase if online
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine && uid) {
        await update(ref(database, `users/${uid}`), { companyId: newCompanyId });
      }
    } catch (err) {
      console.warn('[AuthContext] Cloud update for company switch delayed:', err);
    }
  };

  const hasPermission = (permission) => {
    if (isAdmin) return true;
    return permissions[permission] === true;
  };

  const canEditOrderPrice = isAdmin || userProfile?.canEditPrice !== false;

  const value = {
    currentUser,
    userProfile,
    companyInfo,
    companyId,
    isAdmin,
    isEmployee,
    permissions,
    isDisabled,
    isCompanyClosed,
    isCompanyPending,
    hasPermission,
    canEditOrderPrice,
    switchCompany,
    permissionsSyncedAt: userProfile?.permissionsSyncedAt || cached?.userProfile?.permissionsSyncedAt || null,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
