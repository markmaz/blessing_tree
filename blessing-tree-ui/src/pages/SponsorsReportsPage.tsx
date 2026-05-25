import { useMemo } from 'react';
import { useSponsorWorkspaceContext } from '@/features/campaigns/model/sponsorWorkspaceContext';
import {
  formatShortDate,
  summarizeFollowUp,
  toSponsorDropOffStatusLabel,
  toSponsorStatusLabel,
} from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';

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

  return (
    <section className="campaign-page-stack">
      <div>
        <h1 className="h3 mb-1">Sponsor Reports</h1>
        <p className="text-muted mb-0">
          Campaign-level visibility into sponsor coverage, public registration flow, and delivery follow-up.
        </p>
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
