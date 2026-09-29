// Sidebar Navigation Component
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
  ChevronLeft,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { userProfile, companyInfo, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await logout();
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
    { section: 'TEAM', items: [
      { to: '/employees', icon: Users, label: 'Employees' },
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

  return (
    <>
      {mobileOpen && <div className="mobile-overlay" onClick={onMobileClose} />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div 
            className="sidebar-logo" 
            onClick={collapsed ? onToggle : undefined}
            style={{ cursor: collapsed ? 'pointer' : 'default' }}
            title={collapsed ? 'Expand sidebar' : ''}
          >
            <Building2 size={20} />
          </div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">BizManager</span>
            <span className="sidebar-brand-sub">Business Suite</span>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onToggle}
            style={{ marginLeft: 'auto' }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={18} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

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

        <div className="sidebar-footer">
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
