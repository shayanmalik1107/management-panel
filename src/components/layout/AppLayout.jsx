// App Layout — Main application shell with Sidebar + Navbar + Content
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className={`main-content ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <Navbar
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onToggleMobile={() => setMobileOpen(!mobileOpen)}
        />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
