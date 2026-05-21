import type { CampaignTeamWorkspaceTeam } from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

interface CampaignStudioTeamListTableProps {
  teams: CampaignTeamWorkspaceTeam[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
}

export function CampaignStudioTeamListTable({
  teams,
  selectedTeamId,
  onSelectTeam,
}: CampaignStudioTeamListTableProps) {
  if (teams.length === 0) {
    return <div className="campaign-studio__empty-note">No teams match the current search.</div>;
  }

  return (
    <div className="campaign-team-table-wrap">
      <table className="table campaign-team-table mb-0">
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Description</th>
            <th scope="col">Members</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr
              key={team.id}
              className={`campaign-team-table__row ${
                selectedTeamId === team.id ? 'campaign-team-table__row--selected' : ''
              }`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTeam(team.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectTeam(team.id);
                }
              }}
            >
              <td>
                <div className="campaign-team-table__person">
                  <strong>{team.name}</strong>
                  <span>
                    {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </td>
              <td className="text-muted">{team.description?.trim() || 'No description yet'}</td>
              <td>{team.memberCount}</td>
              <td>
                <span className={team.isActive ? 'text-success' : 'text-muted'}>
                  {team.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
