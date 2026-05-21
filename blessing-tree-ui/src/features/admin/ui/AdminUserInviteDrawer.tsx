import { useState } from 'react';
import type { AdminRoleCatalogItem } from '@/features/admin/model/adminTypes';
import { AdminWorkspaceDrawer } from '@/features/admin/ui/AdminWorkspaceDrawer';

interface AdminUserInviteDrawerProps {
  isOpen: boolean;
  roleCatalog: AdminRoleCatalogItem[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: { email: string; displayName: string; role: string }) => Promise<boolean>;
}

export function AdminUserInviteDrawer({
  isOpen,
  roleCatalog,
  isSaving,
  onClose,
  onSave,
}: AdminUserInviteDrawerProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState(roleCatalog[0]?.roleKey ?? 'COORDINATOR');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const didSave = await onSave({ email, displayName, role });
    if (didSave) {
      onClose();
    }
  };

  return (
    <AdminWorkspaceDrawer
      isOpen={isOpen}
      title="Invite User"
      description="Create the account shell first, then let the invited person choose how they want to authenticate."
      onClose={onClose}
    >
      <form className="admin-users-drawer__stack" onSubmit={handleSubmit}>
        <section className="admin-users-drawer__section">
          <div className="admin-users-drawer__section-header">
            <div>
              <h4 className="h6 mb-1">User Profile</h4>
              <p className="text-muted mb-0">
                This creates the user and sends the invitation email.
              </p>
            </div>
          </div>
          <div className="admin-users-form-grid">
            <label className="form-label">
              Display Name
              <input
                className="form-control"
                value={displayName}
                disabled={isSaving}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label className="form-label">
              Email
              <input
                className="form-control"
                type="email"
                value={email}
                disabled={isSaving}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="form-label admin-users-form-grid__span-2">
              Global Role
              <select
                className="form-select"
                value={role}
                disabled={isSaving}
                onChange={(event) => setRole(event.target.value)}
              >
                {roleCatalog.map((item) => (
                  <option key={item.roleKey} value={item.roleKey}>
                    {item.label}
                  </option>
                ))}
              </select>
              <div className="form-text">
                {roleCatalog.find((item) => item.roleKey === role)?.description ?? ''}
              </div>
            </label>
          </div>
        </section>
        <div className="admin-users-drawer__actions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg me-2" aria-hidden="true" />
            Cancel
          </button>
          <button type="submit" className="btn btn-secondary" disabled={isSaving}>
            <i className="bi bi-envelope-plus me-2" aria-hidden="true" />
            {isSaving ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </form>
    </AdminWorkspaceDrawer>
  );
}
