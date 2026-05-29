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
  onUpdateRole: (userId: string, role: string) => Promise<void>;
  onRequestDelete: (user: AdminUserWorkspaceRow) => void;
}

interface ScreenAccessItem {
  roleKey: string;
  label: string;
  description: string;
}

interface ScreenAccessGroup {
  key: string;
  label: string;
  icon: string;
  items: ScreenAccessItem[];
}

const screenAccessGroups: ScreenAccessGroup[] = [
  {
    key: 'campaigns',
    label: 'Campaigns',
    icon: 'bi-stars',
    items: [
      {
        roleKey: 'CAMPAIGN_OVERVIEW',
        label: 'Overview',
        description: 'Campaign dashboard, readiness, and high-level activity.',
      },
      {
        roleKey: 'CAMPAIGN_STUDIO',
        label: 'Studio',
        description: 'Campaign setup, schedule, rules, and communications.',
      },
      {
        roleKey: 'CAMPAIGN_FLYER_BUILDER',
        label: 'Flyer Builder',
        description: 'Sponsor flyer builder and flyer templates.',
      },
    ],
  },
  {
    key: 'ask',
    label: 'Ask Blessing Tree',
    icon: 'bi-chat-square-text',
    items: [
      {
        roleKey: 'ASK_BLESSING_TREE',
        label: 'Ask Blessing Tree',
        description: 'App help and natural language campaign reporting.',
      },
    ],
  },
  {
    key: 'people',
    label: 'People',
    icon: 'bi-people',
    items: [
      {
        roleKey: 'PEOPLE_INTAKE',
        label: 'Intake',
        description: 'Create and update families, organizations, people, and wishlists.',
      },
      {
        roleKey: 'PEOPLE_DIRECTORY',
        label: 'Directory',
        description: 'View and search people, families, organizations, and wishlists.',
      },
      {
        roleKey: 'PEOPLE_REPORTS',
        label: 'Reports',
        description: 'People-focused campaign reports.',
      },
    ],
  },
  {
    key: 'sponsors',
    label: 'Sponsors',
    icon: 'bi-award',
    items: [
      {
        roleKey: 'SPONSORS_INTAKE',
        label: 'Intake',
        description: 'Create and update sponsor intake records.',
      },
      {
        roleKey: 'SPONSORS_DIRECTORY',
        label: 'Directory',
        description: 'View and search sponsors.',
      },
      {
        roleKey: 'SPONSORS_REPORTS',
        label: 'Reports',
        description: 'Sponsor-focused campaign reports.',
      },
    ],
  },
  {
    key: 'gifts',
    label: 'Gifts',
    icon: 'bi-gift',
    items: [
      {
        roleKey: 'GIFTS_SEARCH',
        label: 'Search',
        description: 'Search and commit available gifts.',
      },
      {
        roleKey: 'GIFTS_OPERATIONS',
        label: 'Operations',
        description: 'Receive, wrap, tag, and distribute gifts.',
      },
      {
        roleKey: 'GIFTS_POOL',
        label: 'Gift Pool',
        description: 'Manage donated gifts and matching pool items.',
      },
      {
        roleKey: 'GIFTS_STATUS',
        label: 'Gift Status',
        description: 'Gift status reporting.',
      },
      {
        roleKey: 'GIFTS_TAG_BUILDER',
        label: 'Gift Tag Builder',
        description: 'Design and manage campaign gift tag templates.',
      },
    ],
  },
];

const screenRoleKeys = new Set(screenAccessGroups.flatMap((group) => group.items.map((item) => item.roleKey)));

const legacyRoleExpansions: Record<string, string[]> = {
  CAMPAIGN_MANAGER: Array.from(screenRoleKeys),
  CAMPAIGN_VIEWER: ['CAMPAIGN_OVERVIEW', 'ASK_BLESSING_TREE'],
  PEOPLE_MANAGER: ['PEOPLE_INTAKE', 'PEOPLE_DIRECTORY', 'PEOPLE_REPORTS'],
  SPONSOR_MANAGER: ['SPONSORS_INTAKE', 'SPONSORS_DIRECTORY', 'SPONSORS_REPORTS'],
  GIFT_OPERATIONS: ['GIFTS_SEARCH', 'GIFTS_OPERATIONS', 'GIFTS_POOL', 'GIFTS_STATUS', 'GIFTS_TAG_BUILDER'],
  GIFT_SEARCH_USER: ['GIFTS_SEARCH'],
  REPORTS_VIEWER: ['PEOPLE_REPORTS', 'SPONSORS_REPORTS', 'GIFTS_STATUS'],
};

function statusToneClass(status: AdminUserWorkspaceRow['status']) {
  if (status === 'inactive') {
    return 'is-inactive';
  }
  return status === 'invited' ? 'is-invited' : 'is-active';
}

function campaignStatusToneClass(status: string) {
  const normalizedStatus = status.toUpperCase();
  if (normalizedStatus === 'ACTIVE') {
    return 'is-active';
  }
  if (normalizedStatus === 'DRAFT') {
    return 'is-invited';
  }
  return 'is-inactive';
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
  const [savedRole, setSavedRole] = useState(user?.roleKey ?? '');
  const [campaignAccessRows, setCampaignAccessRows] = useState<
    Array<{
      campaign: { id: string; name: string; year: number; status: string };
      roleKeys: string[];
      capabilities: string[];
    }>
  >([]);
  const [campaignRoleCatalog, setCampaignRoleCatalog] = useState<AdminRoleCatalogItem[]>([]);
  const [draftCampaignRoles, setDraftCampaignRoles] = useState<Record<string, string[]>>({});
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<Set<string>>(new Set());
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const selectedUserId = user?.id;

  useEffect(() => {
    setSelectedRole(user?.roleKey ?? '');
    setSavedRole(user?.roleKey ?? '');
  }, [user?.roleKey]);

  useEffect(() => {
    if (!isOpen || !selectedUserId) {
      setCampaignAccessRows([]);
      setCampaignRoleCatalog([]);
      setDraftCampaignRoles({});
      setExpandedCampaignIds(new Set());
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
        setExpandedCampaignIds(
          new Set(payload.campaigns.filter((row) => isActiveCampaign(row.campaign.status)).map((row) => row.campaign.id))
        );
        setDraftCampaignRoles(
          Object.fromEntries(
            payload.campaigns.map((row) => [row.campaign.id, normalizeScreenRoleKeys(row.roleKeys)])
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
    (row) => !sameRoleKeys(draftCampaignRoles[row.campaign.id] ?? [], normalizeScreenRoleKeys(row.roleKeys))
  );
  const appAccessChanged = selectedRole !== savedRole;
  const userAccessChanged = appAccessChanged || campaignAccessChanged;
  const sortedCampaignAccessRows = [...campaignAccessRows].sort(compareCampaignAccessRows);

  const handleSaveUserAccess = async () => {
    setIsSavingAccess(true);
    setAccessError(null);
    setAccessMessage(null);
    try {
      if (appAccessChanged) {
        await onUpdateRole(user.id, selectedRole);
        setSavedRole(selectedRole);
      }
      if (campaignAccessChanged) {
        const payload = await updateAdminUserCampaignAccess(
          user.id,
          campaignAccessRows
            .map((row) => ({
              campaignId: row.campaign.id,
              roleKeys: draftCampaignRoles[row.campaign.id] ?? [],
            }))
            .filter((assignment) => assignment.roleKeys.length > 0)
        );
        setCampaignAccessRows(payload.campaigns);
        setCampaignRoleCatalog(payload.roleCatalog);
        setDraftCampaignRoles(
          Object.fromEntries(
            payload.campaigns.map((row) => [row.campaign.id, normalizeScreenRoleKeys(row.roleKeys)])
          )
        );
      }
      setAccessMessage('User access saved.');
    } catch (saveError) {
      setAccessError(saveError instanceof Error ? saveError.message : 'Unable to save user access.');
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
                Check the application areas this user should see for each campaign.
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
              {sortedCampaignAccessRows.map((row) => {
                const selectedRoleKeys = draftCampaignRoles[row.campaign.id] ?? [];
                const isExpanded = expandedCampaignIds.has(row.campaign.id);
                return (
                  <section key={row.campaign.id} className="admin-users-campaign-access__row">
                    <button
                      type="button"
                      className="admin-users-campaign-access__toggle"
                      aria-expanded={isExpanded}
                      onClick={() => {
                        setExpandedCampaignIds((currentValue) => {
                          const nextValue = new Set(currentValue);
                          if (nextValue.has(row.campaign.id)) {
                            nextValue.delete(row.campaign.id);
                          } else {
                            nextValue.add(row.campaign.id);
                          }
                          return nextValue;
                        });
                      }}
                    >
                      <span>
                        <span className="admin-users-campaign-access__campaign">
                          {row.campaign.name}
                        </span>
                        <span className="admin-users-campaign-access__meta">
                          {row.campaign.year}
                        </span>
                      </span>
                      <span className="admin-users-campaign-access__toggle-actions">
                        <span className={`admin-users-status-badge ${campaignStatusToneClass(row.campaign.status)}`}>
                          {row.campaign.status}
                        </span>
                        <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="admin-users-screen-access-groups">
                        {screenAccessGroups.map((group) => {
                          const groupRoleKeys = group.items.map((item) => item.roleKey);
                          const checkedCount = groupRoleKeys.filter((roleKey) => selectedRoleKeys.includes(roleKey)).length;
                          const isGroupChecked = checkedCount === groupRoleKeys.length;
                          const isGroupPartial = checkedCount > 0 && !isGroupChecked;
                          return (
                            <section
                              key={group.key}
                              className={`admin-users-screen-access-group ${isGroupChecked ? 'is-checked' : ''} ${
                                isGroupPartial ? 'is-partial' : ''
                              }`}
                            >
                              <label className="admin-users-screen-access-group__header">
                                <input
                                  type="checkbox"
                                  checked={isGroupChecked}
                                  disabled={isSaving || isSavingAccess}
                                  onChange={(event) => {
                                    setDraftCampaignRoles((currentValue) => ({
                                      ...currentValue,
                                      [row.campaign.id]: toggleRoleKeys(
                                        currentValue[row.campaign.id] ?? [],
                                        groupRoleKeys,
                                        event.target.checked
                                      ),
                                    }));
                                  }}
                                />
                                <span>
                                  <span className="admin-users-screen-access-group__label">
                                    <i className={`bi ${group.icon}`} aria-hidden="true" />
                                    {group.label}
                                  </span>
                                  <span className="admin-users-screen-access-group__description">
                                    {isGroupChecked
                                      ? 'All screens selected'
                                      : isGroupPartial
                                        ? `${checkedCount} of ${groupRoleKeys.length} screens selected`
                                        : 'No screens selected'}
                                  </span>
                                </span>
                              </label>
                              <div className="admin-users-screen-access-grid">
                                {group.items.map((item) => {
                                  const catalogItem = campaignRoleCatalog.find((role) => role.roleKey === item.roleKey);
                                  const checked = selectedRoleKeys.includes(item.roleKey);
                                  return (
                                    <label
                                      key={item.roleKey}
                                      className={`admin-users-screen-access-tile ${checked ? 'is-checked' : ''}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={isSaving || isSavingAccess}
                                        onChange={(event) => {
                                          setDraftCampaignRoles((currentValue) => ({
                                            ...currentValue,
                                            [row.campaign.id]: toggleRoleKey(
                                              currentValue[row.campaign.id] ?? [],
                                              item.roleKey,
                                              event.target.checked
                                            ),
                                          }));
                                        }}
                                      />
                                      <span>
                                        <span className="admin-users-screen-access-tile__label">
                                          {catalogItem?.label ?? item.label}
                                        </span>
                                        <span className="admin-users-screen-access-tile__description">
                                          {catalogItem?.description ?? item.description}
                                        </span>
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
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
            disabled={isSaving || isSavingAccess || isLoadingAccess || !selectedRole || !userAccessChanged}
            onClick={() => void handleSaveUserAccess()}
          >
            <i className="bi bi-shield-check me-2" aria-hidden="true" />
            {isSaving || isSavingAccess ? 'Saving...' : 'Save User'}
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

function toggleRoleKey(roleKeys: string[], roleKey: string, checked: boolean): string[] {
  const nextRoleKeys = checked
    ? [...roleKeys, roleKey]
    : roleKeys.filter((currentRoleKey) => currentRoleKey !== roleKey);
  return Array.from(new Set(nextRoleKeys)).sort();
}

function toggleRoleKeys(roleKeys: string[], changedRoleKeys: string[], checked: boolean): string[] {
  const changedRoleKeySet = new Set(changedRoleKeys);
  const nextRoleKeys = checked
    ? [...roleKeys, ...changedRoleKeys]
    : roleKeys.filter((roleKey) => !changedRoleKeySet.has(roleKey));
  return Array.from(new Set(nextRoleKeys)).sort();
}

function normalizeScreenRoleKeys(roleKeys: string[]): string[] {
  return Array.from(
    new Set(
      roleKeys.flatMap((roleKey) => {
        if (screenRoleKeys.has(roleKey)) {
          return [roleKey];
        }
        return legacyRoleExpansions[roleKey] ?? [];
      })
    )
  ).sort();
}

function sameRoleKeys(left: string[], right: string[]): boolean {
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((roleKey, index) => roleKey === normalizedRight[index]);
}

function isActiveCampaign(status: string): boolean {
  return status.toUpperCase() === 'ACTIVE';
}

function compareCampaignAccessRows(
  left: { campaign: { name: string; year: number; status: string } },
  right: { campaign: { name: string; year: number; status: string } }
): number {
  const activeStatusSort = Number(isActiveCampaign(right.campaign.status)) - Number(isActiveCampaign(left.campaign.status));
  if (activeStatusSort !== 0) {
    return activeStatusSort;
  }
  if (right.campaign.year !== left.campaign.year) {
    return right.campaign.year - left.campaign.year;
  }
  return left.campaign.name.localeCompare(right.campaign.name);
}
