import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  acceptInvite,
  getInviteOAuthLoginUrl,
  type InviteValidationResponse,
  validateInviteToken,
  type OAuthProvider,
} from '@/shared/api/authApi';
import { routes } from '@/app/routes';
import './AuthPages.css';

export function InviteAcceptPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [inviteStatus, setInviteStatus] = useState<InviteValidationResponse | null>(null);

  const token = useMemo(() => {
    const value = new URLSearchParams(location.search).get('token');
    return typeof value === 'string' ? value.trim() : '';
  }, [location.search]);

  useEffect(() => {
    const errorValue = new URLSearchParams(location.search).get('error');
    if (typeof errorValue === 'string' && errorValue.trim()) {
      setError(errorValue.trim());
    }
  }, [location.search]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!token) {
        setError('Invite link invalid or expired.');
        setIsValidating(false);
        return;
      }
      try {
        const invite = await validateInviteToken(token);
        if (!active) {
          return;
        }
        setInviteStatus(invite);
        setDisplayName(invite.displayName);
        setEmail(invite.email);
        if (invite.onboardingComplete) {
          setMessage('This invitation has already been accepted. Sign in with your existing account.');
        }
      } catch (validationError) {
        if (!active) {
          return;
        }
        setError(
          validationError instanceof Error
            ? validationError.message
            : 'Invite link invalid or expired.'
        );
      } finally {
        if (active) {
          setIsValidating(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const handleOAuthSelection = (provider: OAuthProvider) => {
    if (!token) {
      setError('Invite link invalid or expired.');
      return;
    }
    if (inviteStatus?.onboardingComplete) {
      setMessage('This invitation has already been accepted. Sign in with your existing account.');
      return;
    }
    setError(null);
    window.location.assign(getInviteOAuthLoginUrl(provider, token));
  };

  const submit = async () => {
    if (inviteStatus?.onboardingComplete) {
      setMessage('This invitation has already been accepted. Sign in with your existing account.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      await acceptInvite(token, { displayName, email, password });
      setMessage('Invitation accepted. You can sign in now.');
      window.setTimeout(() => navigate(routes.LOGIN), 800);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to accept invitation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-panel">
        <div className="auth-form-content">
          <div className="auth-header">
            <h1 className="auth-title">Accept Invitation</h1>
            <p className="auth-subtitle">Choose how you want to sign in to Blessing Tree.</p>
          </div>
          {error ? <div className="alert alert-danger">{error}</div> : null}
          {message ? <div className="alert alert-success">{message}</div> : null}
          {isValidating ? (
            <p className="text-muted">Validating invitation…</p>
          ) : inviteStatus?.onboardingComplete ? (
            <div className="auth-complete-panel">
              <div className="auth-complete-panel__label">Onboarding Complete</div>
              <h2 className="auth-complete-panel__title">Your account is already set up</h2>
              <p className="auth-complete-panel__body">
                Sign in with the authentication method you already connected for{' '}
                <strong>{email}</strong>.
              </p>
              <button
                type="button"
                className="btn btn-primary w-100"
                onClick={() => navigate(routes.LOGIN)}
              >
                <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true" />
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="auth-invite-summary">
                <div className="auth-invite-summary__label">Invited Account</div>
                <div className="auth-invite-summary__name">{displayName}</div>
                <div className="auth-invite-summary__email">{email}</div>
              </div>

              <div className="oauth-buttons">
                <button
                  type="button"
                  className="btn oauth-btn oauth-google-btn w-100"
                  disabled={isLoading || !token}
                  onClick={() => handleOAuthSelection('google')}
                  data-auth-method="google"
                >
                  <span className="oauth-logo-wrap" aria-hidden="true">
                    <i className="bi bi-google oauth-google-icon" />
                  </span>
                  Continue with Google
                </button>
                <button
                  type="button"
                  className="btn oauth-btn oauth-yahoo-btn w-100"
                  disabled={isLoading || !token}
                  onClick={() => handleOAuthSelection('yahoo')}
                  data-auth-method="yahoo"
                >
                  <span className="oauth-logo-wrap oauth-yahoo-logo" aria-hidden="true">
                    Y!
                  </span>
                  Continue with Yahoo
                </button>
              </div>

              <div className="auth-divider" role="separator" aria-label="or">
                <span>or set a password</span>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="invite-display-name">Display Name</label>
                <input
                  id="invite-display-name"
                  className="form-control"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="invite-email">Email</label>
                <input
                  id="invite-email"
                  className="form-control"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="invite-password">Password</label>
                <input
                  id="invite-password"
                  className="form-control"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={isLoading || !token}
                onClick={() => void submit()}
              >
                <i className="bi bi-key me-2" aria-hidden="true" />
                {isLoading ? 'Accepting…' : 'Set Password & Continue'}
              </button>
            </>
          )}
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
