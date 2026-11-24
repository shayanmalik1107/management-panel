// Sidebar Navigation Component
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Store,
  Package,
  Warehouse,
  TrendingUp,
  ShoppingBag,
  Receipt,
  CreditCard,
  BookOpen,
  Users,
  BarChart3,
  LogOut,
  Building2,
  Sparkles,
  ChevronDown,
  Check
} from 'lucide-react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { logout } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';
import WhatsAppButton from '../common/WhatsAppButton';

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { userProfile, companyInfo, companyId, isAdmin, currentUser, switchCompany } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [userCompanies, setUserCompanies] = useState([]);
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);

  // Real-time listener for user companies
  useEffect(() => {
    if (!isAdmin || !userProfile?.uid) return;

    // Load cached companies first for instant 0ms offline availability
    try {
      const cached = JSON.parse(localStorage.getItem(`lamba_user_companies_${userProfile.uid}`) || '[]');
      if (cached.length > 0) setUserCompanies(cached);
    } catch (_) {}

    const compsRef = ref(database, 'companies');
    const unsub = onValue(compsRef, (snap) => {
      if (snap.exists()) {
        const comps = [];
        snap.forEach(child => {
          const val = child.val();
          const c = val ? val.info : null;
          if (c && (c.ownerUid === userProfile.uid || c.adminUid === userProfile.uid)) {
            comps.push({ id: child.key, ...c });
          }
        });
        setUserCompanies(comps);
        try {
          localStorage.setItem(`lamba_user_companies_${userProfile.uid}`, JSON.stringify(comps));
        } catch (_) {}
      } else {
        setUserCompanies([]);
      }
    }, (err) => {
      console.warn('[Sidebar] Offline companies fallback:', err);
    });
    return () => unsub();
  }, [isAdmin, userProfile?.uid]);

  const handleLogout = async () => {
    try {
      await logout();
      onMobileClose?.();
      navigate('/login');
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const adminLinks = [
    { section: 'DASHBOARD', items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ]},
    { section: 'BUSINESS', items: [
      { to: '/orders', icon: ShoppingCart, label: 'Orders' },
      { to: '/customers', icon: Store, label: 'Customers / Shops' },
      { to: '/products', icon: Package, label: 'Products' },
      { to: '/inventory', icon: Warehouse, label: 'Warehouse' },
    ]},
    { section: 'FINANCE', items: [
      { to: '/sales', icon: TrendingUp, label: 'Sales' },
      { to: '/purchases', icon: ShoppingBag, label: 'Purchases' },
      { to: '/expenses', icon: Receipt, label: 'Expenses' },
      { to: '/payments', icon: CreditCard, label: 'Payments' },
      { to: '/ledger', icon: BookOpen, label: 'Ledger' },
    ]},
    { section: 'TEAM & ACCOUNT', items: [
      { to: '/employees', icon: Users, label: 'Employees' },
      { to: '/billing', icon: Sparkles, label: 'Subscription & Billing' },
    ]},
    { section: 'ANALYTICS', items: [
      { to: '/reports', icon: BarChart3, label: 'Reports' },
    ]},
  ];

  const employeeLinks = [
    { section: 'DASHBOARD', items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ]},
    { section: 'WORK', items: [
      { to: '/orders', icon: ShoppingCart, label: 'My Orders' },
      { to: '/customers', icon: Store, label: 'Customers / Shops' },
      { to: '/products', icon: Package, label: 'Products' },
    ]},
  ];

  const links = isAdmin ? adminLinks : employeeLinks;
  const userName = userProfile?.name || currentUser?.displayName || 'User';
  const userInitials = (userName || 'User')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const maxComp = userProfile?.maxCompanies || userProfile?.package?.maxCompanies || 1;
  const planName = userProfile?.package?.name || (userProfile?.package?.planId === 'pro' ? 'Pro Plan' : 'Basic Plan');
  const isPro = userProfile?.package?.planId === 'pro' || maxComp > 1;

  return (
    <>
      {mobileOpen && <div className="mobile-overlay" onClick={onMobileClose} />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header" style={{ padding: collapsed ? '14px 10px' : '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div 
            className="sidebar-logo-wrap" 
            onClick={collapsed ? onToggle : undefined}
            style={{ cursor: collapsed ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
            title={collapsed ? 'Expand LAMBA sidebar' : 'LAMBA'}
          >
            {collapsed ? (
              <img src={isDark ? "/lambalogow.png" : "/lambalogo.png"} alt="LAMBA" style={{ height: '36px', maxWidth: '36px', objectFit: 'contain' }} />
            ) : (
              <>
                <img src={isDark ? "/lambabgw.png" : "/lamba.png"} alt="LAMBA" className="lamba-logo-desktop" style={{ height: '38px', maxWidth: '160px', objectFit: 'contain' }} />
                <img src={isDark ? "/lambalogow.png" : "/lambalogo.png"} alt="LAMBA" className="lamba-logo-mobile" style={{ height: '34px', maxWidth: '34px', objectFit: 'contain' }} />
              </>
            )}
          </div>
        </div>

        {/* Company Workspace & Plan Card (Mobile View & Drawer Only) */}
        {!collapsed && (
          <div className="sidebar-mobile-only" style={{ padding: '0 14px 10px 14px', flexDirection: 'column', gap: 8 }}>
            {/* Active Company Selector */}
            <div style={{
              background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9',
              borderRadius: 10,
              padding: '10px 12px',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <Building2 size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--gray-500)', fontWeight: 700, letterSpacing: '0.5px' }}>
                      Active Company
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {companyInfo?.name || 'Workspace'}
                    </div>
                  </div>
                </div>

                {isAdmin && userCompanies.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowCompanySwitcher(!showCompanySwitcher)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      fontSize: 11,
                      fontWeight: 700
                    }}
                  >
                    Switch <ChevronDown size={12} />
                  </button>
                )}
              </div>

              {/* Company Switcher Options */}
              {showCompanySwitcher && isAdmin && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {userCompanies.map(comp => {
                    const isSelected = comp.id === companyId;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={async () => {
                          if (comp.id !== companyId) {
                            await switchCompany(comp.id);
                            onMobileClose?.();
                            navigate('/dashboard');
                            toast.success(`Switched to ${comp.name}!`);
                          }
                          setShowCompanySwitcher(false);
                        }}
                        style={{
                          background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                          border: 'none',
                          color: isSelected ? '#2563eb' : 'inherit',
                          padding: '6px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.name}</span>
                        {isSelected && <Check size={13} color="#2563eb" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Plan Badge Card inside Drawer */}
            {isAdmin && (
              <div 
                onClick={() => {
                  onMobileClose?.();
                  navigate('/billing');
                }}
                style={{
                  background: isPro ? (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff') : (isDark ? 'rgba(51, 65, 85, 0.4)' : '#f8fafc'),
                  border: isPro ? (isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #bfdbfe') : (isDark ? '1px solid #334155' : '1px solid #cbd5e1'),
                  borderRadius: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                title="Tap to manage subscription"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color={isPro ? '#2563eb' : '#64748b'} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: isPro ? '#1d4ed8' : 'var(--color-text-primary)' }}>
                    {planName} ({userCompanies.length || 1}/{maxComp})
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>
                  Billing →
                </span>
              </div>
            )}
          </div>
        )}

        <nav className="sidebar-nav">
          {links.map((group) => (
            <div className="sidebar-section" key={group.section}>
              <div className="sidebar-section-label">{group.section}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={onMobileClose}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="link-icon">
                    <item.icon size={18} />
                  </span>
                  <span className="link-text">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* WhatsApp Queries / Support in Side Drawer */}
        <div style={{
          padding: collapsed ? '8px 8px 10px' : '8px 14px 10px',
          borderTop: 'var(--border)',
        }}>
          <WhatsAppButton
            phoneNumber="03104824942"
            variant="sidebar"
            collapsed={collapsed}
            label="WhatsApp Queries"
            subLabel="03104824942"
            userRole={isAdmin ? 'Admin' : 'Employee'}
          />
        </div>

        {/* Sidebar Footer with Explicit Sign Out Button */}
        <div className="sidebar-footer" style={{ paddingBottom: 'calc(var(--mobile-nav-height, 60px) + 24px)' }}>
          <button
            type="button"
            className="sidebar-logout-btn sidebar-mobile-only"
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.25)',
              background: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
              color: '#ef4444',
              fontWeight: 700,
              fontSize: 12,
              marginBottom: 10,
              cursor: 'pointer'
            }}
          >
            <LogOut size={15} /> Sign Out
          </button>

          <div className="sidebar-user" onClick={handleLogout} title="Sign out">
            <div className="sidebar-user-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-role">{userProfile?.role}</div>
            </div>
            <LogOut size={16} style={{ color: 'var(--gray-400)' }} />
          </div>
        </div>
      </aside>
    </>
  );
}
