import {
  toCampaignAppAccessStatusLabel,
  toCampaignMemberTypeLabel,
  toCampaignRoleLabel,
} from '@/features/campaigns/model/campaignTeamWorkspacePresentation';
import type { CampaignTeamWorkspaceMember } from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

interface CampaignStudioTeamTableProps {
  members: CampaignTeamWorkspaceMember[];
  onSelectMember: (memberId: string) => void;
}

export function CampaignStudioTeamTable({
  members,
  onSelectMember,
}: CampaignStudioTeamTableProps) {
  if (members.length === 0) {
    return (
      <div className="campaign-studio__empty-note">
        No campaign people match the current filters.
      </div>
    );
  }

  return (
    <div className="campaign-team-table-wrap">
      <table className="table campaign-team-table mb-0">
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Access</th>
            <th scope="col">Roles</th>
            <th scope="col">Teams</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr
              key={member.id}
              className="campaign-team-table__row"
              role="button"
              tabIndex={0}
              onClick={() => onSelectMember(member.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectMember(member.id);
                }
              }}
            >
              <td>
                <div className="campaign-team-table__person">
                  <strong>{member.displayName}</strong>
                  <span>{member.email ?? 'No email yet'}</span>
                </div>
              </td>
              <td>
                <div className="campaign-chip-row">
                  <span className="campaign-chip campaign-chip-muted">
                    {toCampaignAppAccessStatusLabel(member.appAccessStatus)}
                  </span>
                  {member.appUser ? (
                    <span className="campaign-chip">{member.appUser.appRole}</span>
                  ) : null}
                </div>
              </td>
              <td>
                <div className="campaign-chip-row">
                  {member.accessRoles.length === 0 ? (
                    <span className="campaign-chip campaign-chip-muted">No access roles</span>
                  ) : (
                    member.accessRoles.map((role) => (
                      <span
                        key={role.id}
                        className={`campaign-chip ${role.isActive ? '' : 'campaign-chip-muted'}`}
                      >
                        {toCampaignRoleLabel(role.roleKey)}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td>
                <div className="campaign-chip-row">
                  {member.teams.length === 0 ? (
                    <span className="campaign-chip campaign-chip-muted">No teams</span>
                  ) : (
                    member.teams.map((team) => (
                      <span
                        key={team.id}
                        className={`campaign-chip ${team.isActive ? '' : 'campaign-chip-muted'}`}
                      >
                        {team.name}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td>{toCampaignMemberTypeLabel(member.memberType)}</td>
              <td>
                <span className={member.isActive ? 'text-success' : 'text-muted'}>
                  {member.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
