/**
 * App Component
 * Main application router and provider setup.
 */

import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppFeaturesProvider } from '@/features/admin/model/appFeaturesContext';
import { AuthProvider } from '@/features/auth/model/authContext';
import { ForgotPasswordPage } from '@/features/auth/ui/ForgotPasswordPage';
import { InviteAcceptPage } from '@/features/auth/ui/InviteAcceptPage';
import { LoginPage } from '@/features/auth/ui/LoginPage';
import { ResetPasswordPage } from '@/features/auth/ui/ResetPasswordPage';
import { CampaignProvider, useCampaigns } from '@/features/campaigns/model/campaignContext';
import {
  campaignCapabilities,
  giftOperationsCapabilities,
  hasAnyCampaignCapability,
  hasCampaignCapability,
} from '@/features/campaigns/model/campaignPermissions';
import { AccountProfilePage } from '@/pages/AccountProfilePage';
import { AccountSettingsPage } from '@/pages/AccountSettingsPage';
import { AdminCapabilitiesPage } from '@/pages/AdminCapabilitiesPage';
import { AdminActivityLogPage } from '@/pages/AdminActivityLogPage';
import { AdminAskReviewPage } from '@/pages/AdminAskReviewPage';
import { AdminCampaignOperationsPage } from '@/pages/AdminCampaignOperationsPage';
import { AdminHealthPage } from '@/pages/AdminHealthPage';
import { AdminLlmPage } from '@/pages/AdminLlmPage';
import { AdminOrganizationTypesPage } from '@/pages/AdminOrganizationTypesPage';
import { AdminPage } from '@/pages/AdminPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { AskBlessingTreePage } from '@/pages/AskBlessingTreePage';
import { CampaignDetailPage } from '@/pages/CampaignDetailPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { CampaignStudioPage } from '@/pages/CampaignStudioPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GiftOperationsPage } from '@/pages/GiftOperationsPage';
import { GiftPoolPage } from '@/pages/GiftPoolPage';
import { GiftSearchPage } from '@/pages/GiftSearchPage';
import { GiftWorkflowReportPage } from '@/pages/GiftWorkflowReportPage';
import { PeopleDirectoryPage } from '@/pages/PeopleDirectoryPage';
import { PeopleIntakePage } from '@/pages/PeopleIntakePage';
import { PeoplePage } from '@/pages/PeoplePage';
import { PublicGiftScanPage } from '@/pages/PublicGiftScanPage';
import { PublicSponsorSignupPage } from '@/pages/PublicSponsorSignupPage';
import { PublicSponsorVerifyPage } from '@/pages/PublicSponsorVerifyPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SponsorsDirectoryPage } from '@/pages/SponsorsDirectoryPage';
import { SponsorsIntakePage } from '@/pages/SponsorsIntakePage';
import { SponsorsPage } from '@/pages/SponsorsPage';
import { SponsorsReportsPage } from '@/pages/SponsorsReportsPage';
import { FeatureGate } from '@/shared/ui/FeatureGate';
import { ProtectedRoute } from '@/shared/ui/ProtectedRoute';
import { AppLayout } from '@/shared/ui/layout/AppLayout';
import { buildCampaignPeopleReportsPath, routes } from './routes';

const CampaignSponsorFlyerPage = lazy(() =>
  import('@/pages/CampaignSponsorFlyerPage').then((module) => ({
    default: module.CampaignSponsorFlyerPage,
  }))
);

const GiftTagBuilderPage = lazy(() =>
  import('@/pages/GiftTagBuilderPage').then((module) => ({
    default: module.GiftTagBuilderPage,
  }))
);

export function App() {
  return (
    <AuthProvider>
      <CampaignProvider>
        <AppFeaturesProvider>
          <BrowserRouter>
            <Routes>
              <Route path={routes.LOGIN} element={<LoginPage />} />
              <Route path={routes.AUTH_REGISTER} element={<InviteAcceptPage />} />
              <Route path={routes.AUTH_FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
              <Route path={routes.AUTH_RESET_PASSWORD} element={<ResetPasswordPage />} />
              <Route path={routes.PUBLIC_CAMPAIGN_SPONSOR} element={<PublicSponsorSignupPage />} />
              <Route path={routes.PUBLIC_CAMPAIGN_SPONSOR_VERIFY} element={<PublicSponsorVerifyPage />} />
              <Route path={routes.PUBLIC_GIFT_SCAN} element={<PublicGiftScanPage />} />
              <Route path={routes.SCAN_GIFT} element={<PublicGiftScanPage />} />

              <Route
                path={routes.HOME}
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path={routes.ACCOUNT_PROFILE.slice(1)} element={<AccountProfilePage />} />
                <Route path={routes.ACCOUNT_SETTINGS.slice(1)} element={<AccountSettingsPage />} />
                <Route path={routes.CAMPAIGNS.slice(1)} element={<CampaignsPage />} />
                <Route
                  path={routes.CAMPAIGN_DETAIL.slice(1)}
                  element={
                    <CampaignCapabilityGate capability={campaignCapabilities.view}>
                      <CampaignDetailPage />
                    </CampaignCapabilityGate>
                  }
                />
                <Route
                  path={routes.CAMPAIGN_ASK.slice(1)}
                  element={
                    <CampaignCapabilityGate capability={campaignCapabilities.view}>
                      <AskBlessingTreePage />
                    </CampaignCapabilityGate>
                  }
                />
                <Route
                  path={routes.CAMPAIGN_STUDIO.slice(1)}
                  element={
                    <CampaignCapabilityGate capability={campaignCapabilities.view}>
                      <CampaignStudioPage />
                    </CampaignCapabilityGate>
                  }
                />
                <Route
                  path={routes.CAMPAIGN_SPONSOR_FLYER.slice(1)}
                  element={
                    <CampaignCapabilityGate capability={campaignCapabilities.view}>
                      <Suspense fallback={<section className="content-card"><p className="text-muted mb-0">Loading flyer builder...</p></section>}>
                        <CampaignSponsorFlyerPage />
                      </Suspense>
                    </CampaignCapabilityGate>
                  }
                />
                <Route
                  path={routes.CAMPAIGN_PEOPLE.slice(1)}
                  element={
                    <FeatureGate featureKey="people">
                      <CampaignCapabilityGate capability={campaignCapabilities.peopleView}>
                        <PeoplePage />
                      </CampaignCapabilityGate>
                    </FeatureGate>
                  }
                >
                  <Route index element={<Navigate to="intake" replace />} />
                  <Route path="intake" element={<PeopleIntakePage />} />
                  <Route path="directory" element={<PeopleDirectoryPage />} />
                  <Route
                    path="reports"
                    element={
                      <FeatureGate featureKey="reports">
                        <CampaignCapabilityGate capability={campaignCapabilities.reportsView}>
                          <ReportsPage />
                        </CampaignCapabilityGate>
                      </FeatureGate>
                    }
                  />
                </Route>
                <Route
                  path={routes.CAMPAIGN_SPONSORS.slice(1)}
                  element={
                    <FeatureGate featureKey="sponsors">
                      <CampaignCapabilityGate capability={campaignCapabilities.sponsorsView}>
                        <SponsorsPage />
                      </CampaignCapabilityGate>
                    </FeatureGate>
                  }
                >
                  <Route index element={<Navigate to="intake" replace />} />
                  <Route path="intake" element={<SponsorsIntakePage />} />
                  <Route path="directory" element={<SponsorsDirectoryPage />} />
                  <Route
                    path="reports"
                    element={
                      <CampaignCapabilityGate capability={campaignCapabilities.reportsView}>
                        <SponsorsReportsPage />
                      </CampaignCapabilityGate>
                    }
                  />
                </Route>
                <Route
                  path={routes.CAMPAIGN_GIFTS_SEARCH.slice(1)}
                  element={
                    <FeatureGate featureKey="sponsors">
                      <CampaignCapabilityGate capability={campaignCapabilities.giftSearch}>
                        <GiftSearchPage />
                      </CampaignCapabilityGate>
                    </FeatureGate>
                  }
                />
                <Route
                  path={routes.CAMPAIGN_GIFTS_OPERATIONS.slice(1)}
                  element={
                    <FeatureGate featureKey="sponsors">
                      <CampaignCapabilityGate anyOf={giftOperationsCapabilities}>
                        <GiftOperationsPage />
                      </CampaignCapabilityGate>
                    </FeatureGate>
                  }
                />
                <Route
                  path={routes.CAMPAIGN_GIFTS_POOL.slice(1)}
                  element={
                    <FeatureGate featureKey="donations">
                      <CampaignCapabilityGate capability={campaignCapabilities.giftPoolManage}>
                        <GiftPoolPage />
                      </CampaignCapabilityGate>
                    </FeatureGate>
                  }
                />
                <Route
                  path={routes.CAMPAIGN_GIFTS_REPORTS.slice(1)}
                  element={
                    <FeatureGate featureKey="reports">
                      <CampaignCapabilityGate capability={campaignCapabilities.reportsView}>
                        <GiftWorkflowReportPage />
                      </CampaignCapabilityGate>
                    </FeatureGate>
                  }
                />
                <Route
                  path={routes.CAMPAIGN_GIFTS_TAG_BUILDER.slice(1)}
                  element={
                    <FeatureGate featureKey="sponsors">
                      <CampaignCapabilityGate capability={campaignCapabilities.admin}>
                        <Suspense fallback={<section className="content-card"><p className="text-muted mb-0">Loading gift tag builder...</p></section>}>
                          <GiftTagBuilderPage />
                        </Suspense>
                      </CampaignCapabilityGate>
                    </FeatureGate>
                  }
                />
                <Route
                  path={routes.REPORTS.slice(1)}
                  element={
                    <FeatureGate featureKey="reports">
                      <LegacyReportsRoute />
                    </FeatureGate>
                  }
                />
                <Route path={routes.ADMIN.slice(1)} element={<AdminPage />}>
                  <Route index element={<Navigate to={routes.ADMIN_USERS} replace />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="activity-log" element={<AdminActivityLogPage />} />
                  <Route path="ask-review" element={<AdminAskReviewPage />} />
                  <Route path="campaign-operations" element={<AdminCampaignOperationsPage />} />
                  <Route path="organization-types" element={<AdminOrganizationTypesPage />} />
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

function LegacyReportsRoute() {
  const { selectedCampaignId } = useCampaigns();
  if (selectedCampaignId) {
    return <Navigate to={buildCampaignPeopleReportsPath(selectedCampaignId)} replace />;
  }
  return <ReportsPage />;
}

function CampaignCapabilityGate({
  capability,
  anyOf,
  children,
}: {
  capability?: string;
  anyOf?: readonly string[];
  children: ReactNode;
}) {
  const { campaignId } = useParams();
  const { campaigns, isLoading, selectedCampaign, selectedCampaignId } = useCampaigns();
  const effectiveCampaignId = campaignId ?? selectedCampaignId;
  const campaign =
    campaigns.find((item) => item.id === effectiveCampaignId) ??
    (selectedCampaign?.id === effectiveCampaignId ? selectedCampaign : null);

  if (isLoading && !campaign) {
    return (
      <section className="content-card">
        <p className="text-muted mb-0">Checking campaign access...</p>
      </section>
    );
  }

  const access = campaign?.userAccess ?? null;
  const isAllowed = anyOf?.length
    ? hasAnyCampaignCapability(access, anyOf)
    : capability
      ? hasCampaignCapability(access, capability)
      : true;

  if (!access || !isAllowed) {
    return (
      <section className="content-card">
        <h1 className="h5 mb-2">Access Required</h1>
        <p className="text-muted mb-0">
          Your account does not have access to this campaign area.
        </p>
      </section>
    );
  }

  return <>{children}</>;
}
