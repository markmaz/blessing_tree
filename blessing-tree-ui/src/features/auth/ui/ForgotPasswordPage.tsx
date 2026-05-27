import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '@/shared/api/authApi';
import { routes } from '@/app/routes';
import './AuthPages.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setIsLoading(true);
    setMessage(null);
    setError(null);
    try {
      await requestPasswordReset(email);
      setMessage('If that email is active, password reset instructions will be sent.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send reset instructions.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-form-panel">
        <div className="auth-form-content">
          <div className="auth-header">
            <h1 className="auth-title">Reset Password</h1>
            <p className="auth-subtitle">Enter your account email.</p>
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
              <label htmlFor="forgot-email" className="form-label">
                Email
              </label>
              <input
                id="forgot-email"
                className="form-control"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-100 mb-3" disabled={isLoading || !email.trim()}>
              <i className="bi bi-envelope me-2" aria-hidden="true" />
              {isLoading ? 'Sending...' : 'Send Reset Link'}
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
