import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/authContext';
import { isAppAdminRole } from '@/features/campaigns/model/campaignPermissions';

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
            Manage users, campaign operations, LLM runtime settings, and system health from the admin menu.
          </p>
        </div>
      </div>

      <Outlet />
    </div>
  );
}
