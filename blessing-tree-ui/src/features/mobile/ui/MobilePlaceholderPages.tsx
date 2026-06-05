import { Link } from 'react-router-dom';
import {
  buildMobileGiftsPath,
  buildMobileGroupsPath,
  buildMobileReceivePath,
  buildMobileSponsorsPath,
} from '@/app/routes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import {
  campaignCapabilities,
  giftOperationsCapabilities,
  hasAnyCampaignCapability,
  hasCampaignCapability,
} from '@/features/campaigns/model/campaignPermissions';

export function MobileHomePage() {
  const { selectedCampaign } = useCampaigns();
  const access = selectedCampaign?.userAccess ?? null;
  const quickLinks = [
    {
      to: buildMobileReceivePath(),
      icon: 'bi-check2-square',
      label: 'Receive',
      detail: 'Find a recipient ID and mark gifts received.',
      isVisible: hasAnyCampaignCapability(access, giftOperationsCapabilities),
    },
    {
      to: buildMobileGiftsPath(),
      icon: 'bi-search-heart',
      label: 'Gifts',
      detail: 'Search gifts, recipients, and sponsors.',
      isVisible: hasCampaignCapability(access, campaignCapabilities.giftSearch),
    },
    {
      to: buildMobileSponsorsPath(),
      icon: 'bi-person-heart',
      label: 'Sponsors',
      detail: 'Look up sponsor commitments.',
      isVisible: hasCampaignCapability(access, campaignCapabilities.sponsorsView),
    },
    {
      to: buildMobileGroupsPath(),
      icon: 'bi-people',
      label: 'Groups',
      detail: 'Find households and organizations.',
      isVisible: hasCampaignCapability(access, campaignCapabilities.peopleView),
    },
  ].filter((link) => link.isVisible);

  return (
    <section className="mobile-page">
      <div className="mobile-page__hero">
        <span className="mobile-page__eyebrow">Operator mode</span>
        <h1>Fast lookup for the floor</h1>
        <p>
          Use the mobile tabs for gift search, recipient ID receiving, sponsor
          lookup, and household or organization lookup.
        </p>
      </div>

      <div className="mobile-quick-grid">
        {quickLinks.length > 0 ? (
          quickLinks.map((link) => (
            <MobileQuickLink
              key={link.to}
              to={link.to}
              icon={link.icon}
              label={link.label}
              detail={link.detail}
            />
          ))
        ) : (
          <div className="mobile-alert mobile-scan-notice">
            No mobile sections are available for your current campaign role.
          </div>
        )}
      </div>
    </section>
  );
}

function MobileQuickLink({
  to,
  icon,
  label,
  detail,
}: {
  to: string;
  icon: string;
  label: string;
  detail: string;
}) {
  return (
    <Link to={to} className="mobile-quick-link">
      <i className={`bi ${icon}`} aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </Link>
  );
}
