import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resetPassword, validatePasswordResetToken } from '@/shared/api/authApi';
import { routes } from '@/app/routes';
import './AuthPages.css';

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function validateToken() {
      if (!token) {
        setError('Password reset link is invalid or expired.');
        return;
      }
      try {
        const result = await validatePasswordResetToken(token);
        if (!cancelled) {
          setEmail(result.email);
        }
      } catch (validationError) {
        if (!cancelled) {
          setError(validationError instanceof Error ? validationError.message : 'Password reset link is invalid or expired.');
        }
      }
    }
    void validateToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit() {
    setError(null);
    setMessage(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword({ token, newPassword, confirmPassword });
      setMessage('Password updated. You can sign in with your new password.');
      window.setTimeout(() => navigate(routes.LOGIN), 1200);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset password.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-form-panel">
        <div className="auth-form-content">
          <div className="auth-header">
            <h1 className="auth-title">Choose Password</h1>
            <p className="auth-subtitle">{email ? `Reset password for ${email}` : 'Reset your account password.'}</p>
          </div>

          {message ? <div className="alert alert-success">{message}</div> : null}
          {error ? <div className="alert alert-danger">{error}</div> : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="mb-3">
              <label htmlFor="reset-new-password" className="form-label">
                New Password
              </label>
              <div className="input-group">
                <input
                  id="reset-new-password"
                  className="form-control"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  disabled={isLoading || !token}
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

            <div className="mb-3">
              <label htmlFor="reset-confirm-password" className="form-label">
                Confirm Password
              </label>
              <div className="input-group">
                <input
                  id="reset-confirm-password"
                  className="form-control"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  disabled={isLoading || !token}
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
              className="btn btn-primary w-100 mb-3"
              disabled={isLoading || !token || !newPassword || !confirmPassword || Boolean(message)}
            >
              <i className="bi bi-key me-2" aria-hidden="true" />
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <div className="auth-hint">
            <Link to={routes.LOGIN}>Back to sign in</Link>
          </div>
        </div>
      </div>

      <div className="auth-hero-panel">
        <div className="auth-hero-placeholder">
          <img src="/hero.png" alt="Blessing Tree" className="auth-hero-image" />
        </div>
      </div>
    </div>
  );
}
