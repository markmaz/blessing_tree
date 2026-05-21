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
    return 'bi-arrow-down-up';
  }
  return currentSortDirection === 'asc' ? 'bi-sort-down' : 'bi-sort-up';
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
                <i
                  className={`bi ${headerArrow(sortKey, sortDirection, 'displayName')}`}
                  aria-hidden="true"
                />
              </button>
            </th>
            <th>
              <button
                type="button"
                className="admin-users-table__sort-button"
                onClick={() => onSort('email')}
              >
                <span>Email</span>
                <i
                  className={`bi ${headerArrow(sortKey, sortDirection, 'email')}`}
                  aria-hidden="true"
                />
              </button>
            </th>
            <th>
              <button
                type="button"
                className="admin-users-table__sort-button"
                onClick={() => onSort('roleLabel')}
              >
                <span>Role</span>
                <i
                  className={`bi ${headerArrow(sortKey, sortDirection, 'roleLabel')}`}
                  aria-hidden="true"
                />
              </button>
            </th>
            <th>
              <button
                type="button"
                className="admin-users-table__sort-button"
                onClick={() => onSort('statusLabel')}
              >
                <span>Status</span>
                <i
                  className={`bi ${headerArrow(sortKey, sortDirection, 'statusLabel')}`}
                  aria-hidden="true"
                />
              </button>
            </th>
            <th>
              <button
                type="button"
                className="admin-users-table__sort-button"
                onClick={() => onSort('lastActivityAt')}
              >
                <span>Last Activity</span>
                <i
                  className={`bi ${headerArrow(sortKey, sortDirection, 'lastActivityAt')}`}
                  aria-hidden="true"
                />
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
                    <i className="bi bi-person-vcard me-2" aria-hidden="true" />
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
