/**
 * App Component
 * Main application router and provider setup.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppFeaturesProvider } from '@/features/admin/model/appFeaturesContext';
import { AuthProvider } from '@/features/auth/model/authContext';
import { InviteAcceptPage } from '@/features/auth/ui/InviteAcceptPage';
import { LoginPage } from '@/features/auth/ui/LoginPage';
import { OAuthCallbackPage } from '@/features/auth/ui/OAuthCallbackPage';
import { CampaignProvider } from '@/features/campaigns/model/campaignContext';
import { AdminCapabilitiesPage } from '@/pages/AdminCapabilitiesPage';
import { AdminHealthPage } from '@/pages/AdminHealthPage';
import { AdminLlmPage } from '@/pages/AdminLlmPage';
import { AdminPage } from '@/pages/AdminPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { CampaignDetailPage } from '@/pages/CampaignDetailPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { CampaignStudioPage } from '@/pages/CampaignStudioPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DonationsPage } from '@/pages/DonationsPage';
import { PeopleDirectoryPage } from '@/pages/PeopleDirectoryPage';
import { PeopleIntakePage } from '@/pages/PeopleIntakePage';
import { PeoplePage } from '@/pages/PeoplePage';
import { ReportsPage } from '@/pages/ReportsPage';
import { FeatureGate } from '@/shared/ui/FeatureGate';
import { ProtectedRoute } from '@/shared/ui/ProtectedRoute';
import { AppLayout } from '@/shared/ui/layout/AppLayout';
import { routes } from './routes';

export function App() {
  return (
    <AuthProvider>
      <CampaignProvider>
        <AppFeaturesProvider>
          <BrowserRouter>
            <Routes>
              <Route path={routes.LOGIN} element={<LoginPage />} />
              <Route path={routes.AUTH_REGISTER} element={<InviteAcceptPage />} />
              <Route path={routes.AUTH_CALLBACK} element={<OAuthCallbackPage />} />

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
                <Route path={routes.CAMPAIGN_DETAIL.slice(1)} element={<CampaignDetailPage />} />
                <Route path={routes.CAMPAIGN_STUDIO.slice(1)} element={<CampaignStudioPage />} />
                <Route
                  path={routes.CAMPAIGN_PEOPLE.slice(1)}
                  element={
                    <FeatureGate featureKey="people">
                      <PeoplePage />
                    </FeatureGate>
                  }
                >
                  <Route index element={<Navigate to="intake" replace />} />
                  <Route path="intake" element={<PeopleIntakePage />} />
                  <Route path="directory" element={<PeopleDirectoryPage />} />
                </Route>
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

              <Route path="*" element={<Navigate to={routes.HOME} replace />} />
            </Routes>
          </BrowserRouter>
        </AppFeaturesProvider>
      </CampaignProvider>
    </AuthProvider>
  );
}
