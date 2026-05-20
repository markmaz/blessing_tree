import { NavLink, Link } from 'react-router-dom';
import { routes } from '@/app/routes';

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
  },
];

export function SidebarNav({ isOpen, onNavigate }: SidebarNavProps) {
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
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `sidebar-link nav-link ${isActive ? 'active' : ''}`
            }
            onClick={onNavigate}
          >
            <i className={`bi ${item.icon} me-2`} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
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
