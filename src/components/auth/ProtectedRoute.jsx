// Route Protection Components
import { Navigate, useLocation } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logout, selectUserPackage } from '../../services/authService';

/**
 * Protects routes from unauthenticated users
 */
export function ProtectedRoute({ children }) {
  const { currentUser, loading, isDisabled, isCompanyClosed, isCompanyPending, isAdmin, companyInfo, userProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner lg" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (isDisabled) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--danger-600)', marginBottom: 'var(--space-4)' }}>Account Disabled</h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: 'var(--space-6)' }}>
              Your account has been disabled by System Control. Please contact your system administrator.
            </p>
            <button className="btn btn-secondary" onClick={() => logout()}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Account package & status guard for Admin users
  if (isAdmin && userProfile) {
    const path = location.pathname;
    const isPackageRoute = path === '/select-package';
    const isPaymentPendingRoute = path === '/payment-pending';
    const isControlPanelRoute = path === '/control-panel';

    if (!isControlPanelRoute) {
      if (userProfile.accountStatus === 'select_package' && !isPackageRoute) {
        return <Navigate to="/select-package" replace />;
      }
      if (userProfile.accountStatus === 'pending_approval' && !isPaymentPendingRoute) {
        return <Navigate to="/payment-pending" replace />;
      }
    }

    // Subscription Expiry Check
    const sub = userProfile.subscription;
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const todayTimestamp = now + ((sub?.extraDaysPassed || 0) * oneDayMs);
    const expTime = sub?.expiryDate || (sub?.startDate ? sub.startDate + (30 * oneDayMs) : 0);
    const daysRemaining = expTime ? Math.max(0, Math.ceil((expTime - todayTimestamp) / oneDayMs)) : 30;
    const isExpired = sub && (sub.status === 'expired' || daysRemaining <= 0 || (expTime > 0 && todayTimestamp >= expTime));

    if (isExpired && !isPackageRoute && !isPaymentPendingRoute && !isControlPanelRoute) {
      const expDateStr = sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Expired Date';

      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#ffffff',
        }}>
          <div style={{
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: 24,
            padding: 36,
            maxWidth: 540,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          }}>
            <div style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              margin: '0 auto 20px auto',
            }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 14px',
              borderRadius: 20,
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 14,
            }}>
              🔒 SUBSCRIPTION EXPIRED
            </div>

            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '-0.5px' }}>
              Your Business Subscription Has Ended
            </h2>

            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
              Your subscription plan expired on <strong>{expDateStr}</strong>. Your business data, inventory, orders, and company workspaces are completely safe and preserved. Please choose a renewal option below to reactivate workspace access.
            </p>

            {/* Renewal Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              {/* Option 1: Renew Pro Plan */}
              <button
                onClick={async () => {
                  await selectUserPackage(userProfile.uid, 'pro');
                  window.location.href = '/payment-pending';
                }}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '16px 20px',
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                }}
              >
                <span>Renew Pro Multi-Company Package (3 Companies)</span>
                <span style={{ background: '#ffffff', color: '#1d4ed8', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 900 }}>
                  Rs. 10,000 / mo
                </span>
              </button>

              {/* Option 2: Switch to Basic Plan */}
              <button
                onClick={async () => {
                  await selectUserPackage(userProfile.uid, 'basic');
                  window.location.href = '/payment-pending';
                }}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  padding: '16px 20px',
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Move & Renew with Basic Package (1 Company)</span>
                <span style={{ background: '#e2e8f0', color: '#334155', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 900 }}>
                  Rs. 5,000 / mo
                </span>
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              💡 Once payment is approved by Control Panel, your system will instantly unlock right where you left off.
            </div>
          </div>
        </div>
      );
    }
  }

  // If admin is currently on /select-company, allow rendering so they can choose another company!
  const isSelectCompanyRoute = location.pathname === '/select-company' || window.location.pathname === '/select-company';

  if (isCompanyClosed && !isSelectCompanyRoute) {
    const companyName = companyInfo?.name || 'This company';

    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center', maxWidth: 480 }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              marginBottom: 20,
              margin: '0 auto 20px auto',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>

            <h2 style={{ color: 'var(--danger-600)', fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
              Company Workspace Disabled
            </h2>

            <p style={{ color: 'var(--gray-500)', fontSize: 14, lineHeight: 1.5, marginBottom: 28 }}>
              Access to <strong>"{companyName}"</strong> has been disabled by System Control. Please select another company workspace to continue.
            </p>

            {isAdmin ? (
              <button
                className="btn btn-primary btn-block btn-lg"
                style={{ background: '#2563eb', color: '#fff', fontWeight: 700 }}
                onClick={async () => {
                  sessionStorage.clear();
                  try {
                    if (userProfile?.uid) {
                      await update(ref(database, `users/${userProfile.uid}`), { companyId: null });
                    }
                  } catch (err) {
                    console.error('Failed to clear companyId:', err);
                  }
                  window.location.href = '/select-company';
                }}
              >
                Select Other Company Workspace
              </button>
            ) : (
              <button
                className="btn btn-secondary btn-block"
                onClick={() => logout()}
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return children;
}

/**
 * Protects admin-only routes
 */
export function AdminRoute({ children }) {
  const { currentUser, loading, isAdmin, userProfile } = useAuth();

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner lg" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * Redirect authenticated users away from auth pages
 */
export function PublicRoute({ children }) {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner lg" />
        <span>Loading...</span>
      </div>
    );
  }

  if (currentUser && userProfile) {
    if (userProfile.role === 'admin') {
      if (userProfile.accountStatus === 'select_package') {
        return <Navigate to="/select-package" replace />;
      }
      if (userProfile.accountStatus === 'pending_approval') {
        return <Navigate to="/payment-pending" replace />;
      }
      const selected = sessionStorage.getItem('company_selected') === 'true';
      return <Navigate to={selected ? "/dashboard" : "/select-company"} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
