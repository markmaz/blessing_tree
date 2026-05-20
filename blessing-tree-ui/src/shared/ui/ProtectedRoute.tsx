/**
 * ProtectedRoute Component
 * Guards routes and redirects to login if not authenticated.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/authContext';
import { getToken } from '@/shared/lib/auth';
import { routes } from '@/app/routes';

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { bootstrapped, isAuthenticated } = useAuth();
  const hasToken = isAuthenticated || !!getToken();

  if (!bootstrapped) {
    return (
      <div className="d-flex min-vh-100 align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-secondary" role="status" aria-hidden="true" />
          <div className="mt-3 text-muted">Restoring session...</div>
        </div>
      </div>
    );
  }

  if (!hasToken) {
    return <Navigate to={routes.LOGIN} replace />;
  }

  return <>{children}</>;
}
