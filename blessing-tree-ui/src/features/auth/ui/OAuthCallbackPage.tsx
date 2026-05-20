import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '@/app/routes';
import { useAuth } from '@/features/auth/model/authContext';

function readError(search: string): string | null {
  const params = new URLSearchParams(search);
  const error = params.get('error');
  return error && error.trim() ? error.trim() : null;
}

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { restoreSession } = useAuth();
  const [error, setError] = useState<string | null>(() => readError(location.search));

  useEffect(() => {
    const queryError = readError(location.search);
    if (queryError) {
      navigate(`${routes.LOGIN}?error=${encodeURIComponent(queryError)}`, { replace: true });
      return;
    }

    let cancelled = false;

    const finalizeOAuth = async () => {
      try {
        await restoreSession();
        if (!cancelled) {
          navigate(routes.HOME, { replace: true });
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'OAuth sign-in failed. Please try again.';
        setError(message);
        navigate(`${routes.LOGIN}?error=${encodeURIComponent(message)}`, { replace: true });
      }
    };

    void finalizeOAuth();

    return () => {
      cancelled = true;
    };
  }, [location.search, navigate, restoreSession]);

  return (
    <div className="d-flex min-vh-100 align-items-center justify-content-center bg-light">
      <div className="text-center">
        <div className="spinner-border text-secondary" role="status" aria-hidden="true" />
        <div className="mt-3 fw-semibold">Completing sign-in...</div>
        {error ? <div className="mt-2 text-danger small">{error}</div> : null}
      </div>
    </div>
  );
}
