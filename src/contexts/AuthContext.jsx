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

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Track active listeners so we can clean them up properly
  const companyUnsubRef = useRef(null);
  const userUnsubRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
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
            const profile = { uid: user.uid, ...snapshot.val() };
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
                if (companySnap.exists()) {
                  setCompanyInfo({ id: companyId, ...companySnap.val() });
                } else {
                  setCompanyInfo(null);
                }
                setLoading(false);
              });
              companyUnsubRef.current = unsubCompany;
            } else {
              setCompanyInfo(null);
              setLoading(false);
            }
          } else {
            setUserProfile(null);
            setCompanyInfo(null);
            setLoading(false);
          }
        });
        userUnsubRef.current = unsubUser;
      } else {
        setUserProfile(null);
        setCompanyInfo(null);
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
  const companyId = userProfile?.companyId;
  const permissions = userProfile?.permissions || {};
  const isDisabled = userProfile?.status === 'disabled';
  const isCompanyClosed = companyInfo?.status === 'closed' || companyInfo?.status === 'disabled';
  const isCompanyPending = companyInfo?.status === 'pending';

  const hasPermission = (permission) => {
    if (isAdmin) return true;
    return permissions[permission] === true;
  };

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
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
