/**
 * LoginPage
 * Split-layout design: form on left (warm neutral background), hero image on right.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { login } from '@/shared/api/authApi';
import { useAuth } from '@/features/auth/model/authContext';
import { routes } from '@/app/routes';
import './AuthPages.css';

interface LoginFormInputs {
  email: string;
  password: string;
  keepSignedIn: boolean;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: contextLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    mode: 'onBlur',
    defaultValues: {
      keepSignedIn: true,
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (error && error.trim()) {
      setApiError(error.trim());
    }
  }, [location.search]);

  const onSubmit = async (data: LoginFormInputs) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await login(data.email, data.password, data.keepSignedIn);
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
                    value: 8,
                    message: 'Password must be at least 8 characters',
                  },
                })}
              />
              {errors.password && (
                <div className="invalid-feedback d-block">{errors.password.message}</div>
              )}
            </div>

            <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <div className="form-check">
                <input
                  id="keep-signed-in"
                  type="checkbox"
                  className="form-check-input"
                  disabled={isLoading}
                  {...register('keepSignedIn')}
                />
                <label htmlFor="keep-signed-in" className="form-check-label">
                  Keep me signed in
                </label>
              </div>
              <Link to={routes.AUTH_FORGOT_PASSWORD} className="small">
                Forgot password?
              </Link>
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
