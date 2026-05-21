import { formatAdminDateTime, type AdminUserWorkspaceRow } from '@/features/admin/model/adminUsersWorkspace';
import { AdminWorkspaceDrawer } from '@/features/admin/ui/AdminWorkspaceDrawer';

interface AdminUserDetailDrawerProps {
  isOpen: boolean;
  user: AdminUserWorkspaceRow | null;
  isSaving: boolean;
  onClose: () => void;
  onResendInvite: (invitationId: string) => void;
}

function statusToneClass(status: AdminUserWorkspaceRow['status']) {
  return status === 'invited' ? 'is-invited' : 'is-active';
}

export function AdminUserDetailDrawer({
  isOpen,
  user,
  isSaving,
  onClose,
  onResendInvite,
}: AdminUserDetailDrawerProps) {
  if (!user) {
    return null;
  }

  return (
    <AdminWorkspaceDrawer
      isOpen={isOpen}
      title={user.displayName}
      description="Review account state, invitation status, and the user’s assigned global app role."
      onClose={onClose}
      width="wide"
    >
      <div className="admin-users-drawer__stack">
        <section className="admin-users-drawer__section">
          <div className="admin-users-drawer__section-header">
            <div>
              <h4 className="h6 mb-1">User Information</h4>
              <p className="text-muted mb-0">
                Core account details for this application user.
              </p>
            </div>
            <span className={`admin-users-status-badge ${statusToneClass(user.status)}`}>
              {user.statusLabel}
            </span>
          </div>
          <dl className="admin-users-detail-grid">
            <div>
              <dt>Name</dt>
              <dd>{user.displayName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Global Role</dt>
              <dd>{user.roleLabel}</dd>
            </div>
            <div>
              <dt>Last Activity</dt>
              <dd>{formatAdminDateTime(user.lastActivityAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="admin-users-drawer__section">
          <div className="admin-users-drawer__section-header">
            <div>
              <h4 className="h6 mb-1">Onboarding</h4>
              <p className="text-muted mb-0">
                Invitation and sign-in state for this user.
              </p>
            </div>
          </div>
          <dl className="admin-users-detail-grid">
            <div>
              <dt>Latest Invitation Status</dt>
              <dd>{user.latestInvitation?.status ?? 'No invitation recorded'}</dd>
            </div>
            <div>
              <dt>Invite Expires</dt>
              <dd>{formatAdminDateTime(user.latestInvitation?.expiresAt ?? null)}</dd>
            </div>
            <div>
              <dt>Invite Accepted</dt>
              <dd>{formatAdminDateTime(user.latestInvitation?.acceptedAt ?? null)}</dd>
            </div>
            <div>
              <dt>Last Sign In</dt>
              <dd>{formatAdminDateTime(user.lastLoginAt)}</dd>
            </div>
          </dl>
        </section>

        <div className="admin-users-drawer__actions">
          {user.latestInvitation?.status === 'pending' ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSaving}
              onClick={() => onResendInvite(user.latestInvitation!.id)}
            >
              {isSaving ? 'Sending...' : 'Resend Invite'}
            </button>
          ) : null}
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </AdminWorkspaceDrawer>
  );
}
