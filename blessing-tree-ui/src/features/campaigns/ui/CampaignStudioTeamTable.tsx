import { useMemo, useState } from 'react';
import {
  toCampaignAppAccessStatusLabel,
  toCampaignMemberTypeLabel,
  toCampaignRoleLabel,
} from '@/features/campaigns/model/campaignTeamWorkspacePresentation';
import type {
  CampaignRoleCatalogEntry,
  CampaignTeamWorkspaceMember,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

interface CampaignStudioTeamTableProps {
  members: CampaignTeamWorkspaceMember[];
  roleCatalog: CampaignRoleCatalogEntry[];
  onSelectMember: (memberId: string) => void;
}

type MemberSortKey = 'person' | 'access' | 'roles' | 'teams' | 'type' | 'status';

export function CampaignStudioTeamTable({
  members,
  roleCatalog,
  onSelectMember,
}: CampaignStudioTeamTableProps) {
  const [sortKey, setSortKey] = useState<MemberSortKey>('person');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const handleSort = (nextKey: MemberSortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  };

  const sortedMembers = useMemo(() => {
    const sorted = [...members];

    sorted.sort((left, right) => {
      const leftValue = getMemberSortValue(left, sortKey, roleCatalog);
      const rightValue = getMemberSortValue(right, sortKey, roleCatalog);

      if (leftValue < rightValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (leftValue > rightValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return left.displayName.localeCompare(right.displayName);
    });

    return sorted;
  }, [members, roleCatalog, sortDirection, sortKey]);

  if (members.length === 0) {
    return (
      <div className="campaign-studio__empty-note">
        No campaign people match the current search.
      </div>
    );
  }

  return (
    <div className="campaign-team-table-wrap">
      <table className="table campaign-team-table mb-0">
        <thead>
          <tr>
            <SortableHeader
              label="Person"
              sortKey="person"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Access"
              sortKey="access"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Roles"
              sortKey="roles"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Teams"
              sortKey="teams"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Type"
              sortKey="type"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Status"
              sortKey="status"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map((member) => (
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
                        {toCampaignRoleLabel(role.roleKey, roleCatalog)}
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

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: MemberSortKey;
  activeKey: MemberSortKey;
  direction: 'asc' | 'desc';
  onSort: (sortKey: MemberSortKey) => void;
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

function getMemberSortValue(
  member: CampaignTeamWorkspaceMember,
  sortKey: MemberSortKey,
  roleCatalog: CampaignRoleCatalogEntry[]
) {
  switch (sortKey) {
    case 'access':
      return `${toCampaignAppAccessStatusLabel(member.appAccessStatus)} ${member.appUser?.appRole ?? ''}`;
    case 'roles':
      return member.accessRoles.length === 0
        ? ''
        : member.accessRoles
            .map((role) => toCampaignRoleLabel(role.roleKey, roleCatalog))
            .sort()
            .join(', ');
    case 'teams':
      return member.teams.length === 0 ? '' : member.teams.map((team) => team.name).sort().join(', ');
    case 'type':
      return toCampaignMemberTypeLabel(member.memberType);
    case 'status':
      return member.isActive ? 'active' : 'inactive';
    case 'person':
    default:
      return `${member.displayName} ${member.email ?? ''}`.trim();
  }
}
