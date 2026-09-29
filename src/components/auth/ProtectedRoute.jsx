// Route Protection Components
import { Navigate, useLocation } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/authService';

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

  // If admin is currently on /select-company, allow rendering so they can choose another company!
  const isSelectCompanyRoute = location.pathname === '/select-company' || window.location.pathname === '/select-company';

  if (isCompanyPending && !isSelectCompanyRoute) {
    const companyName = companyInfo?.name || 'This company';

    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center', maxWidth: 480 }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
              marginBottom: 20,
              margin: '0 auto 20px auto',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            <h2 style={{ color: '#d97706', fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
              Company Approval Pending
            </h2>

            <p style={{ color: 'var(--gray-500)', fontSize: 14, lineHeight: 1.5, marginBottom: 28 }}>
              Workspace <strong>"{companyName}"</strong> has been created and is currently awaiting verification & approval from System Control. Once approved, full access will be enabled automatically.
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
      const selected = sessionStorage.getItem('company_selected') === 'true';
      return <Navigate to={selected ? "/dashboard" : "/select-company"} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
