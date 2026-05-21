import type {
  CampaignTeamWorkspaceMember,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';
import { getCampaignTeamGlossaryEntry } from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';
import { InlineHelpPopover } from '@/shared/ui/InlineHelpPopover';

interface CampaignStudioTeamMemberTeamsSectionProps {
  member: CampaignTeamWorkspaceMember;
  canManageTeam: boolean;
  onOpenTeam: (teamId: string) => void;
  onOpenCreateTeam: () => void;
}

export function CampaignStudioTeamMemberTeamsSection({
  member,
  canManageTeam,
  onOpenTeam,
  onOpenCreateTeam,
}: CampaignStudioTeamMemberTeamsSectionProps) {
  const teamsHelp = getCampaignTeamGlossaryEntry('teams');

  return (
    <section className="campaign-team-drawer__section">
      <div className="campaign-team-drawer__section-header">
        <div>
          <h4 className="h6 mb-1">
            Team Memberships
            <InlineHelpPopover title={teamsHelp.label} body={teamsHelp.description} />
          </h4>
          <p className="text-muted mb-0">
            Team setup and membership changes are managed from the team workspace so everything
            about a team stays in one place.
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

      <div className="campaign-team-inline-list">
        {member.teams.length === 0 ? (
          <div className="campaign-studio__empty-note">
            This person is not on any teams yet.
          </div>
        ) : (
          member.teams.map((team) => (
            <article key={team.id} className="campaign-team-inline-item">
              <div>
                <strong>{team.name}</strong>
                <div className="small text-muted">
                  {team.teamRoleName ? `${team.teamRoleName} · ` : ''}
                  {team.isActive ? 'Active team' : 'Inactive team'}
                </div>
              </div>
              {canManageTeam ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => onOpenTeam(team.id)}
                >
                  Open Team
                </button>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
