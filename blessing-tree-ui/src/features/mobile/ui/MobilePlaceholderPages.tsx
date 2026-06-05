import { Link } from 'react-router-dom';
import {
  buildMobileGiftsPath,
  buildMobileGroupsPath,
  buildMobileReceivePath,
  buildMobileSponsorsPath,
} from '@/app/routes';

export function MobileHomePage() {
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
        <MobileQuickLink
          to={buildMobileReceivePath()}
          icon="bi-check2-square"
          label="Receive"
          detail="Find a recipient ID and mark gifts received."
        />
        <MobileQuickLink
          to={buildMobileGiftsPath()}
          icon="bi-search-heart"
          label="Gifts"
          detail="Search gifts, recipients, and sponsors."
        />
        <MobileQuickLink
          to={buildMobileSponsorsPath()}
          icon="bi-person-heart"
          label="Sponsors"
          detail="Look up sponsor commitments."
        />
        <MobileQuickLink
          to={buildMobileGroupsPath()}
          icon="bi-people"
          label="Groups"
          detail="Find households and organizations."
        />
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
