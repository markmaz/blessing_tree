import { NavLink, Outlet, Link } from 'react-router-dom';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import {
  campaignCapabilities,
  giftOperationsCapabilities,
  hasAnyCampaignCapability,
  hasCampaignCapability,
} from '@/features/campaigns/model/campaignPermissions';
import {
  buildMobileGiftsPath,
  buildMobileGroupsPath,
  buildMobileReceivePath,
  buildMobileSponsorsPath,
  routes,
} from '@/app/routes';

const FULL_SITE_PREFERENCE_KEY = 'bt-mobile-full-site';

type MobileTab = {
  label: string;
  icon: string;
  path: string;
  isVisible: boolean;
};

export function MobileShell() {
  const { isLoading, selectedCampaign } = useCampaigns();
  const access = selectedCampaign?.userAccess ?? null;

  const tabs: MobileTab[] = [
    {
      label: 'Gifts',
      icon: 'bi-search-heart',
      path: buildMobileGiftsPath(),
      isVisible: hasCampaignCapability(access, campaignCapabilities.giftSearch),
    },
    {
      label: 'Receive',
      icon: 'bi-check2-square',
      path: buildMobileReceivePath(),
      isVisible: hasAnyCampaignCapability(access, giftOperationsCapabilities),
    },
    {
      label: 'Sponsors',
      icon: 'bi-person-heart',
      path: buildMobileSponsorsPath(),
      isVisible: hasCampaignCapability(access, campaignCapabilities.sponsorsView),
    },
    {
      label: 'Groups',
      icon: 'bi-people',
      path: buildMobileGroupsPath(),
      isVisible: hasCampaignCapability(access, campaignCapabilities.peopleView),
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.isVisible);

  const handleFullSiteClick = () => {
    try {
      window.localStorage.setItem(FULL_SITE_PREFERENCE_KEY, 'true');
    } catch {
      // Ignore storage failures; the link still navigates to the full site.
    }
  };

  return (
    <div className="mobile-shell">
      <header className="mobile-shell__header">
        <div className="mobile-shell__brand">
          <img
            src="/blessing_tree_logo_transparent_v3.png"
            alt="Blessing Tree"
            className="mobile-shell__logo"
          />
          <div className="mobile-shell__brand-text">
            <span className="mobile-shell__eyebrow">Mobile</span>
            <strong>Blessing Tree</strong>
          </div>
        </div>

        <Link
          to={routes.HOME}
          className="mobile-shell__full-site"
          onClick={handleFullSiteClick}
        >
          Full site
        </Link>
      </header>

      <section className="mobile-shell__campaign" aria-live="polite">
        <span className="mobile-shell__campaign-label">Campaign</span>
        <span className="mobile-shell__campaign-name">
          {isLoading && !selectedCampaign
            ? 'Loading campaign...'
            : selectedCampaign?.name ?? 'No campaign selected'}
        </span>
      </section>

      <main className="mobile-shell__content">
        <Outlet />
      </main>

      <nav className="mobile-shell__tabs" aria-label="Mobile sections">
        {visibleTabs.length > 0 ? (
          visibleTabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `mobile-shell__tab ${isActive ? 'mobile-shell__tab--active' : ''}`
              }
            >
              <i className={`bi ${tab.icon}`} aria-hidden="true" />
              <span>{tab.label}</span>
            </NavLink>
          ))
        ) : (
          <span className="mobile-shell__tabs-empty">No mobile sections available</span>
        )}
      </nav>
    </div>
  );
}
