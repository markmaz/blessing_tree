/**
 * App Component
 * Main application router and provider setup.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/model/authContext';
import { LoginPage } from '@/features/auth/ui/LoginPage';
import { OAuthCallbackPage } from '@/features/auth/ui/OAuthCallbackPage';
import { ProtectedRoute } from '@/shared/ui/ProtectedRoute';
import { AppLayout } from '@/shared/ui/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { FamiliesPage } from '@/pages/FamiliesPage';
import { DonationsPage } from '@/pages/DonationsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AdminPage } from '@/pages/AdminPage';
import { routes } from './routes';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path={routes.LOGIN} element={<LoginPage />} />
          <Route path={routes.AUTH_CALLBACK} element={<OAuthCallbackPage />} />

          {/* Protected Routes */}
          <Route
            path={routes.HOME}
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path={routes.FAMILIES.slice(1)} element={<FamiliesPage />} />
            <Route path={routes.DONATIONS.slice(1)} element={<DonationsPage />} />
            <Route path={routes.REPORTS.slice(1)} element={<ReportsPage />} />
            <Route path={routes.ADMIN.slice(1)} element={<AdminPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to={routes.HOME} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
