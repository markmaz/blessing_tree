/**
 * App Component
 * Main application router and provider setup.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/model/authContext';
import { AppFeaturesProvider } from '@/features/admin/model/appFeaturesContext';
import { CampaignProvider } from '@/features/campaigns/model/campaignContext';
import { LoginPage } from '@/features/auth/ui/LoginPage';
import { InviteAcceptPage } from '@/features/auth/ui/InviteAcceptPage';
import { OAuthCallbackPage } from '@/features/auth/ui/OAuthCallbackPage';
import { ProtectedRoute } from '@/shared/ui/ProtectedRoute';
import { FeatureGate } from '@/shared/ui/FeatureGate';
import { AppLayout } from '@/shared/ui/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { CampaignDetailPage } from '@/pages/CampaignDetailPage';
import { CampaignStudioPage } from '@/pages/CampaignStudioPage';
import { FamiliesPage } from '@/pages/FamiliesPage';
import { DonationsPage } from '@/pages/DonationsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AdminPage } from '@/pages/AdminPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { AdminLlmPage } from '@/pages/AdminLlmPage';
import { AdminHealthPage } from '@/pages/AdminHealthPage';
import { AdminCapabilitiesPage } from '@/pages/AdminCapabilitiesPage';
import { routes } from './routes';

export function App() {
  return (
    <AuthProvider>
      <CampaignProvider>
        <AppFeaturesProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path={routes.LOGIN} element={<LoginPage />} />
              <Route path={routes.AUTH_REGISTER} element={<InviteAcceptPage />} />
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
                <Route path={routes.CAMPAIGNS.slice(1)} element={<CampaignsPage />} />
                <Route
                  path={routes.CAMPAIGN_DETAIL.slice(1)}
                  element={<CampaignDetailPage />}
                />
                <Route
                  path={routes.CAMPAIGN_STUDIO.slice(1)}
                  element={<CampaignStudioPage />}
                />
                <Route
                  path={routes.FAMILIES.slice(1)}
                  element={
                    <FeatureGate featureKey="families">
                      <FamiliesPage />
                    </FeatureGate>
                  }
                />
                <Route
                  path={routes.DONATIONS.slice(1)}
                  element={
                    <FeatureGate featureKey="donations">
                      <DonationsPage />
                    </FeatureGate>
                  }
                />
                <Route
                  path={routes.REPORTS.slice(1)}
                  element={
                    <FeatureGate featureKey="reports">
                      <ReportsPage />
                    </FeatureGate>
                  }
                />
                <Route path={routes.ADMIN.slice(1)} element={<AdminPage />}>
                  <Route index element={<Navigate to={routes.ADMIN_USERS} replace />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="llm" element={<AdminLlmPage />} />
                  <Route path="health" element={<AdminHealthPage />} />
                  <Route path="capabilities" element={<AdminCapabilitiesPage />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to={routes.HOME} replace />} />
            </Routes>
          </BrowserRouter>
        </AppFeaturesProvider>
      </CampaignProvider>
    </AuthProvider>
  );
}
