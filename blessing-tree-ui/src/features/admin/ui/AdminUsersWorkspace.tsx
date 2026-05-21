import { useMemo, useState } from 'react';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';
import type {
  AdminInvitation,
  AdminRoleCatalogItem,
  AdminUser,
} from '@/features/admin/model/adminTypes';
import {
  buildAdminUserWorkspaceRows,
  filterAdminUserWorkspaceRows,
  sortAdminUserWorkspaceRows,
  type AdminUserWorkspaceRow,
  type AdminUserWorkspaceSortDirection,
  type AdminUserWorkspaceSortKey,
} from '@/features/admin/model/adminUsersWorkspace';
import {
  createAdminInvite,
  resendAdminInvite,
  updateAdminUserStatus,
} from '@/features/admin/api/adminApi';
import { AdminUserInviteDrawer } from '@/features/admin/ui/AdminUserInviteDrawer';
import { AdminUserDetailDrawer } from '@/features/admin/ui/AdminUserDetailDrawer';
import { AdminUsersTable } from '@/features/admin/ui/AdminUsersTable';
import '@/features/admin/ui/adminUsers.css';

interface AdminUsersWorkspaceProps {
  users: AdminUser[];
  invitations: AdminInvitation[];
  roleCatalog: AdminRoleCatalogItem[];
  onDataChanged: () => Promise<void>;
}

export function AdminUsersWorkspace({
  users,
  invitations,
  roleCatalog,
  onDataChanged,
}: AdminUsersWorkspaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<AdminUserWorkspaceSortKey>('displayName');
  const [sortDirection, setSortDirection] = useState<AdminUserWorkspaceSortDirection>('asc');
  const [isInviteDrawerOpen, setIsInviteDrawerOpen] = useState(false);
  const [inviteDrawerInstance, setInviteDrawerInstance] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserWorkspaceRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    return buildAdminUserWorkspaceRows(users, invitations, roleCatalog);
  }, [users, invitations, roleCatalog]);

  const filteredRows = useMemo(() => {
    return filterAdminUserWorkspaceRows(rows, searchTerm);
  }, [rows, searchTerm]);

  const sortedRows = useMemo(() => {
    return sortAdminUserWorkspaceRows(filteredRows, sortKey, sortDirection);
  }, [filteredRows, sortDirection, sortKey]);

  const handleSort = (nextSortKey: AdminUserWorkspaceSortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection('asc');
  };

  const handleInvite = async (input: {
    email: string;
    displayName: string;
    role: string;
  }): Promise<boolean> => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await createAdminInvite(input);
      await onDataChanged();
      setSuccessMessage('Invitation created and emailed.');
      return true;
    } catch (inviteError) {
      setErrorMessage(
        inviteError instanceof Error ? inviteError.message : 'Unable to create invitation.'
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await resendAdminInvite(invitationId);
      await onDataChanged();
      setSuccessMessage('Invitation resent.');
    } catch (inviteError) {
      setErrorMessage(
        inviteError instanceof Error ? inviteError.message : 'Unable to resend invitation.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUserStatus = async (userId: string, isActive: boolean) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateAdminUserStatus(userId, isActive);
      await onDataChanged();
      setSuccessMessage(isActive ? 'User activated.' : 'User deactivated.');
    } catch (statusError) {
      setErrorMessage(
        statusError instanceof Error ? statusError.message : 'Unable to update user status.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="content-card admin-users-workspace">
        <div className="admin-users-workspace__header">
          <div>
            <h2 className="h5 mb-1">Users</h2>
            <p className="text-muted mb-0">
              Manage invited users, see onboarding state, and resend invitations from one workspace.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setInviteDrawerInstance((currentValue) => currentValue + 1);
              setIsInviteDrawerOpen(true);
            }}
          >
            <i className="bi bi-person-plus me-2" aria-hidden="true" />
            Invite User
          </button>
        </div>

        {successMessage ? (
          <AutoDismissAlert
            message={successMessage}
            onDismiss={() => setSuccessMessage(null)}
            variant="success"
            className="mb-3"
          />
        ) : null}

        {errorMessage ? (
          <div className="alert alert-danger mb-3">{errorMessage}</div>
        ) : null}

        <div className="admin-users-toolbar">
          <div className="admin-users-toolbar__search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              className="form-control"
              placeholder="Search users by name, email, role, or status"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <AdminUsersTable
          rows={sortedRows}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onOpenDetails={setSelectedUser}
          onResendInvite={(invitationId) => void handleResendInvite(invitationId)}
          onUpdateStatus={(userId, isActive) => void handleUpdateUserStatus(userId, isActive)}
        />
      </div>

      <AdminUserInviteDrawer
        key={inviteDrawerInstance}
        isOpen={isInviteDrawerOpen}
        roleCatalog={roleCatalog}
        isSaving={isSaving}
        onClose={() => setIsInviteDrawerOpen(false)}
        onSave={handleInvite}
      />

      <AdminUserDetailDrawer
        isOpen={selectedUser !== null}
        user={selectedUser}
        isSaving={isSaving}
        onClose={() => setSelectedUser(null)}
        onResendInvite={(invitationId) => void handleResendInvite(invitationId)}
      />
    </>
  );
}
