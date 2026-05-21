import { useEffect, useState } from 'react';
import { fetchAdminUsers } from '@/features/admin/api/adminApi';
import type { AdminUsersPayload } from '@/features/admin/model/adminTypes';
import { AdminUserInvitesCard } from '@/features/admin/ui/AdminUserInvitesCard';
import { AdminLlmConfigCard } from '@/features/admin/ui/AdminLlmConfigCard';
import { AdminHealthCard } from '@/features/admin/ui/AdminHealthCard';
import { AdminFeatureFlagsCard } from '@/features/admin/ui/AdminFeatureFlagsCard';
import { useAuth } from '@/features/auth/model/authContext';
import { isAppAdminRole } from '@/features/campaigns/model/campaignPermissions';

export function AdminPage() {
  const { role } = useAuth();
  const [usersPayload, setUsersPayload] = useState<AdminUsersPayload | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const loadUsers = async () => {
    setUsersError(null);
    try {
      setUsersPayload(await fetchAdminUsers());
    } catch (loadError) {
      setUsersError(loadError instanceof Error ? loadError.message : 'Unable to load admin users.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!isAppAdminRole(role)) {
      setIsLoadingUsers(false);
      return;
    }
    void loadUsers();
  }, [role]);

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
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h1 className="h3 mb-1">Admin</h1>
          <p className="text-muted mb-0">
            Manage onboarding, runtime health, LLM configuration, and application features.
          </p>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12">
          {isLoadingUsers ? (
            <div className="content-card">Loading users…</div>
          ) : usersError ? (
            <div className="content-card">
              <div className="alert alert-danger mb-0">{usersError}</div>
            </div>
          ) : usersPayload ? (
            <AdminUserInvitesCard
              users={usersPayload.users}
              invitations={usersPayload.invitations}
              roleCatalog={usersPayload.roleCatalog}
              onDataChanged={loadUsers}
            />
          ) : null}
        </div>
        <div className="col-12 col-xl-6">
          <AdminLlmConfigCard />
        </div>
        <div className="col-12 col-xl-6">
          <AdminHealthCard />
        </div>
        <div className="col-12">
          <AdminFeatureFlagsCard />
        </div>
      </div>
    </div>
  );
}
