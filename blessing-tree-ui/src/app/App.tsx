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
import { MobileAppRedirectGuard } from '@/features/mobile/ui/MobileAppRedirectGuard';
import { MobileShell } from '@/features/mobile/ui/MobileShell';
import { PublicGiftScanPage } from '@/pages/PublicGiftScanPage';
import { PublicSponsorSignupPage } from '@/pages/PublicSponsorSignupPage';
import { PublicSponsorVerifyPage } from '@/pages/PublicSponsorVerifyPage';
import { FeatureGate } from '@/shared/ui/FeatureGate';
import { ProtectedRoute } from '@/shared/ui/ProtectedRoute';
import { AppLayout } from '@/shared/ui/layout/AppLayout';
import { buildCampaignPeopleReportsPath, routes } from './routes';

const AccountProfilePage = lazy(() =>
  import('@/pages/AccountProfilePage').then((module) => ({ default: module.AccountProfilePage }))
);
const AccountSettingsPage = lazy(() =>
  import('@/pages/AccountSettingsPage').then((module) => ({ default: module.AccountSettingsPage }))
);
const AdminCapabilitiesPage = lazy(() =>
  import('@/pages/AdminCapabilitiesPage').then((module) => ({ default: module.AdminCapabilitiesPage }))
);
const AdminActivityLogPage = lazy(() =>
  import('@/pages/AdminActivityLogPage').then((module) => ({ default: module.AdminActivityLogPage }))
);
const AdminAskReviewPage = lazy(() =>
  import('@/pages/AdminAskReviewPage').then((module) => ({ default: module.AdminAskReviewPage }))
);
const AdminCampaignOperationsPage = lazy(() =>
  import('@/pages/AdminCampaignOperationsPage').then((module) => ({
    default: module.AdminCampaignOperationsPage,
  }))
);
const AdminHealthPage = lazy(() =>
  import('@/pages/AdminHealthPage').then((module) => ({ default: module.AdminHealthPage }))
);
const AdminLlmPage = lazy(() =>
  import('@/pages/AdminLlmPage').then((module) => ({ default: module.AdminLlmPage }))
);
const AdminOrganizationTypesPage = lazy(() =>
  import('@/pages/AdminOrganizationTypesPage').then((module) => ({
    default: module.AdminOrganizationTypesPage,
  }))
);
const AdminPage = lazy(() => import('@/pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const AdminUsersPage = lazy(() =>
  import('@/pages/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage }))
);
const AskBlessingTreePage = lazy(() =>
  import('@/pages/AskBlessingTreePage').then((module) => ({ default: module.AskBlessingTreePage }))
);
const CampaignDetailPage = lazy(() =>
  import('@/pages/CampaignDetailPage').then((module) => ({ default: module.CampaignDetailPage }))
);
const CampaignsPage = lazy(() =>
  import('@/pages/CampaignsPage').then((module) => ({ default: module.CampaignsPage }))
);
const CampaignStudioPage = lazy(() =>
  import('@/pages/CampaignStudioPage').then((module) => ({ default: module.CampaignStudioPage }))
);
const CampaignSponsorFlyerPage = lazy(() =>
  import('@/pages/CampaignSponsorFlyerPage').then((module) => ({
    default: module.CampaignSponsorFlyerPage,
  }))
);
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage }))
);
const GiftOperationsPage = lazy(() =>
  import('@/pages/GiftOperationsPage').then((module) => ({ default: module.GiftOperationsPage }))
);
const GiftPoolPage = lazy(() =>
  import('@/pages/GiftPoolPage').then((module) => ({ default: module.GiftPoolPage }))
);
const GiftSearchPage = lazy(() =>
  import('@/pages/GiftSearchPage').then((module) => ({ default: module.GiftSearchPage }))
);
const GiftTagBuilderPage = lazy(() =>
  import('@/pages/GiftTagBuilderPage').then((module) => ({
    default: module.GiftTagBuilderPage,
  }))
);
const GiftWorkflowReportPage = lazy(() =>
  import('@/pages/GiftWorkflowReportPage').then((module) => ({ default: module.GiftWorkflowReportPage }))
);
const MobileHomePage = lazy(() =>
  import('@/features/mobile/ui/MobilePlaceholderPages').then((module) => ({
    default: module.MobileHomePage,
  }))
);
const MobileReceivePage = lazy(() =>
  import('@/features/mobile/ui/MobileReceivePage').then((module) => ({ default: module.MobileReceivePage }))
);
const MobileScannerPage = lazy(() =>
  import('@/features/mobile/ui/MobileScannerPage').then((module) => ({ default: module.MobileScannerPage }))
);
const MobileSponsorDropoffPage = lazy(() =>
  import('@/features/mobile/ui/MobileSponsorDropoffPage').then((module) => ({
    default: module.MobileSponsorDropoffPage,
  }))
);
const MobileGiftsPage = lazy(() =>
  import('@/features/mobile/ui/MobileSearchPages').then((module) => ({ default: module.MobileGiftsPage }))
);
const MobileGroupsPage = lazy(() =>
  import('@/features/mobile/ui/MobileSearchPages').then((module) => ({ default: module.MobileGroupsPage }))
);
const MobileSponsorsPage = lazy(() =>
  import('@/features/mobile/ui/MobileSearchPages').then((module) => ({ default: module.MobileSponsorsPage }))
);
const PeopleDirectoryPage = lazy(() =>
  import('@/pages/PeopleDirectoryPage').then((module) => ({ default: module.PeopleDirectoryPage }))
);
const PeopleIntakePage = lazy(() =>
  import('@/pages/PeopleIntakePage').then((module) => ({ default: module.PeopleIntakePage }))
);
const PeoplePage = lazy(() =>
  import('@/pages/PeoplePage').then((module) => ({ default: module.PeoplePage }))
);
const ReportsPage = lazy(() =>
  import('@/pages/ReportsPage').then((module) => ({ default: module.ReportsPage }))
);
const SponsorsDirectoryPage = lazy(() =>
  import('@/pages/SponsorsDirectoryPage').then((module) => ({ default: module.SponsorsDirectoryPage }))
);
const SponsorsIntakePage = lazy(() =>
  import('@/pages/SponsorsIntakePage').then((module) => ({ default: module.SponsorsIntakePage }))
);
const SponsorsPage = lazy(() =>
  import('@/pages/SponsorsPage').then((module) => ({ default: module.SponsorsPage }))
);
const SponsorsReportsPage = lazy(() =>
  import('@/pages/SponsorsReportsPage').then((module) => ({ default: module.SponsorsReportsPage }))
);

export function App() {
  return (
    <AuthProvider>
      <CampaignProvider>
        <AppFeaturesProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteLoadingState />}>
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
                path={`${routes.MOBILE}/*`}
                element={
                  <ProtectedRoute>
                    <MobileShell />
                  </ProtectedRoute>
                }
              >
                <Route index element={<MobileHomePage />} />
                <Route path="gifts" element={<MobileGiftsPage />} />
                <Route path="receive" element={<MobileReceivePage />} />
                <Route path="receive/dropoff/:token" element={<MobileSponsorDropoffPage />} />
                <Route path="scan" element={<MobileScannerPage />} />
                <Route path="sponsors" element={<MobileSponsorsPage />} />
                <Route path="groups" element={<MobileGroupsPage />} />
              </Route>

              <Route
                path={routes.HOME}
                element={
                  <ProtectedRoute>
                    <MobileAppRedirectGuard>
                      <AppLayout />
                    </MobileAppRedirectGuard>
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
                      <CampaignSponsorFlyerPage />
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
                        <GiftTagBuilderPage />
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
            </Suspense>
          </BrowserRouter>
        </AppFeaturesProvider>
      </CampaignProvider>
    </AuthProvider>
  );
}

function RouteLoadingState() {
  return (
    <section className="content-card">
      <p className="text-muted mb-0">Loading...</p>
    </section>
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
