/**
 * LoginPage
 * Split-layout design: form on left (warm neutral background), hero image on right.
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  fetchOAuthProviders,
  getOAuthLoginUrl,
  login,
  type OAuthProvider,
  type OAuthProviderAvailability,
} from '@/shared/api/authApi';
import { useAuth } from '@/features/auth/model/authContext';
import { routes } from '@/app/routes';
import './AuthPages.css';

interface LoginFormInputs {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: contextLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [oauthProviders, setOAuthProviders] = useState<OAuthProviderAvailability>({
    google: false,
    yahoo: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    mode: 'onBlur',
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (error && error.trim()) {
      setApiError(error.trim());
    }
  }, [location.search]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const providers = await fetchOAuthProviders();
        if (active) {
          setOAuthProviders(providers);
        }
      } catch {
        if (active) {
          setOAuthProviders({ google: false, yahoo: false });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleOAuthLogin = (provider: OAuthProvider) => {
    setApiError(null);
    window.location.assign(getOAuthLoginUrl(provider));
  };

  const onSubmit = async (data: LoginFormInputs) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await login(data.email, data.password);
      contextLogin(response.userId, response.email, response.token, response.role);
      navigate(routes.HOME);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : 'Login failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left Panel: Form */}
      <div className="auth-form-panel">
        <div className="auth-form-content">
          {/* Logo / Branding */}
          <div className="auth-header">
            <h1 className="auth-title">Blessing Tree</h1>
            <p className="auth-subtitle">Welcome back</p>
          </div>

          {/* Error Alert */}
          {apiError && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              {apiError}
              <button
                type="button"
                className="btn btn-link btn-sm text-danger p-0 ms-2 align-baseline"
                onClick={() => setApiError(null)}
                aria-label="Dismiss error"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
          )}

          {(oauthProviders.google || oauthProviders.yahoo) && (
            <>
              <div className="oauth-buttons">
                {oauthProviders.google && (
                  <button
                    type="button"
                    className="btn oauth-btn oauth-google-btn w-100"
                    onClick={() => handleOAuthLogin('google')}
                    disabled={isLoading}
                  >
                    <span className="oauth-logo-wrap" aria-hidden="true">
                      <i className="bi bi-google oauth-google-icon" />
                    </span>
                    Continue with Google
                  </button>
                )}
                {oauthProviders.yahoo && (
                  <button
                    type="button"
                    className="btn oauth-btn oauth-yahoo-btn w-100"
                    onClick={() => handleOAuthLogin('yahoo')}
                    disabled={isLoading}
                  >
                    <span className="oauth-logo-wrap oauth-yahoo-logo" aria-hidden="true">
                      Y!
                    </span>
                    Continue with Yahoo
                  </button>
                )}
              </div>

              <div className="auth-divider" role="separator" aria-label="or">
                <span>or</span>
              </div>
            </>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Username / Email
              </label>
              <input
                type="text"
                className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                id="email"
                placeholder="you@example.com"
                disabled={isLoading}
                {...register('email', {
                  required: 'Email is required',
                })}
              />
              {errors.email && (
                <div className="invalid-feedback d-block">{errors.email.message}</div>
              )}
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                id="password"
                placeholder="Enter your password"
                disabled={isLoading}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
              />
              {errors.password && (
                <div className="invalid-feedback d-block">{errors.password.message}</div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 mb-3"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                  Signing in...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials Hint */}
          <div className="auth-hint">
            <small className="text-muted">
              Sign in with your local account credentials.
            </small>
          </div>
        </div>
      </div>

      {/* Right Panel: Hero Image */}
      <div className="auth-hero-panel">
        <div className="auth-hero-placeholder">
          <img
            src="/hero.png"
            alt="Blessing Tree"
            className="auth-hero-image"
          />
          <div className="auth-hero-overlay">
            <div className="auth-hero-text">
              <p className="fs-5 fw-light">Embrace the season of grace and renewal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
