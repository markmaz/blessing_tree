import { Link } from 'react-router-dom';
import {
  buildCampaignAskPath,
  buildCampaignStudioPath,
  routes,
} from '@/app/routes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import type { CampaignDashboardWidgets } from '@/features/campaigns/model/campaignTypes';
import { useCampaignOverview } from '@/features/campaigns/model/useCampaignOverview';
import { CampaignStatusBadge } from '@/features/campaigns/ui/CampaignStatusBadge';
import { CampaignSummaryGrid } from '@/features/campaigns/ui/CampaignSummaryGrid';

const DASHBOARD_PROMPTS = {
  popularGifts: 'Show top 5 gifts by gender.',
  sponsorRecipients: 'Show recipients sponsored by sponsor.',
  unsponsoredGifts: 'How many gifts are unsponsored?',
  population: 'How many children and adults are in this campaign?',
  giftCount: 'How many gifts are in this campaign?',
  calendarUpcoming: 'What is coming up on the campaign calendar?',
  continue: 'Pick up where I left off.',
};

export function DashboardPage() {
  const { campaigns, isLoading, selectedCampaign, selectedCampaignId } = useCampaigns();
  const { campaign, access, summary, isLoading: isOverviewLoading, error } =
    useCampaignOverview(selectedCampaignId);

  if (isLoading && !selectedCampaign) {
    return <p className="text-muted">Loading your campaign dashboard...</p>;
  }

  if (selectedCampaignId && isOverviewLoading && (!campaign || !access || !summary)) {
    return <p className="text-muted">Loading campaign overview...</p>;
  }

  if (selectedCampaignId && error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!selectedCampaign || !campaign || !access || !summary) {
    return (
      <section className="campaign-empty-state">
        <h1 className="h3 mb-3">Choose a campaign to begin</h1>
        <p className="mb-4">
          Your dashboard now follows the currently selected campaign. Start by
          picking one from the top bar or browsing the campaign library.
        </p>
        <div className="d-flex justify-content-center gap-2">
          <Link to={routes.CAMPAIGNS} className="btn btn-secondary btn-sm">
            <i className="bi bi-collection me-2" aria-hidden="true" />
            Browse Campaigns
          </Link>
          <div className="campaign-chip campaign-chip-muted align-self-center">
            {campaigns.length} accessible campaign{campaigns.length === 1 ? '' : 's'}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="campaign-hero-card mb-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <h1 className="h3 mb-0">{campaign.name}</h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="text-muted mb-3">
              {campaign.description || 'This campaign is ready for setup details.'}
            </p>
            <div className="campaign-chip-row">
              <span className="campaign-chip campaign-chip-muted">
                Season {campaign.year}
              </span>
              {access.roleKeys.map((roleKey) => (
                <span key={roleKey} className="campaign-chip">
                  {roleKey}
                </span>
              ))}
            </div>
          </div>
          <Link
            to={buildCampaignStudioPath(campaign.id)}
            className="btn btn-secondary btn-sm"
          >
            <i className="bi bi-kanban me-2" aria-hidden="true" />
            Open Campaign Studio
          </Link>
        </div>
      </div>

      {isOverviewLoading ? (
        <p className="text-muted">Refreshing campaign metrics...</p>
      ) : null}

      <CampaignDashboardWidgetsSection campaignId={campaign.id} widgets={summary.widgets} />

      <div className="row g-4 mt-1">
        <div className="col-12 col-xl-8">
          <div className="campaign-surface-card">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="h5 mb-0">Current Campaign Snapshot</h2>
              <span className="text-muted small">
                {access.capabilities.length}{' '}
                {access.capabilities.length === 1 ? 'capability' : 'capabilities'}
              </span>
            </div>
            <CampaignSummaryGrid counts={summary.counts} />
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="campaign-surface-card h-100">
            <h2 className="h5 mb-3">Readiness Notes</h2>
            <ul className="list-unstyled mb-4">
              <li className="d-flex align-items-start gap-2 mb-3">
                <i className="bi bi-calendar-event text-muted" aria-hidden="true" />
                <span>Start date: {campaign.startDate || 'Not set yet'}</span>
              </li>
              <li className="d-flex align-items-start gap-2 mb-3">
                <i className="bi bi-calendar-event text-muted" aria-hidden="true" />
                <span>End date: {campaign.endDate || 'Not set yet'}</span>
              </li>
              <li className="d-flex align-items-start gap-2">
                <i className="bi bi-shield-check text-muted" aria-hidden="true" />
                <span>Global role: {access.globalAppRole}</span>
              </li>
            </ul>

            <h3 className="h6 mb-2">Enabled Capabilities</h3>
            <div className="campaign-chip-row">
              {access.capabilities.map((capability) => (
                <span key={capability} className="campaign-chip">
                  {capability}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CampaignDashboardWidgetsSection({
  campaignId,
  widgets,
}: {
  campaignId: string;
  widgets: CampaignDashboardWidgets;
}) {
  const maxPopularQuantity = Math.max(1, ...widgets.popularGiftsByGender.map((item) => item.quantity));
  const maxSponsorRecipients = Math.max(1, ...widgets.sponsorRecipientCounts.map((item) => item.recipientCount));

  return (
    <div className="dashboard-widget-grid mt-4">
      <div className="campaign-surface-card dashboard-widget-card">
        <WidgetHeader
          title="Campaign Counts"
          prompt={DASHBOARD_PROMPTS.population}
          campaignId={campaignId}
        />
        <div className="dashboard-count-grid">
          <CountTile label="Children" value={widgets.population.children} icon="bi-person-hearts" />
          <CountTile label="Adults" value={widgets.population.adults} icon="bi-person-standing" />
          <CountTile label="Gifts" value={widgets.population.gifts} icon="bi-gift" />
          <CountTile label="Unsponsored" value={widgets.population.unsponsoredGifts} icon="bi-gift-fill" tone="warning" />
        </div>
        <div className="dashboard-widget-card__prompt-links">
          <AskPromptLink campaignId={campaignId} prompt={DASHBOARD_PROMPTS.giftCount}>
            Ask for gift count
          </AskPromptLink>
          <AskPromptLink campaignId={campaignId} prompt={DASHBOARD_PROMPTS.unsponsoredGifts}>
            Ask about unsponsored gifts
          </AskPromptLink>
        </div>
      </div>

      <div className="campaign-surface-card dashboard-widget-card">
        <WidgetHeader
          title="Upcoming Calendar"
          prompt={DASHBOARD_PROMPTS.calendarUpcoming}
          campaignId={campaignId}
          badge={`${widgets.calendarUpcoming.totalCount}`}
        />
        {widgets.calendarUpcoming.items.length ? (
          <div className="dashboard-mini-list">
            {widgets.calendarUpcoming.items.map((item) => (
              <Link
                key={item.id}
                to={buildCampaignStudioPath(campaignId)}
                className="dashboard-mini-list__item dashboard-mini-list__item--action"
              >
                <div>
                  <strong>{item.title}</strong>
                  <span>{[formatShortDate(item.date), calendarUrgencyLabel(item.urgency)].filter(Boolean).join(' - ')}</span>
                </div>
                <span className={`dashboard-calendar-status dashboard-calendar-status--${calendarStatusTone(item.urgency)}`}>
                  {calendarUrgencyLabel(item.urgency)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyWidget message="No upcoming calendar items have been scheduled." />
        )}
      </div>

      <div className="campaign-surface-card dashboard-widget-card">
        <WidgetHeader
          title="Popular Gifts By Gender"
          prompt={DASHBOARD_PROMPTS.popularGifts}
          campaignId={campaignId}
        />
        {widgets.popularGiftsByGender.length ? (
          <div className="dashboard-bar-list">
            {widgets.popularGiftsByGender.map((item) => (
              <div key={`${item.gender}-${item.gift}`} className="dashboard-bar-row">
                <div className="dashboard-bar-row__label">
                  <strong>{item.gift}</strong>
                  <span>{item.gender}</span>
                </div>
                <div className="dashboard-bar-row__track" aria-hidden="true">
                  <span style={{ width: `${Math.max(8, (item.quantity / maxPopularQuantity) * 100)}%` }} />
                </div>
                <span className="dashboard-bar-row__value">{item.quantity}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyWidget message="No wishlist gifts have been entered yet." />
        )}
      </div>

      <div className="campaign-surface-card dashboard-widget-card">
        <WidgetHeader
          title="Recipients Sponsored By Sponsor"
          prompt={DASHBOARD_PROMPTS.sponsorRecipients}
          campaignId={campaignId}
        />
        {widgets.sponsorRecipientCounts.length ? (
          <div className="dashboard-bar-list">
            {widgets.sponsorRecipientCounts.map((item) => (
              <div key={item.sponsorId || item.sponsorName} className="dashboard-bar-row">
                <div className="dashboard-bar-row__label">
                  <strong>{item.sponsorName}</strong>
                  <span>{item.giftCount} gift{item.giftCount === 1 ? '' : 's'}</span>
                </div>
                <div className="dashboard-bar-row__track" aria-hidden="true">
                  <span style={{ width: `${Math.max(8, (item.recipientCount / maxSponsorRecipients) * 100)}%` }} />
                </div>
                <span className="dashboard-bar-row__value">{item.recipientCount}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyWidget message="No sponsors have committed to recipient gifts yet." />
        )}
      </div>

      <div className="campaign-surface-card dashboard-widget-card">
        <WidgetHeader
          title="Unsponsored Gifts"
          prompt={DASHBOARD_PROMPTS.unsponsoredGifts}
          campaignId={campaignId}
          badge={`${widgets.unsponsoredGifts.count}`}
        />
        {widgets.unsponsoredGifts.items.length ? (
          <div className="dashboard-mini-list">
            {widgets.unsponsoredGifts.items.map((item) => (
              <div key={item.wishlistItemId} className="dashboard-mini-list__item">
                <div>
                  <strong>{item.gift}</strong>
                  <span>{[item.recipientName, item.groupName].filter(Boolean).join(' - ')}</span>
                </div>
                {item.category ? <span className="campaign-chip campaign-chip-muted">{item.category}</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyWidget message="All open gifts are currently sponsored." />
        )}
      </div>

      <div className="campaign-surface-card dashboard-widget-card dashboard-widget-card--wide">
        <WidgetHeader
          title="Pick Up Where I Left Off"
          prompt={DASHBOARD_PROMPTS.continue}
          campaignId={campaignId}
        />
        {widgets.continueWhereLeftOff.length ? (
          <div className="dashboard-mini-list dashboard-mini-list--prompts">
            {widgets.continueWhereLeftOff.map((item) => (
              <Link
                key={item.promptLogId}
                to={askPromptPath(campaignId, item.prompt)}
                className="dashboard-mini-list__item dashboard-mini-list__item--action"
              >
                <div>
                  <strong>{item.prompt}</strong>
                  <span>{[item.title || item.resultKind, formatDateTime(item.createdAt)].filter(Boolean).join(' - ')}</span>
                </div>
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyWidget message="Ask Blessing Tree activity for your user will appear here." />
        )}
      </div>
    </div>
  );
}

function WidgetHeader({
  title,
  prompt,
  campaignId,
  badge,
}: {
  title: string;
  prompt: string;
  campaignId: string;
  badge?: string;
}) {
  return (
    <div className="dashboard-widget-card__header">
      <div>
        <h2 className="h6 mb-1">{title}</h2>
        {badge ? <span className="campaign-chip campaign-chip-muted">{badge} total</span> : null}
      </div>
      <AskPromptLink campaignId={campaignId} prompt={prompt}>
        Ask
      </AskPromptLink>
    </div>
  );
}

function CountTile({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className={`dashboard-count-tile dashboard-count-tile--${tone}`}>
      <i className={`bi ${icon}`} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AskPromptLink({
  campaignId,
  prompt,
  children,
}: {
  campaignId: string;
  prompt: string;
  children: string;
}) {
  return (
    <Link to={askPromptPath(campaignId, prompt)} className="btn btn-outline-secondary btn-sm">
      <i className="bi bi-chat-square-text me-2" aria-hidden="true" />
      {children}
    </Link>
  );
}

function EmptyWidget({ message }: { message: string }) {
  return <div className="dashboard-widget-empty">{message}</div>;
}

function askPromptPath(campaignId: string, prompt: string): string {
  return `${buildCampaignAskPath(campaignId)}?prompt=${encodeURIComponent(prompt)}`;
}

function formatDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(value: string | null): string | null {
  if (!value) {
    return 'Missing';
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function calendarUrgencyLabel(value: string): string {
  return {
    missing: 'Missing',
    overdue: 'Overdue',
    today: 'Today',
    due_soon: 'Due soon',
    upcoming: 'Upcoming',
    future: 'Future',
    complete: 'Done',
    informational: 'Info',
  }[value] ?? value;
}

function calendarStatusTone(value: string): 'danger' | 'warning' | 'default' {
  if (value === 'missing' || value === 'overdue') {
    return 'danger';
  }
  if (value === 'today' || value === 'due_soon') {
    return 'warning';
  }
  return 'default';
}
