import { useEffect, useState } from 'react';
import type { AdminRoleCatalogItem } from '@/features/admin/model/adminTypes';
import {
  fetchAdminUserCampaignAccess,
  updateAdminUserCampaignAccess,
} from '@/features/admin/api/adminApi';
import { formatAdminDateTime, type AdminUserWorkspaceRow } from '@/features/admin/model/adminUsersWorkspace';
import { AdminWorkspaceDrawer } from '@/features/admin/ui/AdminWorkspaceDrawer';

interface AdminUserDetailDrawerProps {
  isOpen: boolean;
  user: AdminUserWorkspaceRow | null;
  roleCatalog: AdminRoleCatalogItem[];
  isSaving: boolean;
  onClose: () => void;
  onResendInvite: (invitationId: string) => void;
  onUpdateRole: (userId: string, role: string) => void;
  onRequestDelete: (user: AdminUserWorkspaceRow) => void;
}

function statusToneClass(status: AdminUserWorkspaceRow['status']) {
  if (status === 'inactive') {
    return 'is-inactive';
  }
  return status === 'invited' ? 'is-invited' : 'is-active';
}

export function AdminUserDetailDrawer({
  isOpen,
  user,
  roleCatalog,
  isSaving,
  onClose,
  onResendInvite,
  onUpdateRole,
  onRequestDelete,
}: AdminUserDetailDrawerProps) {
  const [selectedRole, setSelectedRole] = useState(user?.roleKey ?? '');
  const [campaignAccessRows, setCampaignAccessRows] = useState<
    Array<{
      campaign: { id: string; name: string; year: number; status: string };
      roleKeys: string[];
      capabilities: string[];
    }>
  >([]);
  const [campaignRoleCatalog, setCampaignRoleCatalog] = useState<AdminRoleCatalogItem[]>([]);
  const [draftCampaignRoles, setDraftCampaignRoles] = useState<Record<string, string>>({});
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const selectedUserId = user?.id;

  useEffect(() => {
    setSelectedRole(user?.roleKey ?? '');
  }, [user?.roleKey]);

  useEffect(() => {
    if (!isOpen || !selectedUserId) {
      setCampaignAccessRows([]);
      setCampaignRoleCatalog([]);
      setDraftCampaignRoles({});
      setAccessError(null);
      setAccessMessage(null);
      return;
    }

    const userId = selectedUserId;
    let cancelled = false;
    async function loadCampaignAccess() {
      setIsLoadingAccess(true);
      setAccessError(null);
      setAccessMessage(null);
      try {
        const payload = await fetchAdminUserCampaignAccess(userId);
        if (cancelled) {
          return;
        }
        setCampaignAccessRows(payload.campaigns);
        setCampaignRoleCatalog(payload.roleCatalog);
        setDraftCampaignRoles(
          Object.fromEntries(
            payload.campaigns.map((row) => [row.campaign.id, row.roleKeys[0] ?? ''])
          )
        );
      } catch (loadError) {
        if (!cancelled) {
          setAccessError(loadError instanceof Error ? loadError.message : 'Unable to load campaign access.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAccess(false);
        }
      }
    }

    void loadCampaignAccess();
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedUserId]);

  if (!user) {
    return null;
  }

  const campaignAccessChanged = campaignAccessRows.some(
    (row) => (draftCampaignRoles[row.campaign.id] ?? '') !== (row.roleKeys[0] ?? '')
  );

  const handleSaveCampaignAccess = async () => {
    setIsSavingAccess(true);
    setAccessError(null);
    setAccessMessage(null);
    try {
      const payload = await updateAdminUserCampaignAccess(
        user.id,
        campaignAccessRows
          .map((row) => ({
            campaignId: row.campaign.id,
            roleKeys: draftCampaignRoles[row.campaign.id] ? [draftCampaignRoles[row.campaign.id]] : [],
          }))
          .filter((assignment) => assignment.roleKeys.length > 0)
      );
      setCampaignAccessRows(payload.campaigns);
      setCampaignRoleCatalog(payload.roleCatalog);
      setDraftCampaignRoles(
        Object.fromEntries(
          payload.campaigns.map((row) => [row.campaign.id, row.roleKeys[0] ?? ''])
        )
      );
      setAccessMessage('Campaign access saved.');
    } catch (saveError) {
      setAccessError(saveError instanceof Error ? saveError.message : 'Unable to save campaign access.');
    } finally {
      setIsSavingAccess(false);
    }
  };

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
              <dd>
                <select
                  className="form-select"
                  aria-label="Global app access"
                  value={selectedRole}
                  disabled={isSaving}
                  onChange={(event) => setSelectedRole(event.target.value)}
                >
                  {roleCatalog.map((role) => (
                    <option key={role.roleKey} value={role.roleKey}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </dd>
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
              <h4 className="h6 mb-1">Campaign Access</h4>
              <p className="text-muted mb-0">
                Choose one simple access level per campaign.
              </p>
            </div>
          </div>
          {accessError ? <div className="alert alert-danger">{accessError}</div> : null}
          {accessMessage ? <div className="alert alert-success">{accessMessage}</div> : null}
          {isLoadingAccess ? (
            <p className="text-muted mb-0">Loading campaign access...</p>
          ) : campaignAccessRows.length === 0 ? (
            <p className="text-muted mb-0">No campaigns are available.</p>
          ) : (
            <div className="admin-users-campaign-access">
              {campaignAccessRows.map((row) => (
                <label key={row.campaign.id} className="admin-users-campaign-access__row">
                  <span>
                    <span className="admin-users-campaign-access__campaign">
                      {row.campaign.name}
                    </span>
                    <span className="admin-users-campaign-access__meta">
                      {row.campaign.year} · {row.campaign.status}
                    </span>
                  </span>
                  <select
                    className="form-select"
                    value={draftCampaignRoles[row.campaign.id] ?? ''}
                    disabled={isSaving || isSavingAccess}
                    onChange={(event) =>
                      setDraftCampaignRoles((currentValue) => ({
                        ...currentValue,
                        [row.campaign.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">No access</option>
                    {campaignRoleCatalog.map((role) => (
                      <option key={role.roleKey} value={role.roleKey}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <div className="admin-users-drawer__actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSaving || isSavingAccess || isLoadingAccess || !campaignAccessChanged}
              onClick={() => void handleSaveCampaignAccess()}
            >
              <i className="bi bi-key me-2" aria-hidden="true" />
              {isSavingAccess ? 'Saving...' : 'Save Campaign Access'}
            </button>
          </div>
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
          <button
            type="button"
            className="btn btn-primary"
            disabled={isSaving || selectedRole === user.roleKey || !selectedRole}
            onClick={() => onUpdateRole(user.id, selectedRole)}
          >
            <i className="bi bi-shield-check me-2" aria-hidden="true" />
            {isSaving ? 'Saving...' : 'Save App Access'}
          </button>
          {user.latestInvitation?.status === 'pending' ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSaving}
              onClick={() => onResendInvite(user.latestInvitation!.id)}
            >
              <i className="bi bi-send me-2" aria-hidden="true" />
              {isSaving ? 'Sending...' : 'Resend Invite'}
            </button>
          ) : null}
          {!user.isActive ? (
            <button
              type="button"
              className="btn btn-outline-danger"
              disabled={isSaving}
              onClick={() => onRequestDelete(user)}
            >
              <i className="bi bi-trash3 me-2" aria-hidden="true" />
              Delete User
            </button>
          ) : null}
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg me-2" aria-hidden="true" />
            Close
          </button>
        </div>
      </div>
    </AdminWorkspaceDrawer>
  );
}
