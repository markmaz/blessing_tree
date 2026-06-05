import { useMemo } from 'react';
import { useSponsorWorkspaceContext } from '@/features/campaigns/model/sponsorWorkspaceContext';
import type { CampaignSponsor } from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import {
  compareSponsorFollowUpQueue,
  formatShortDate,
  needsSponsorFollowUp,
  summarizeSponsorFollowUpQueue,
  toSponsorDropOffStatusLabel,
  toSponsorStatusLabel,
} from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';
import { ReportExportActions } from '@/features/reports/ui/ReportExportActions';
import type { ReportExportPayload } from '@/features/reports/model/reportExport';

export function SponsorsReportsPage() {
  const { workspace, pendingRegistrations, isLoading } = useSponsorWorkspaceContext();

  const dropOffSummary = useMemo(() => {
    if (!workspace) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const sponsor of workspace.sponsors) {
      counts.set(sponsor.participation.dropOffStatus, (counts.get(sponsor.participation.dropOffStatus) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
  }, [workspace]);

  const followUpQueue = useMemo(() => {
    if (!workspace) {
      return [];
    }
    return workspace.sponsors
      .filter(needsSponsorFollowUp)
      .sort(compareSponsorFollowUpQueue)
      .slice(0, 30);
  }, [workspace]);
  const followUpQueueExport = useMemo(
    () => buildSponsorFollowUpQueueExport(workspace?.campaignId ?? 'campaign', followUpQueue),
    [followUpQueue, workspace?.campaignId]
  );
  const unmetCommitmentSponsors = useMemo(() => {
    if (!workspace) {
      return [];
    }
    return workspace.sponsors
      .filter(hasUnselectedCommitment)
      .sort(compareSponsorsByName);
  }, [workspace]);
  const unmetCommitmentsExport = useMemo(
    () => buildUnmetCommitmentsExport(workspace?.campaignId ?? 'campaign', unmetCommitmentSponsors),
    [unmetCommitmentSponsors, workspace?.campaignId]
  );

  if (isLoading && !workspace) {
    return <div className="content-card">Loading sponsor reports…</div>;
  }

  if (!workspace) {
    return (
      <div className="alert alert-danger" role="alert">
        Unable to load sponsor reports.
      </div>
    );
  }

  const sponsorReportExport = {
    title: 'Sponsor Reports',
    subtitle: `Campaign ${workspace.campaignId}`,
    fileName: `sponsor-reports-${workspace.campaignId}`,
    sheets: [
      {
        name: 'Summary',
        columns: [
          { key: 'metric', label: 'Metric' },
          { key: 'value', label: 'Value' },
        ],
        rows: [
          { metric: 'Total Sponsors', value: workspace.counts.sponsorCount },
          { metric: 'Contactable', value: workspace.counts.contactableSponsorCount },
          { metric: 'Pending Public', value: workspace.counts.pendingRegistrationCount },
          { metric: 'Self-Registered', value: workspace.counts.selfRegisteredCount },
          { metric: 'Active Sponsorships', value: workspace.counts.activeSponsorshipCount },
          { metric: 'Sponsored Items', value: workspace.counts.sponsoredItemCount },
          { metric: 'Committed Sponsors Without Gifts', value: unmetCommitmentSponsors.length },
        ],
      },
      {
        name: 'Drop-off Status',
        columns: [
          { key: 'status', label: 'Status' },
          { key: 'count', label: 'Count' },
        ],
        rows: dropOffSummary.map((item) => ({
          status: toSponsorDropOffStatusLabel(item.status as typeof workspace.sponsors[number]['participation']['dropOffStatus']),
          count: item.count,
        })),
      },
      {
        name: 'Follow-up Queue',
        columns: [
          { key: 'sponsor', label: 'Sponsor' },
          { key: 'status', label: 'Status' },
          { key: 'followUp', label: 'Follow-Up' },
          { key: 'sponsoredItems', label: 'Sponsored Items' },
        ],
        rows: followUpQueue.map((sponsor) => ({
          sponsor: sponsor.displayName,
          status: toSponsorStatusLabel(sponsor.participation.status),
          followUp: summarizeSponsorFollowUpQueue(sponsor),
          sponsoredItems: sponsor.sponsoredItemCount,
        })),
      },
      buildUnmetCommitmentsSheet(unmetCommitmentSponsors),
      {
        name: 'Pending Public Registrations',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'selectedGifts', label: 'Selected Gifts' },
          { key: 'expires', label: 'Expires' },
        ],
        rows: pendingRegistrations.map((registration) => ({
          name: registration.displayName ?? registration.email,
          email: registration.email,
          selectedGifts: registration.selectedWishlistItemIds.length,
          expires: formatShortDate(registration.expiresAt),
        })),
      },
    ],
  };

  return (
    <section className="campaign-page-stack">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h1 className="h3 mb-1">Sponsor Reports</h1>
          <p className="text-muted mb-0">
            Campaign-level visibility into sponsor coverage, public registration flow, and delivery follow-up.
          </p>
        </div>
        <ReportExportActions payload={sponsorReportExport} />
      </div>

      <div className="campaign-studio__stat-grid campaign-sponsor-stats">
        <StatCard label="Total Sponsors" value={workspace.counts.sponsorCount} />
        <StatCard label="Contactable" value={workspace.counts.contactableSponsorCount} />
        <StatCard label="Pending Public" value={workspace.counts.pendingRegistrationCount} />
        <StatCard label="Self-Registered" value={workspace.counts.selfRegisteredCount} />
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <div className="content-card h-100">
            <h2 className="h5 mb-3">Drop-off Status</h2>
            {dropOffSummary.length === 0 ? (
              <div className="campaign-studio__empty-note mb-0">No sponsor participation records yet.</div>
            ) : (
              <div className="campaign-sponsor-list">
                {dropOffSummary.map((item) => (
                  <div key={item.status} className="campaign-sponsor-list__item">
                    <strong>{toSponsorDropOffStatusLabel(item.status as typeof workspace.sponsors[number]['participation']['dropOffStatus'])}</strong>
                    <span>{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="col-12 col-xl-6">
          <div className="content-card h-100">
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
              <h2 className="h5 mb-0">Follow-up Queue</h2>
              <ReportExportActions payload={followUpQueueExport} formats={['pdf', 'excel']} />
            </div>
            {followUpQueue.length === 0 ? (
              <div className="campaign-studio__empty-note mb-0">No active follow-up queue.</div>
            ) : (
              <div className="campaign-sponsor-list">
                {followUpQueue.map((sponsor) => (
                  <div key={sponsor.id} className="campaign-sponsor-list__item">
                    <div>
                      <strong>{sponsor.displayName}</strong>
                      <div className="text-muted small">
                        {toSponsorStatusLabel(sponsor.participation.status)} · {summarizeSponsorFollowUpQueue(sponsor)}
                      </div>
                    </div>
                    <span>{sponsor.sponsoredItemCount} gifts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="col-12">
          <div className="content-card">
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
              <div>
                <h2 className="h5 mb-1">Unmet Commitments</h2>
                <p className="text-muted mb-0">
                  Sponsors marked committed who have not selected or been assigned any gifts yet.
                </p>
              </div>
              <ReportExportActions payload={unmetCommitmentsExport} formats={['pdf', 'excel']} />
            </div>
            {unmetCommitmentSponsors.length === 0 ? (
              <div className="campaign-studio__empty-note mb-0">No unmet sponsor commitments.</div>
            ) : (
              <div className="campaign-sponsor-list">
                {unmetCommitmentSponsors.slice(0, 8).map((sponsor) => {
                  return (
                    <div key={sponsor.id} className="campaign-sponsor-list__item">
                      <div>
                        <strong>{sponsor.displayName}</strong>
                        <div className="text-muted small">
                          {formatSponsorContact(sponsor)} · {summarizeSponsorFollowUpQueue(sponsor)}
                        </div>
                      </div>
                      <span>No gifts selected</span>
                    </div>
                  );
                })}
                {unmetCommitmentSponsors.length > 8 ? (
                  <div className="campaign-studio__empty-note mb-0">
                    {unmetCommitmentSponsors.length - 8} more sponsor{unmetCommitmentSponsors.length - 8 === 1 ? '' : 's'} in export.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="col-12">
          <div className="content-card">
            <h2 className="h5 mb-3">Pending Public Registrations</h2>
            {pendingRegistrations.length === 0 ? (
              <div className="campaign-studio__empty-note mb-0">No pending public sponsor registrations.</div>
            ) : (
              <div className="campaign-sponsor-list">
                {pendingRegistrations.map((registration) => (
                  <div key={registration.id} className="campaign-sponsor-list__item">
                    <div>
                      <strong>{registration.displayName ?? registration.email}</strong>
                      <div className="text-muted small">
                        {registration.email} · {registration.selectedWishlistItemIds.length} selected gift{registration.selectedWishlistItemIds.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span>Expires {formatShortDate(registration.expiresAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="campaign-studio__stat-card">
      <div className="campaign-studio__stat-label">{label}</div>
      <div className="campaign-studio__stat-value">{value}</div>
    </div>
  );
}

function buildSponsorFollowUpQueueExport(
  campaignId: string,
  sponsors: CampaignSponsor[]
): ReportExportPayload {
  return {
    title: 'Sponsor Follow-up Queue',
    subtitle: `Campaign ${campaignId}`,
    fileName: `sponsor-follow-up-queue-${campaignId}`,
    sheets: [
      {
        name: 'Follow-up Queue',
        columns: [
          { key: 'sponsor', label: 'Sponsor', pdfWidthWeight: 1.5 },
          { key: 'organization', label: 'Organization', pdfWidthWeight: 1.2 },
          { key: 'email', label: 'Email', pdfWidthWeight: 1.5 },
          { key: 'phone', label: 'Phone' },
          { key: 'queueReason', label: 'Queue Reason', pdfWidthWeight: 1.5 },
          { key: 'status', label: 'Status' },
          { key: 'dropOff', label: 'Drop-off' },
          { key: 'sponsoredItems', label: 'Gifts' },
          { key: 'lastContacted', label: 'Last Contacted' },
        ],
        rows: sponsors.map((sponsor) => ({
          sponsor: sponsor.displayName,
          organization: sponsor.organizationName ?? '',
          email: sponsor.email ?? '',
          phone: sponsor.phone ?? '',
          queueReason: summarizeSponsorFollowUpQueue(sponsor),
          status: toSponsorStatusLabel(sponsor.participation.status),
          dropOff: toSponsorDropOffStatusLabel(sponsor.participation.dropOffStatus),
          sponsoredItems: sponsor.sponsoredItemCount,
          lastContacted: formatShortDate(sponsor.lastContactedAt),
        })),
      },
    ],
  };
}

function buildUnmetCommitmentsExport(
  campaignId: string,
  sponsors: CampaignSponsor[]
): ReportExportPayload {
  return {
    title: 'Sponsor Unmet Commitments',
    subtitle: `Campaign ${campaignId}`,
    fileName: `sponsor-unmet-commitments-${campaignId}`,
    sheets: [buildUnmetCommitmentsSheet(sponsors)],
  };
}

function buildUnmetCommitmentsSheet(sponsors: CampaignSponsor[]) {
  return {
    name: 'Unmet Commitments',
    columns: [
      { key: 'sponsor', label: 'Sponsor', pdfWidthWeight: 1.3 },
      { key: 'organization', label: 'Organization', pdfWidthWeight: 1.1 },
      { key: 'contact', label: 'Contact', pdfWidthWeight: 1.6 },
      { key: 'followUp', label: 'Follow-Up', pdfWidthWeight: 1.35 },
      { key: 'dropOff', label: 'Drop-off', pdfWidthWeight: 0.9 },
      { key: 'lastContacted', label: 'Last Contacted', pdfWidthWeight: 0.9 },
      { key: 'commitmentNotes', label: 'Commitment Notes', pdfWidthWeight: 1.8 },
    ],
    rows: sponsors.map((sponsor) => ({
      sponsor: sponsor.displayName,
      organization: sponsor.organizationName ?? '',
      contact: formatSponsorContact(sponsor),
      followUp: summarizeSponsorFollowUpQueue(sponsor),
      dropOff: toSponsorDropOffStatusLabel(sponsor.participation.dropOffStatus),
      lastContacted: formatShortDate(sponsor.lastContactedAt),
      commitmentNotes: sponsor.participation.notes ?? sponsor.notes ?? '',
    })),
  };
}

function hasUnselectedCommitment(sponsor: CampaignSponsor) {
  return sponsor.participation.status !== 'CANCELLED'
    && sponsor.participation.interestStatus === 'COMMITTED'
    && sponsor.sponsoredItemCount === 0;
}

function compareSponsorsByName(left: CampaignSponsor, right: CampaignSponsor) {
  return left.displayName.localeCompare(right.displayName, undefined, { numeric: true, sensitivity: 'base' });
}

function formatSponsorContact(sponsor: CampaignSponsor) {
  return [sponsor.email, sponsor.phone].filter(Boolean).join(' | ') || 'No contact details';
}
