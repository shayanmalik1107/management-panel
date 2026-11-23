import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, PlusCircle, Users, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';

export default function MobileBottomNav({ onOpenMenu }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isEmployee } = useAuth();
  const { isOnline, pendingCount } = useOffline();

  const currentPath = location.pathname;

  const isActive = (path) => {
    if (path === '/') return currentPath === '/' || currentPath === '/dashboard';
    return currentPath.startsWith(path);
  };

  return (
    <nav className="mobile-bottom-nav">
      <button
        type="button"
        className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}
        onClick={() => navigate('/')}
      >
        <LayoutDashboard size={20} />
        <span>Home</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-item ${isActive('/orders') && currentPath !== '/orders/new' ? 'active' : ''}`}
        onClick={() => navigate('/orders')}
      >
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <ShoppingCart size={20} />
          {pendingCount > 0 && (
            <span className="mobile-nav-badge">{pendingCount}</span>
          )}
        </div>
        <span>Orders</span>
      </button>

      <button
        type="button"
        className="mobile-nav-item mobile-nav-action-btn"
        onClick={() => navigate('/orders/new')}
        title="Create New Order"
      >
        <div className="mobile-action-circle">
          <PlusCircle size={26} />
        </div>
        <span>New</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-item ${isActive('/customers') ? 'active' : ''}`}
        onClick={() => navigate('/customers')}
      >
        <Users size={20} />
        <span>Customers</span>
      </button>

      <button
        type="button"
        className="mobile-nav-item"
        onClick={onOpenMenu}
      >
        <Menu size={20} />
        <span>Menu</span>
      </button>
    </nav>
  );
}

