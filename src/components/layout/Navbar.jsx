// Navbar Component — Mobile Responsive
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, Plus, ChevronDown, Building, X } from 'lucide-react';
import { ref, onValue, query, orderByChild, equalTo, limitToLast, update, get } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { timeAgo } from '../../utils/formatters';

export default function Navbar({ onToggleSidebar, onToggleMobile }) {
  const { userProfile, companyInfo, companyId, isAdmin, currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
  const [userCompanies, setUserCompanies] = useState([]);
  
  const notifRef = useRef(null);
  const quickAddRef = useRef(null);
  const switcherRef = useRef(null);
  const searchRef = useRef(null);

  // Real-time listener for all companies owned by this admin
  useEffect(() => {
    if (!isAdmin || !userProfile?.uid) return;
    
    const compsRef = ref(database, 'companies');
    const unsub = onValue(compsRef, (snap) => {
      if (snap.exists()) {
        const comps = [];
        snap.forEach(child => {
          const val = child.val();
          const c = val ? val.info : null;
          if (c && c.ownerUid === userProfile.uid) {
            comps.push({ id: child.key, ...c });
          }
        });
        setUserCompanies(comps);
      } else {
        setUserCompanies([]);
      }
    });

    return () => unsub();
  }, [isAdmin, userProfile?.uid]);

  // Listen to notifications
  useEffect(() => {
    if (!companyId) return;
    const notifsRef = ref(database, `companies/${companyId}/notifications`);
    const notifsQuery = query(notifsRef, orderByChild('timestamp'), limitToLast(20));

    const unsub = onValue(notifsQuery, (snapshot) => {
      const items = [];
      snapshot.forEach((child) => {
        items.push({ id: child.key, ...child.val() });
      });
      items.reverse();
      setNotifications(items);
    });

    return () => unsub();
  }, [companyId]);

  // Scoped notifications per user account
  const filteredNotifications = useMemo(() => {
    if (isAdmin) {
      return notifications;
    }
    return notifications.filter((n) => {
      if (n.type === 'employee_joined' || n.targetRole === 'admin') return false;
      if (n.userId && n.userId === currentUser?.uid) return true;
      if (n.createdBy && n.createdBy === currentUser?.uid) return true;
      if (userProfile?.name && n.message && n.message.includes(`by ${userProfile.name}`)) return true;
      return false;
    });
  }, [notifications, isAdmin, currentUser?.uid, userProfile?.name]);

  const unreadCount = useMemo(() => {
    return filteredNotifications.filter(n => !n.read).length;
  }, [filteredNotifications]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (quickAddRef.current && !quickAddRef.current.contains(e.target)) {
        setShowQuickAdd(false);
      }
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setShowCompanySwitcher(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    const updates = {};
    filteredNotifications.forEach((n) => {
      if (!n.read) {
        updates[`companies/${companyId}/notifications/${n.id}/read`] = true;
      }
    });
    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
    }
  };

  const quickAddItems = [
    { label: 'New Order', path: '/orders/new', icon: '📦' },
    { label: 'New Customer / Shop', path: '/customers/new', icon: '🏪' },
    { label: 'New Product', path: '/products/new', icon: '📋' },
    ...(isAdmin ? [
      { label: 'New Purchase', path: '/purchases/new', icon: '🛒' },
      { label: 'New Expense', path: '/expenses/new', icon: '💰' },
      { label: 'Make Payment', path: '/payments/new', icon: '💳' },
      { label: 'Ledger Entry', path: '/ledger/new', icon: '📖' },
    ] : []),
  ];

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearch(false);
    }
  };

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
    <header className="navbar">
      {/* Left: Mobile Menu Toggle + Desktop Sidebar Toggle + Company Switcher */}
      <div className="navbar-left">
        {/* Mobile hamburger */}
        <button
          className="navbar-toggle navbar-mobile-toggle"
          onClick={onToggleMobile}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Desktop collapse toggle */}
        <button
          className="navbar-toggle navbar-desktop-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>

        {isAdmin && (
          <div className="dropdown navbar-company-switcher" ref={switcherRef}>
            <button
              className="btn btn-ghost navbar-company-btn"
              onClick={() => setShowCompanySwitcher(!showCompanySwitcher)}
            >
              <Building size={16} className="text-primary-600" />
              <span className="navbar-company-name">{companyInfo?.name || 'Select Company'}</span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {showCompanySwitcher && (
              <div className="dropdown-menu" style={{ width: 250, left: 0, top: '100%', marginTop: '4px' }}>
                <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.5px' }}>
                  Your Companies
                </div>
                {userCompanies.map(comp => {
                  const isClosed = comp.status === 'closed' || comp.status === 'disabled';
                  return (
                    <button
                      key={comp.id}
                      className="dropdown-item"
                      style={{
                        fontWeight: comp.id === companyId ? 600 : 400,
                        background: comp.id === companyId ? 'var(--gray-50)' : 'transparent',
                        opacity: isClosed ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                      }}
                      onClick={async () => {
                        if (isClosed) {
                          alert('This company workspace is closed by System Control.');
                          return;
                        }
                        await update(ref(database, `users/${userProfile.uid}`), { companyId: comp.id });
                        setShowCompanySwitcher(false);
                        window.location.href = '/dashboard';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Building size={14} style={{ opacity: comp.id === companyId ? 1 : 0.5, color: comp.id === companyId ? 'var(--primary-600)' : 'inherit' }} />
                        <span>{comp.name}</span>
                      </div>
                      {isClosed && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>
                          Closed
                        </span>
                      )}
                    </button>
                  );
                })}
                <div style={{ borderTop: '1px solid var(--gray-100)', margin: '4px 0' }}></div>
                <button
                  className="dropdown-item"
                  style={{ color: 'var(--primary-600)', fontWeight: 500 }}
                  onClick={() => {
                    navigate('/setup');
                    setShowCompanySwitcher(false);
                  }}
                >
                  <Plus size={14} /> Create New Company
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center: Search (hidden on mobile, visible on desktop) */}
      <div className="navbar-center">
        <div className="navbar-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search orders, customers, products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>

      {/* Right: Search (mobile), Quick Add, Notifications, Avatar */}
      <div className="navbar-right">
        {/* Mobile Search Toggle */}
        <button
          className="navbar-icon-btn navbar-mobile-search-btn"
          onClick={() => setShowSearch(!showSearch)}
          aria-label="Search"
        >
          <Search size={18} />
        </button>

        {/* Quick Add */}
        <div className="dropdown" ref={quickAddRef}>
          <button
            className="btn btn-primary btn-sm navbar-quick-add-btn"
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <Plus size={16} />
            <span className="navbar-new-label">New</span>
          </button>
          {showQuickAdd && (
            <div className="dropdown-menu" style={{ width: 220, right: 0 }}>
              {quickAddItems.map((item) => (
                <button
                  key={item.path}
                  className="dropdown-item"
                  onClick={() => { navigate(item.path); setShowQuickAdd(false); }}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="dropdown" ref={notifRef}>
          <button
            className="navbar-icon-btn"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="badge-dot" />}
          </button>
          {showNotifications && (
            <div className="notification-panel" style={{ maxWidth: 'min(380px, 90vw)' }}>
              <div className="notification-panel-header">
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button className="btn btn-link btn-sm" onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className="notification-list">
                {filteredNotifications.length === 0 ? (
                  <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)' }}>
                    No notifications yet
                  </div>
                ) : (
                  filteredNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-item ${!notif.read ? 'unread' : ''}`}
                      onClick={() => {
                        if (!notif.read) {
                          update(ref(database, `companies/${companyId}/notifications/${notif.id}`), { read: true });
                        }
                        setShowNotifications(false);
                      }}
                    >
                      <div className="notif-icon">
                        <Bell size={14} />
                      </div>
                      <div className="notif-content">
                        <div className="notif-message">{notif.message}</div>
                        <div className="notif-time">{timeAgo(notif.timestamp)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '10px', borderLeft: '1px solid var(--gray-200)' }}>
          <div className="navbar-avatar" title={userName}>
            {userInitials}
          </div>
          <div className="user-info-navbar" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-800)' }}>{userName}</span>
            <span style={{ fontSize: '10px', color: 'var(--gray-500)', textTransform: 'capitalize' }}>{userProfile?.role || 'Admin'}</span>
          </div>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {showSearch && (
        <div className="navbar-mobile-search-overlay" ref={searchRef}>
          <div className="navbar-search" style={{ flex: 1 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search orders, customers, products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              autoFocus
            />
          </div>
          <button className="navbar-icon-btn" onClick={() => setShowSearch(false)}>
            <X size={18} />
          </button>
        </div>
      )}
    </header>
  );
}
