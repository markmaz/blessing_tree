import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppFooter } from './AppFooter';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';

const DESKTOP_BREAKPOINT = 992;

const getIsDesktop = () =>
  window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches;

const getPageTitle = (pathname: string) => {
  if (pathname.startsWith('/campaigns/') && pathname.endsWith('/studio')) {
    return 'Campaign Studio';
  }
  if (pathname.startsWith('/campaigns')) return 'Campaigns';
  if (pathname.startsWith('/families')) return 'Families';
  if (pathname.startsWith('/donations')) return 'Donations';
  if (pathname.startsWith('/reports')) return 'Reports';
  if (pathname.startsWith('/admin')) return 'Admin';
  return 'Dashboard';
};

export function AppLayout() {
  const location = useLocation();
  const pageTitle = useMemo(
    () => getPageTitle(location.pathname),
    [location.pathname]
  );

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return getIsDesktop();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(
      `(min-width: ${DESKTOP_BREAKPOINT}px)`
    );

    const handleChange = (event: MediaQueryListEvent) => {
      setSidebarOpen(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const handleNavClick = () => {
    if (!getIsDesktop()) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="app-shell">
      <SidebarNav isOpen={sidebarOpen} onNavigate={handleNavClick} />

      <div className="app-main">
        <TopBar pageTitle={pageTitle} onToggleSidebar={handleToggleSidebar} />

        <main className="app-content">
          <div className="container-fluid py-4 px-4 px-lg-5">
            <Outlet />
          </div>
        </main>

        <AppFooter />
      </div>

      <button
        type="button"
        className={`app-sidebar-backdrop ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close sidebar"
      />
    </div>
  );
}
