// Auth Context: Centralized authentication and user state
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, database } from '../firebase';

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
      // Clear any explicit logout flag on fresh session save
      localStorage.removeItem('lamba_explicit_logout');
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
    // If cached session exists, never block UI with a loading spinner
    if (cached) {
      setLoading(false);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const explicitLogout = localStorage.getItem('lamba_explicit_logout') === '1';

      if (!user) {
        // If the user did NOT explicitly log out, keep them logged in locally!
        if (cached && !explicitLogout) {
          console.log('[AuthContext] Preserving active local session for offline/mobile use.');
          setCurrentUser(cached.currentUser);
          setUserProfile(cached.userProfile);
          setCompanyInfo(cached.companyInfo);
          setLoading(false);
          return;
        }

        // Only clear when explicit logout was triggered
        setUserProfile(null);
        setCompanyInfo(null);
        setCurrentUser(null);
        localStorage.removeItem('lamba_auth_session');
        localStorage.removeItem('lamba_explicit_logout');
        setLoading(false);
        return;
      }

      // Live authenticated user from Firebase
      localStorage.removeItem('lamba_explicit_logout');
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

      const userRef = ref(database, `users/${user.uid}`);
      const unsubUser = onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const profile = { uid: user.uid, ...snapshot.val(), permissionsSyncedAt: Date.now() };
          setUserProfile(profile);

          const companyId = profile.companyId;

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
                setCompanyInfo(null);
              }
              saveCachedAuthSession(user, profile, comp);
              setLoading(false);
            }, (err) => {
              console.warn('[AuthContext] Company info offline fallback:', err);
              saveCachedAuthSession(user, profile, cached?.companyInfo || null);
              setLoading(false);
            });
            companyUnsubRef.current = unsubCompany;
          } else {
            setCompanyInfo(null);
            saveCachedAuthSession(user, profile, null);
            setLoading(false);
          }
        } else {
          // If server returns empty but we have cached profile and no explicit logout, retain cached
          if (cached?.userProfile && !explicitLogout) {
            setUserProfile(cached.userProfile);
            setCompanyInfo(cached.companyInfo);
          } else {
            setUserProfile(null);
            setCompanyInfo(null);
          }
          setLoading(false);
        }
      }, (err) => {
        console.warn('[AuthContext] User profile offline fallback:', err);
        if (cached?.userProfile && !explicitLogout) {
          setUserProfile(cached.userProfile);
          setCompanyInfo(cached.companyInfo);
        }
        setLoading(false);
      });
      userUnsubRef.current = unsubUser;
    });

    return () => {
      unsubscribeAuth();
      if (userUnsubRef.current) userUnsubRef.current();
      if (companyUnsubRef.current) companyUnsubRef.current();
    };
  }, []);

  const isAdmin = userProfile?.role === 'admin';
  const isEmployee = userProfile?.role === 'employee';
  const companyId = userProfile?.companyId;
  const permissions = userProfile?.permissions || {};
  const isDisabled = userProfile?.status === 'disabled';
  const isCompanyClosed = companyInfo?.status === 'closed' || companyInfo?.status === 'disabled';
  const isCompanyPending = companyInfo?.status === 'pending';

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
    permissionsSyncedAt: userProfile?.permissionsSyncedAt || cached?.userProfile?.permissionsSyncedAt || null,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
