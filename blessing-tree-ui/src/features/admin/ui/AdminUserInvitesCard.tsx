import { useMemo, useState } from 'react';
import {
  createAdminInvite,
  resendAdminInvite,
} from '@/features/admin/api/adminApi';
import type {
  AdminInvitation,
  AdminRoleCatalogItem,
  AdminUser,
} from '@/features/admin/model/adminTypes';

export function AdminUserInvitesCard({
  users,
  invitations,
  roleCatalog,
  onDataChanged,
}: {
  users: AdminUser[];
  invitations: AdminInvitation[];
  roleCatalog: AdminRoleCatalogItem[];
  onDataChanged: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState(roleCatalog[0]?.roleKey ?? 'COORDINATOR');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recentInvites = useMemo(() => invitations.slice(0, 6), [invitations]);

  const handleInvite = async () => {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const result = await createAdminInvite({ email, displayName, role });
      setMessage(result.invitation.inviteUrl ? 'Invitation created and emailed.' : 'Invitation created.');
      setEmail('');
      setDisplayName('');
      await onDataChanged();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to create invitation.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResend = async (invitationId: string) => {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      await resendAdminInvite(invitationId);
      setMessage('Invitation resent.');
      await onDataChanged();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to resend invitation.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="content-card h-100">
      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h5 mb-1">Users & Invitations</h2>
          <p className="text-muted mb-0">
            Add users with the Query Forge-style invitation flow and track pending onboarding.
          </p>
        </div>
      </div>

      {message ? <div className="alert alert-success py-2">{message}</div> : null}
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="row g-3 align-items-end mb-4">
        <div className="col-12 col-md-4">
          <label className="form-label">Name</label>
          <input
            className="form-control"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Email</label>
          <input
            className="form-control"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jane@example.com"
            type="email"
          />
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label">Role</label>
          <select
            className="form-select"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {roleCatalog.map((item) => (
              <option key={item.roleKey} value={item.roleKey}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-1">
          <button
            type="button"
            className="btn btn-primary w-100"
            disabled={isSaving}
            onClick={() => void handleInvite()}
          >
            Add
          </button>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <h3 className="h6 mb-3">Current Users</h3>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted py-4">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.displayName}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <h3 className="h6 mb-3">Recent Invitations</h3>
          <div className="vstack gap-3">
            {recentInvites.length === 0 ? (
              <div className="text-muted">No invitations yet.</div>
            ) : (
              recentInvites.map((invitation) => (
                <div key={invitation.id} className="border rounded-3 p-3 bg-white">
                  <div className="d-flex align-items-center justify-content-between gap-3">
                    <div>
                      <div className="fw-semibold">{invitation.email}</div>
                      <div className="text-muted small">
                        {invitation.status} · expires {new Date(invitation.expiresAt).toLocaleString()}
                      </div>
                    </div>
                    {invitation.status === 'pending' ? (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        disabled={isSaving}
                        onClick={() => void handleResend(invitation.id)}
                      >
                        Resend
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
