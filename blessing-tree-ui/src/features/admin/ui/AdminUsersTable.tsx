import {
  formatAdminDateTime,
  type AdminUserWorkspaceRow,
  type AdminUserWorkspaceSortDirection,
  type AdminUserWorkspaceSortKey,
} from '@/features/admin/model/adminUsersWorkspace';
import { AdminUserActionsMenu } from '@/features/admin/ui/AdminUserActionsMenu';

interface AdminUsersTableProps {
  rows: AdminUserWorkspaceRow[];
  sortKey: AdminUserWorkspaceSortKey;
  sortDirection: AdminUserWorkspaceSortDirection;
  onSort: (sortKey: AdminUserWorkspaceSortKey) => void;
  onOpenDetails: (row: AdminUserWorkspaceRow) => void;
  onResendInvite: (invitationId: string) => void;
  onUpdateStatus: (userId: string, isActive: boolean) => void;
}

function headerArrow(
  currentSortKey: AdminUserWorkspaceSortKey,
  currentSortDirection: AdminUserWorkspaceSortDirection,
  headerSortKey: AdminUserWorkspaceSortKey
) {
  if (currentSortKey !== headerSortKey) {
    return '↕';
  }
  return currentSortDirection === 'asc' ? '↑' : '↓';
}

function statusToneClass(status: AdminUserWorkspaceRow['status']) {
  if (status === 'inactive') {
    return 'is-inactive';
  }
  return status === 'invited' ? 'is-invited' : 'is-active';
}

export function AdminUsersTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
  onOpenDetails,
  onResendInvite,
  onUpdateStatus,
}: AdminUsersTableProps) {
  return (
    <div className="table-responsive">
      <table className="table admin-users-table align-middle mb-0">
        <thead>
          <tr>
            <th>
              <button
                type="button"
                className="admin-users-table__sort-button"
                onClick={() => onSort('displayName')}
              >
                <span>Name</span>
                <span aria-hidden="true">{headerArrow(sortKey, sortDirection, 'displayName')}</span>
              </button>
            </th>
            <th>
              <button
                type="button"
                className="admin-users-table__sort-button"
                onClick={() => onSort('email')}
              >
                <span>Email</span>
                <span aria-hidden="true">{headerArrow(sortKey, sortDirection, 'email')}</span>
              </button>
            </th>
            <th>
              <button
                type="button"
                className="admin-users-table__sort-button"
                onClick={() => onSort('roleLabel')}
              >
                <span>Role</span>
                <span aria-hidden="true">{headerArrow(sortKey, sortDirection, 'roleLabel')}</span>
              </button>
            </th>
            <th>
              <button
                type="button"
                className="admin-users-table__sort-button"
                onClick={() => onSort('statusLabel')}
              >
                <span>Status</span>
                <span aria-hidden="true">{headerArrow(sortKey, sortDirection, 'statusLabel')}</span>
              </button>
            </th>
            <th>
              <button
                type="button"
                className="admin-users-table__sort-button"
                onClick={() => onSort('lastActivityAt')}
              >
                <span>Last Activity</span>
                <span aria-hidden="true">{headerArrow(sortKey, sortDirection, 'lastActivityAt')}</span>
              </button>
            </th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-muted py-4">
                No users match this search.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    type="button"
                    className="admin-users-table__row-link"
                    onClick={() => onOpenDetails(row)}
                  >
                    {row.displayName}
                  </button>
                </td>
                <td>{row.email}</td>
                <td>{row.roleLabel}</td>
                <td>
                  <span className={`admin-users-status-badge ${statusToneClass(row.status)}`}>
                    {row.statusLabel}
                  </span>
                </td>
                <td>{formatAdminDateTime(row.lastActivityAt)}</td>
                <td className="text-end">
                  <AdminUserActionsMenu
                    row={row}
                    onOpenDetails={onOpenDetails}
                    onResendInvite={onResendInvite}
                    onUpdateStatus={onUpdateStatus}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
