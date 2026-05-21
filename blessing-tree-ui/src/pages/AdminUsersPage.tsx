import { useEffect, useState } from 'react';
import { fetchAdminUsers } from '@/features/admin/api/adminApi';
import type { AdminUsersPayload } from '@/features/admin/model/adminTypes';
import { AdminUsersWorkspace } from '@/features/admin/ui/AdminUsersWorkspace';

export function AdminUsersPage() {
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
    void loadUsers();
  }, []);

  if (isLoadingUsers) {
    return <div className="content-card">Loading users…</div>;
  }

  if (usersError) {
    return (
      <div className="content-card">
        <div className="alert alert-danger mb-0">{usersError}</div>
      </div>
    );
  }

  if (!usersPayload) {
    return null;
  }

  return (
    <AdminUsersWorkspace
      users={usersPayload.users}
      invitations={usersPayload.invitations}
      roleCatalog={usersPayload.roleCatalog}
      onDataChanged={loadUsers}
    />
  );
}
