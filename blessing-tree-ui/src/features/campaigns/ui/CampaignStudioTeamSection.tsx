import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import type { CampaignTeamSnapshot } from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignStudioTeamSectionProps {
  team: CampaignTeamSnapshot;
}

export function CampaignStudioTeamSection({
  team,
}: CampaignStudioTeamSectionProps) {
  const activeAssignments = team.assignments.filter((assignment) => assignment.isActive);

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Team"
        title="Campaign Operators"
        description="This section shows who is currently assigned to run the campaign and which role bundles are active."
      >
        <div className="campaign-studio__stat-grid">
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Managers</span>
            <strong>{team.counts.managerCount}</strong>
          </div>
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Active Assignments</span>
            <strong>{team.counts.activeAssignmentCount}</strong>
          </div>
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Unique Members</span>
            <strong>{team.counts.memberCount}</strong>
          </div>
        </div>

        <div className="campaign-studio__section-list mt-4">
          {activeAssignments.length === 0 ? (
            <div className="campaign-studio__empty-note">
              No active campaign assignments yet.
            </div>
          ) : (
            activeAssignments.map((assignment) => (
              <article key={assignment.id} className="campaign-studio__list-card">
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                  <div>
                    <h3 className="h6 mb-1">{assignment.user.displayName}</h3>
                    <div className="small text-muted">{assignment.user.email}</div>
                  </div>
                  <div className="campaign-chip-row">
                    <span className="campaign-chip">{assignment.roleKey}</span>
                    <span className="campaign-chip campaign-chip-muted">
                      {assignment.user.appRole}
                    </span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="campaign-studio__inline-note mt-4">
          Team assignment write APIs are live, but this frontend phase does not
          yet have a user directory/picker to add campaign members by email.
        </div>
      </CampaignStudioSectionCard>
    </div>
  );
}
