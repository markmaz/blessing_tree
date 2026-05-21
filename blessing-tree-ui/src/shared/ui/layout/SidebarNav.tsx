import { NavLink, Link, useLocation } from 'react-router-dom';
import { routes } from '@/app/routes';
import { useAppFeatures } from '@/features/admin/model/appFeaturesContext';
import { useAuth } from '@/features/auth/model/authContext';
import { isAppAdminRole } from '@/features/campaigns/model/campaignPermissions';

interface SidebarNavProps {
  isOpen: boolean;
  onNavigate: () => void;
}

const navItems = [
  {
    label: 'Dashboard',
    to: routes.HOME,
    icon: 'bi-speedometer2',
    end: true,
  },
  {
    label: 'Campaigns',
    to: routes.CAMPAIGNS,
    icon: 'bi-stars',
  },
  {
    label: 'Families',
    to: routes.FAMILIES,
    icon: 'bi-people',
  },
  {
    label: 'Donations',
    to: routes.DONATIONS,
    icon: 'bi-cash-stack',
  },
  {
    label: 'Reports',
    to: routes.REPORTS,
    icon: 'bi-clipboard-data',
  },
  {
    label: 'Admin',
    to: routes.ADMIN,
    icon: 'bi-gear',
    children: [
      {
        label: 'User Management',
        to: routes.ADMIN_USERS,
        icon: 'bi-people-fill',
      },
      {
        label: 'LLM Configuration',
        to: routes.ADMIN_LLM,
        icon: 'bi-cpu',
      },
      {
        label: 'Health Check',
        to: routes.ADMIN_HEALTH,
        icon: 'bi-heart-pulse',
      },
      {
        label: 'App Capabilities',
        to: routes.ADMIN_CAPABILITIES,
        icon: 'bi-toggles2',
      },
    ],
  },
];

export function SidebarNav({ isOpen, onNavigate }: SidebarNavProps) {
  const location = useLocation();
  const { role } = useAuth();
  const { isFeatureEnabled } = useAppFeatures();
  const visibleItems = navItems.filter((item) => {
    if (item.to === routes.FAMILIES) return isFeatureEnabled('families');
    if (item.to === routes.DONATIONS) return isFeatureEnabled('donations');
    if (item.to === routes.REPORTS) return isFeatureEnabled('reports');
    if (item.to === routes.ADMIN) return isAppAdminRole(role);
    return true;
  });

  return (
    <aside className={`app-sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="sidebar-header">
        <Link to={routes.HOME} className="sidebar-brand" onClick={onNavigate}>
          <img
            src="/blessing-tree-logo.png"
            alt="Blessing Tree logo"
            className="sidebar-logo"
          />
        </Link>
      </div>

      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <div key={item.label} className="sidebar-nav-group">
            <NavLink
              to={item.children?.length ? item.children[0].to : item.to}
              end={item.end}
              className={() =>
                `sidebar-link nav-link ${
                  item.children?.some((child) => location.pathname.startsWith(child.to)) ||
                  (!item.children?.length &&
                    (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))
                    ? 'active'
                    : ''
                }`
              }
              onClick={onNavigate}
            >
              <i className={`bi ${item.icon} me-2`} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
            {item.children?.length ? (
              <div className="sidebar-subnav">
                {item.children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={({ isActive }) =>
                      `sidebar-sublink nav-link ${isActive ? 'active' : ''}`
                    }
                    onClick={onNavigate}
                  >
                    <i className={`bi ${child.icon} me-2`} aria-hidden="true" />
                    <span>{child.label}</span>
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-card">
          <div className="text-uppercase small">Season Theme</div>
          <div className="fw-semibold">Grace &amp; Renewal</div>
        </div>
      </div>
    </aside>
  );
}
