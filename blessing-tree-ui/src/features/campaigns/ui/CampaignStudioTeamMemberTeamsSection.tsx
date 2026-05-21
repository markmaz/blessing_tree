import type {
  CampaignTeamWorkspaceMember,
  CampaignTeamWorkspaceTeam,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

interface CampaignStudioTeamMemberTeamsSectionProps {
  member: CampaignTeamWorkspaceMember;
  teams: CampaignTeamWorkspaceTeam[];
  memberTeamIds: Set<string>;
  canManageTeam: boolean;
  isSaving: boolean;
  onAddMemberToTeam: (teamId: string, memberId: string) => Promise<boolean>;
  onRemoveMemberFromTeam: (teamId: string, memberId: string) => Promise<boolean>;
  onOpenCreateTeam: () => void;
}

export function CampaignStudioTeamMemberTeamsSection({
  member,
  teams,
  memberTeamIds,
  canManageTeam,
  isSaving,
  onAddMemberToTeam,
  onRemoveMemberFromTeam,
  onOpenCreateTeam,
}: CampaignStudioTeamMemberTeamsSectionProps) {
  return (
    <section className="campaign-team-drawer__section">
      <div className="campaign-team-drawer__section-header">
        <div>
          <h4 className="h6 mb-1">Teams</h4>
          <p className="text-muted mb-0">
            Teams drive communication audiences and operational groupings.
          </p>
        </div>
        {canManageTeam ? (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onOpenCreateTeam}
          >
            New Team
          </button>
        ) : null}
      </div>

      <div className="campaign-team-checkbox-list">
        {teams.length === 0 ? (
          <div className="campaign-studio__empty-note">No teams created yet.</div>
        ) : (
          teams.map((team) => {
            const isAssigned = memberTeamIds.has(team.id);
            return (
              <label key={team.id} className="campaign-team-checkbox-list__item">
                <input
                  type="checkbox"
                  checked={isAssigned}
                  disabled={!canManageTeam || isSaving}
                  onChange={(event) => {
                    if (event.target.checked) {
                      void onAddMemberToTeam(team.id, member.id);
                      return;
                    }
                    void onRemoveMemberFromTeam(team.id, member.id);
                  }}
                />
                <span>
                  <strong>{team.name}</strong>
                  <small>
                    {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                  </small>
                </span>
              </label>
            );
          })
        )}
      </div>
    </section>
  );
}
