import { Link } from 'react-router-dom';
import {
  buildCampaignPeopleDirectoryPath,
  buildCampaignPeopleIntakePath,
  routes,
} from '@/app/routes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import type { CampaignPeopleWorkspaceData } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';
import { useCampaignPeopleWorkspace } from '@/features/campaigns/model/useCampaignPeopleWorkspace';
import '@/features/campaigns/ui/campaignPeople.css';

function countWishlistsByStatus(
  status: 'DRAFT' | 'READY' | 'LOCKED',
  workspace: CampaignPeopleWorkspaceData
) {
  return workspace.recipients.filter((recipient) => recipient.wishlist?.wishlistStatus === status).length;
}

export function ReportsPage() {
  const { campaigns, selectedCampaign, selectedCampaignId, isLoading: isLoadingCampaigns } = useCampaigns();
  const { workspace, isLoading, error } = useCampaignPeopleWorkspace(selectedCampaignId);

  if (isLoadingCampaigns && !selectedCampaign) {
    return <div className="content-card">Loading reports…</div>;
  }

  if (!selectedCampaignId || !selectedCampaign) {
    return (
      <section className="campaign-empty-state">
        <h1 className="h3 mb-3">Choose a campaign to view reports</h1>
        <p className="mb-4">
          Reports are tied to the currently selected campaign so intake, wishlists, and sponsorship progress stay in context.
        </p>
        <div className="d-flex justify-content-center gap-2 flex-wrap">
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

  if (isLoading && !workspace) {
    return <div className="content-card">Loading people reports…</div>;
  }

  if (!workspace) {
    return (
      <div className="alert alert-danger" role="alert">
        {error ?? 'Unable to load People reporting.'}
      </div>
    );
  }

  const readyWishlists = countWishlistsByStatus('READY', workspace);
  const draftWishlists = countWishlistsByStatus('DRAFT', workspace);
  const lockedWishlists = countWishlistsByStatus('LOCKED', workspace);
  const missingWishlists = workspace.recipients.filter((recipient) => !recipient.wishlist).length;
  const groupsWithoutPrimaryContact = workspace.groups.filter((group) => !group.primaryContact).length;
  const groupsWithPickupContacts = workspace.groups.filter((group) => group.authorizedPickupContacts.length > 0).length;
  const adultsWithDirectContact = workspace.recipients.filter(
    (recipient) =>
      recipient.recipientKind === 'ADULT' &&
      (Boolean(recipient.directEmail?.trim()) || Boolean(recipient.directPhone?.trim()))
  ).length;
  const openWishlistRecipients = workspace.recipients
    .filter((recipient) => recipient.wishlist?.items.some((item) => !item.giftWorkflow.isFullyFulfilled))
    .slice(0, 5);

  return (
    <section className="campaign-page-stack">
      <div className="campaign-hero-card">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div className="campaign-chip-row mb-3">
              <span className="campaign-chip campaign-chip-muted">{selectedCampaign.name}</span>
              <span className="campaign-chip campaign-chip-muted">{workspace.counts.householdCount} households</span>
              <span className="campaign-chip campaign-chip-muted">{workspace.counts.careFacilityCount} facilities</span>
            </div>
            <h1 className="h3 mb-1">People Reports</h1>
            <p className="text-muted mb-0">
              Track intake coverage, wishlist readiness, and coordination health for the current campaign community.
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Link to={buildCampaignPeopleIntakePath(selectedCampaignId)} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-clipboard-plus me-2" aria-hidden="true" />
              Open Intake
            </Link>
            <Link to={buildCampaignPeopleDirectoryPath(selectedCampaignId)} className="btn btn-secondary btn-sm">
              <i className="bi bi-people me-2" aria-hidden="true" />
              Open Directory
            </Link>
          </div>
        </div>
      </div>

      <div className="campaign-studio__stat-grid campaign-people-stats">
        <StatCard label="Groups" value={workspace.counts.groupCount} />
        <StatCard label="People" value={workspace.counts.recipientCount} />
        <StatCard label="Wishlists" value={workspace.counts.wishlistCount} />
        <StatCard label="Open Items" value={workspace.counts.openItemCount} />
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-4">
          <div className="content-card h-100">
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-diagram-3 text-muted" aria-hidden="true" />
              <h2 className="h5 mb-0">Group Mix</h2>
            </div>
            <ReportMetricRow label="Households" value={workspace.counts.householdCount} />
            <ReportMetricRow label="Facilities" value={workspace.counts.careFacilityCount} />
            <ReportMetricRow label="Active groups" value={workspace.counts.activeGroupCount} />
            <ReportMetricRow label="Missing primary contact" value={groupsWithoutPrimaryContact} tone={groupsWithoutPrimaryContact > 0 ? 'warn' : 'ok'} />
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="content-card h-100">
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-person-hearts text-muted" aria-hidden="true" />
              <h2 className="h5 mb-0">People Mix</h2>
            </div>
            <ReportMetricRow label="Children" value={workspace.counts.childCount} />
            <ReportMetricRow label="Adults" value={workspace.counts.adultCount} />
            <ReportMetricRow label="Adults with direct contact" value={adultsWithDirectContact} />
            <ReportMetricRow label="Groups with pickup contacts" value={groupsWithPickupContacts} />
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="content-card h-100">
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-gift text-muted" aria-hidden="true" />
              <h2 className="h5 mb-0">Wishlist Readiness</h2>
            </div>
            <ReportMetricRow label="Ready" value={readyWishlists} tone="ok" />
            <ReportMetricRow label="Draft" value={draftWishlists} tone={draftWishlists > 0 ? 'warn' : 'ok'} />
            <ReportMetricRow label="Locked" value={lockedWishlists} />
            <ReportMetricRow label="Missing wishlist" value={missingWishlists} tone={missingWishlists > 0 ? 'warn' : 'ok'} />
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="content-card h-100">
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-exclamation-diamond text-muted" aria-hidden="true" />
              <h2 className="h5 mb-0">People Still Needing Gifts</h2>
            </div>
            {openWishlistRecipients.length > 0 ? (
              <div className="campaign-report-list">
                {openWishlistRecipients.map((recipient) => {
                  const outstandingCount =
                    recipient.wishlist?.items.filter((item) => !item.giftWorkflow.isFullyFulfilled).length ?? 0;
                  return (
                    <div key={recipient.id} className="campaign-report-list__row">
                      <div>
                        <div className="campaign-report-list__title">{recipient.displayLabel}</div>
                        <div className="campaign-report-list__meta">
                          {recipient.group?.groupName ?? 'No group'} · {recipient.programType}
                        </div>
                      </div>
                      <div className="campaign-report-list__count">{outstandingCount} open</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted mb-0">All visible wishlist items are fully fulfilled right now.</p>
            )}
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="content-card h-100">
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-chat-dots text-muted" aria-hidden="true" />
              <h2 className="h5 mb-0">Communication Notes</h2>
            </div>
            <ul className="campaign-report-bullets mb-0">
              <li>Household messages now target parents and guardians through household contacts.</li>
              <li>Facility messages stay separate from direct adult-recipient outreach.</li>
              <li>Primary contact audiences are now resolved from People groups instead of older family-only assumptions.</li>
              <li>Use Communications in Campaign Studio for recipient-aware templates and schedule placement.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="campaign-studio__stat-card">
      <span className="campaign-studio__stat-label">{label}</span>
      <strong className="campaign-studio__stat-value">{value}</strong>
    </article>
  );
}

function ReportMetricRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  return (
    <div className="campaign-report-metric">
      <span className="campaign-report-metric__label">{label}</span>
      <span className={`campaign-report-metric__value is-${tone}`}>{value}</span>
    </div>
  );
}
