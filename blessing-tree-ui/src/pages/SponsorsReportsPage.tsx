import { useMemo } from 'react';
import { useSponsorWorkspaceContext } from '@/features/campaigns/model/sponsorWorkspaceContext';
import {
  formatShortDate,
  summarizeFollowUp,
  toSponsorDropOffStatusLabel,
  toSponsorStatusLabel,
} from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';
import { ReportExportActions } from '@/features/reports/ui/ReportExportActions';

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
      .filter((sponsor) => sponsor.recentInteractions.some((interaction) => interaction.followUpAt))
      .slice(0, 8);
  }, [workspace]);

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
          followUp: summarizeFollowUp(sponsor.recentInteractions),
          sponsoredItems: sponsor.sponsoredItemCount,
        })),
      },
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
            <h2 className="h5 mb-3">Follow-up Queue</h2>
            {followUpQueue.length === 0 ? (
              <div className="campaign-studio__empty-note mb-0">No active follow-up queue.</div>
            ) : (
              <div className="campaign-sponsor-list">
                {followUpQueue.map((sponsor) => (
                  <div key={sponsor.id} className="campaign-sponsor-list__item">
                    <div>
                      <strong>{sponsor.displayName}</strong>
                      <div className="text-muted small">
                        {toSponsorStatusLabel(sponsor.participation.status)} · {summarizeFollowUp(sponsor.recentInteractions)}
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
