import { useEffect, useState } from 'react';
import {
  changeAccountPassword,
  fetchAccountProfile,
  updateAccountProfile,
} from '@/features/account/api/accountApi';
import type { AccountProfile } from '@/features/account/model/accountTypes';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';

export function AccountProfilePage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const nextProfile = await fetchAccountProfile();
        if (cancelled) return;
        setProfile(nextProfile);
        setDisplayName(nextProfile.displayName);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load profile.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const nextProfile = await updateAccountProfile({ displayName });
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName);
      setSuccess('Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setIsPasswordSaving(true);
    try {
      await changeAccountPassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update password.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  if (isLoading) {
    return <div className="content-card">Loading profile...</div>;
  }

  return (
    <div className="vstack gap-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h1 className="h3 mb-1">Profile</h1>
          <p className="text-muted mb-0">
            Manage the account identity currently signed in to Blessing Tree.
          </p>
        </div>
      </div>

      {success ? (
        <AutoDismissAlert
          message={success}
          onDismiss={() => setSuccess(null)}
          variant="success"
        />
      ) : null}
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <section className="content-card h-100">
            <div className="d-flex align-items-center gap-3 mb-4">
              <span className="avatar-circle" aria-hidden="true">
                {(profile?.email ?? 'B')[0]?.toUpperCase() ?? 'B'}
              </span>
              <div>
                <h2 className="h5 mb-1">Account Identity</h2>
                <p className="text-muted mb-0">{profile?.email ?? 'Unknown account'}</p>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="account-display-name">
                Display Name
              </label>
              <input
                id="account-display-name"
                className="form-control"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>

            <dl className="row mb-0">
              <dt className="col-sm-4">Email</dt>
              <dd className="col-sm-8">{profile?.email ?? 'Unknown account'}</dd>

              <dt className="col-sm-4">Global Role</dt>
              <dd className="col-sm-8">{formatRole(profile?.role ?? null)}</dd>

              <dt className="col-sm-4">User ID</dt>
              <dd className="col-sm-8 text-break">{profile?.id ?? 'Not available'}</dd>
            </dl>

            <div className="d-flex justify-content-end mt-4">
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSaving || !displayName.trim()}
                onClick={() => void handleSave()}
              >
                <i className="bi bi-save me-2" aria-hidden="true" />
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-5">
          <section className="content-card h-100">
            <h2 className="h5 mb-3">Access</h2>
            <p className="text-muted">
              Global app access is managed by administrators from User Management.
              Campaign permissions are assigned from the campaign Team workspace.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge text-bg-light">
                <i className="bi bi-shield-check me-1" aria-hidden="true" />
                {formatRole(profile?.role ?? null)}
              </span>
              <span className="badge text-bg-light">
                <i className="bi bi-person-check me-1" aria-hidden="true" />
                {profile?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <hr className="my-4" />

            <h3 className="h6 mb-3">Change Password</h3>
            <form
              className="vstack gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handlePasswordChange();
              }}
            >
              <div>
                <label className="form-label" htmlFor="account-current-password">
                  Current Password
                </label>
                <div className="input-group">
                  <input
                    id="account-current-password"
                    className="form-control"
                    type={showCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    onClick={() => setShowCurrentPassword((value) => !value)}
                  >
                    <i className={`bi ${showCurrentPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="account-new-password">
                  New Password
                </label>
                <div className="input-group">
                  <input
                    id="account-new-password"
                    className="form-control"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    onClick={() => setShowNewPassword((value) => !value)}
                  >
                    <i className={`bi ${showNewPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="account-confirm-password">
                  Confirm Password
                </label>
                <div className="input-group">
                  <input
                    id="account-confirm-password"
                    className="form-control"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    onClick={() => setShowConfirmPassword((value) => !value)}
                  >
                    <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-outline-primary align-self-start"
                disabled={
                  isPasswordSaving ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                <i className="bi bi-key me-2" aria-hidden="true" />
                {isPasswordSaving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function formatRole(role: string | null) {
  if (!role) {
    return 'No global role';
  }

  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
