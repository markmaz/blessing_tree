import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/authContext';
import { isAppAdminRole } from '@/features/campaigns/model/campaignPermissions';
import { WorkspacePageHeader } from '@/shared/ui/WorkspacePageHeader';

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
      <WorkspacePageHeader
        title="Admin"
        description="Manage users, campaign operations, LLM runtime settings, and system health from the admin menu."
      />

      <Outlet />
    </div>
  );
}
