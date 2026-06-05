import { Link } from 'react-router-dom';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import {
  buildMobileGiftsPath,
  buildMobileGroupsPath,
  buildMobileReceivePath,
  buildMobileSponsorsPath,
} from '@/app/routes';

type MobilePlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  primaryLabel: string;
  inputPlaceholder: string;
  upcoming: string[];
};

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

export function MobileGiftsPage() {
  return (
    <MobilePlaceholderPage
      eyebrow="Gift Search"
      title="Find gifts quickly"
      description="Search by recipient ID, recipient name, gift text, sponsor, family, or organization."
      icon="bi-search-heart"
      primaryLabel="Gift search"
      inputPlaceholder="BT-001, Batman, Rachel Morales..."
      upcoming={[
        'Mobile gift result cards',
        'Gift, recipient, and sponsor detail drawers',
        'Commit, release, and receive actions',
      ]}
    />
  );
}

export function MobileReceivePage() {
  return (
    <MobilePlaceholderPage
      eyebrow="Receive Gifts"
      title="Receive by recipient ID"
      description="Enter a recipient ID, review the wishlist, and mark received items without opening the full app."
      icon="bi-check2-square"
      primaryLabel="Recipient ID"
      inputPlaceholder="BT-001"
      upcoming={[
        'Recipient summary with age, gender, family, and program',
        'Checklist-style wishlist rows',
        'Optional note when the received item differs from the request',
      ]}
    />
  );
}

export function MobileSponsorsPage() {
  return (
    <MobilePlaceholderPage
      eyebrow="Sponsor Search"
      title="Look up sponsor commitments"
      description="Find a sponsor by name, phone, or email and view their committed gifts."
      icon="bi-person-heart"
      primaryLabel="Sponsor search"
      inputPlaceholder="Name, phone, or email"
      upcoming={[
        'Read-only sponsor contact cards',
        'Committed gift and recipient summaries',
        'Gift status visibility for each commitment',
      ]}
    />
  );
}

export function MobileGroupsPage() {
  return (
    <MobilePlaceholderPage
      eyebrow="Group Search"
      title="Find households and organizations"
      description="Search by group name, contact, program abbreviation, or recipient ID."
      icon="bi-people"
      primaryLabel="Group search"
      inputPlaceholder="Alvarez Family, OAK, BT-001..."
      upcoming={[
        'Expandable household and organization cards',
        'Recipient IDs and wishlist summaries',
        'Gift sponsor and status details',
      ]}
    />
  );
}

function MobilePlaceholderPage({
  eyebrow,
  title,
  description,
  icon,
  primaryLabel,
  inputPlaceholder,
  upcoming,
}: MobilePlaceholderPageProps) {
  const { selectedCampaign } = useCampaigns();
  const inputId = `mobile-${primaryLabel.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <section className="mobile-page">
      <div className="mobile-page__hero">
        <span className="mobile-page__eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="mobile-search-card" aria-label={`${primaryLabel} placeholder`}>
        <label className="mobile-search-card__label" htmlFor={inputId}>
          {primaryLabel}
        </label>
        <div className="mobile-search-card__input-wrap">
          <i className={`bi ${icon}`} aria-hidden="true" />
          <input
            id={inputId}
            className="mobile-search-card__input"
            type="search"
            placeholder={inputPlaceholder}
            disabled
          />
        </div>
        <p className="mobile-search-card__hint">
          This screen is ready for the next implementation phase for{' '}
          {selectedCampaign?.name ?? 'the selected campaign'}.
        </p>
      </div>

      <div className="mobile-upcoming-card">
        <span className="mobile-upcoming-card__label">Planned behavior</span>
        <ul>
          {upcoming.map((item) => (
            <li key={item}>
              <i className="bi bi-check2" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
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
