import { useMemo, useState } from 'react';
import type { CampaignTeamWorkspaceTeam } from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

interface CampaignStudioTeamListTableProps {
  teams: CampaignTeamWorkspaceTeam[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
}

type TeamSortKey = 'team' | 'description' | 'members' | 'status';

export function CampaignStudioTeamListTable({
  teams,
  selectedTeamId,
  onSelectTeam,
}: CampaignStudioTeamListTableProps) {
  const [sortKey, setSortKey] = useState<TeamSortKey>('team');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const handleSort = (nextKey: TeamSortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  };
  const sortedTeams = useMemo(() => {
    const sorted = [...teams];

    sorted.sort((left, right) => {
      const leftValue = getTeamSortValue(left, sortKey);
      const rightValue = getTeamSortValue(right, sortKey);

      if (leftValue < rightValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (leftValue > rightValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return left.name.localeCompare(right.name);
    });

    return sorted;
  }, [sortDirection, sortKey, teams]);

  if (teams.length === 0) {
    return <div className="campaign-studio__empty-note">No teams match the current search.</div>;
  }

  return (
    <div className="campaign-team-table-wrap">
      <table className="table campaign-team-table mb-0">
        <thead>
          <tr>
            <SortableTeamHeader
              label="Team"
              sortKey="team"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableTeamHeader
              label="Description"
              sortKey="description"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableTeamHeader
              label="Members"
              sortKey="members"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableTeamHeader
              label="Status"
              sortKey="status"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sortedTeams.map((team) => (
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
                    {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'} ·{' '}
                    {team.roles.length} {team.roles.length === 1 ? 'role' : 'roles'}
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

function SortableTeamHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: TeamSortKey;
  activeKey: TeamSortKey;
  direction: 'asc' | 'desc';
  onSort: (sortKey: TeamSortKey) => void;
}) {
  const isActive = activeKey === sortKey;
  const iconClassName = !isActive
    ? 'bi bi-arrow-down-up'
    : direction === 'asc'
      ? 'bi bi-sort-down'
      : 'bi bi-sort-up';

  return (
    <th scope="col">
      <button type="button" className="campaign-team-table__sort" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <i className={iconClassName} aria-hidden="true" />
      </button>
    </th>
  );
}

function getTeamSortValue(team: CampaignTeamWorkspaceTeam, sortKey: TeamSortKey) {
  switch (sortKey) {
    case 'description':
      return team.description?.trim() ?? '';
    case 'members':
      return team.memberCount;
    case 'status':
      return team.isActive ? 'active' : 'inactive';
    case 'team':
    default:
      return team.name;
  }
}
