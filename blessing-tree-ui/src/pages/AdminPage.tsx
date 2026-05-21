import { NavLink, Outlet } from 'react-router-dom';
import { routes } from '@/app/routes';
import { useAuth } from '@/features/auth/model/authContext';
import { isAppAdminRole } from '@/features/campaigns/model/campaignPermissions';

const adminNavItems = [
  {
    label: 'User Management',
    to: routes.ADMIN_USERS,
    icon: 'bi-people',
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
];

export function AdminPage() {
  const { role } = useAuth();

  if (!isAppAdminRole(role)) {
    return (
      <div className="content-card">
        <h1 className="h4 mb-2">Admin Access Required</h1>
        <p className="text-muted mb-0">
          Only application administrators can access this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="vstack gap-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h1 className="h3 mb-1">Admin</h1>
          <p className="text-muted mb-0">
            Manage users, LLM runtime settings, and system health from focused admin sections.
          </p>
        </div>
      </div>

      <div className="content-card">
        <div className="d-flex flex-wrap gap-2">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `btn ${isActive ? 'btn-primary' : 'btn-outline-secondary'}`
              }
            >
              <i className={`bi ${item.icon} me-2`} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
