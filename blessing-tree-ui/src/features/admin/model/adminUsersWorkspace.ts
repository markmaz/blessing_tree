import type {
  AdminInvitation,
  AdminRoleCatalogItem,
  AdminUser,
} from '@/features/admin/model/adminTypes';

export type AdminUserWorkspaceStatus = 'active' | 'invited';
export type AdminUserWorkspaceSortKey =
  | 'displayName'
  | 'email'
  | 'roleLabel'
  | 'statusLabel'
  | 'lastActivityAt';
export type AdminUserWorkspaceSortDirection = 'asc' | 'desc';

export interface AdminUserWorkspaceRow {
  id: string;
  displayName: string;
  email: string;
  roleKey: string;
  roleLabel: string;
  isActive: boolean;
  status: AdminUserWorkspaceStatus;
  statusLabel: string;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  latestInvitation: AdminInvitation | null;
}

function compareIsoDate(a: string | null, b: string | null): number {
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  return new Date(a).getTime() - new Date(b).getTime();
}

function selectLatestInvitation(
  invitations: AdminInvitation[],
  userId: string
): AdminInvitation | null {
  const matchingInvitations = invitations.filter((invitation) => invitation.userId === userId);
  if (matchingInvitations.length === 0) {
    return null;
  }
  return matchingInvitations
    .slice()
    .sort((leftInvitation, rightInvitation) =>
      compareIsoDate(rightInvitation.createdAt, leftInvitation.createdAt)
    )[0];
}

export function buildAdminUserWorkspaceRows(
  users: AdminUser[],
  invitations: AdminInvitation[],
  roleCatalog: AdminRoleCatalogItem[]
): AdminUserWorkspaceRow[] {
  const roleLabelMap = new Map(roleCatalog.map((item) => [item.roleKey, item.label]));

  return users.map((user) => {
    const latestInvitation = selectLatestInvitation(invitations, user.id);
    const isPendingInvite = latestInvitation?.status === 'pending';

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      roleKey: user.role,
      roleLabel: roleLabelMap.get(user.role) ?? user.role,
      isActive: user.isActive,
      status: isPendingInvite ? 'invited' : 'active',
      statusLabel: isPendingInvite ? 'Invited' : 'Active',
      lastActivityAt:
        user.lastLoginAt ??
        latestInvitation?.acceptedAt ??
        latestInvitation?.createdAt ??
        user.createdAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      latestInvitation,
    };
  });
}

export function filterAdminUserWorkspaceRows(
  rows: AdminUserWorkspaceRow[],
  searchTerm: string
): AdminUserWorkspaceRow[] {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  if (!normalizedSearchTerm) {
    return rows;
  }

  return rows.filter((row) => {
    return (
      row.displayName.toLowerCase().includes(normalizedSearchTerm) ||
      row.email.toLowerCase().includes(normalizedSearchTerm) ||
      row.roleLabel.toLowerCase().includes(normalizedSearchTerm) ||
      row.statusLabel.toLowerCase().includes(normalizedSearchTerm)
    );
  });
}

export function sortAdminUserWorkspaceRows(
  rows: AdminUserWorkspaceRow[],
  sortKey: AdminUserWorkspaceSortKey,
  sortDirection: AdminUserWorkspaceSortDirection
): AdminUserWorkspaceRow[] {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

  return rows.slice().sort((leftRow, rightRow) => {
    let comparison = 0;

    if (sortKey === 'lastActivityAt') {
      comparison = compareIsoDate(leftRow.lastActivityAt, rightRow.lastActivityAt);
    } else {
      const leftValue = leftRow[sortKey].toLowerCase();
      const rightValue = rightRow[sortKey].toLowerCase();
      comparison = leftValue.localeCompare(rightValue);
    }

    if (comparison !== 0) {
      return comparison * directionMultiplier;
    }

    return leftRow.displayName.localeCompare(rightRow.displayName) * directionMultiplier;
  });
}

export function formatAdminDateTime(value: string | null): string {
  if (!value) {
    return 'Never';
  }
  return new Date(value).toLocaleString();
}
