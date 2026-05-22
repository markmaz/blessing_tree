import { useMemo, useState } from 'react';
import {
  formatShortDate,
  toGroupContactRoleLabel,
  toRecipientGroupStatusLabel,
  toRecipientGroupTypeLabel,
} from '@/features/campaigns/model/campaignPeopleWorkspacePresentation';
import type { CampaignPeopleGroup } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

interface CampaignPeopleGroupTableProps {
  groups: CampaignPeopleGroup[];
  onSelectGroup: (groupId: string) => void;
}

type GroupSortKey = 'group' | 'type' | 'contact' | 'people' | 'status';

export function CampaignPeopleGroupTable({
  groups,
  onSelectGroup,
}: CampaignPeopleGroupTableProps) {
  const [sortKey, setSortKey] = useState<GroupSortKey>('group');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedGroups = useMemo(() => {
    const sorted = [...groups];

    sorted.sort((left, right) => {
      const leftValue = getGroupSortValue(left, sortKey);
      const rightValue = getGroupSortValue(right, sortKey);

      if (leftValue < rightValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (leftValue > rightValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return left.groupName.localeCompare(right.groupName);
    });

    return sorted;
  }, [groups, sortDirection, sortKey]);

  const handleSort = (nextKey: GroupSortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((currentValue) => (currentValue === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  };

  if (groups.length === 0) {
    return <div className="campaign-studio__empty-note">No households or facilities match the current search.</div>;
  }

  return (
    <div className="campaign-team-table-wrap">
      <table className="table campaign-team-table mb-0">
        <thead>
          <tr>
            <SortableHeader
              label="Group"
              sortKey="group"
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
              label="Primary Contact"
              sortKey="contact"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="People"
              sortKey="people"
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
          {sortedGroups.map((group) => (
            <tr
              key={group.id}
              className="campaign-team-table__row"
              role="button"
              tabIndex={0}
              onClick={() => onSelectGroup(group.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectGroup(group.id);
                }
              }}
            >
              <td>
                <div className="campaign-team-table__person">
                  <strong>{group.groupName}</strong>
                  <span>
                    {group.city && group.state ? `${group.city}, ${group.state}` : group.intakeSource ?? 'No source yet'}
                  </span>
                </div>
              </td>
              <td>{toRecipientGroupTypeLabel(group.groupType)}</td>
              <td>
                {group.primaryContact ? (
                  <div className="campaign-team-table__person">
                    <strong>{[group.primaryContact.firstName, group.primaryContact.lastName].filter(Boolean).join(' ') || 'Unnamed contact'}</strong>
                    <span>
                      {toGroupContactRoleLabel(group.primaryContact.contactRole)}
                      {group.primaryContact.email ? ` · ${group.primaryContact.email}` : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted">No contact yet</span>
                )}
              </td>
              <td>
                <div className="campaign-team-table__person">
                  <strong>{group.recipientCount}</strong>
                  <span>Updated {formatShortDate(group.updatedAt)}</span>
                </div>
              </td>
              <td>{toRecipientGroupStatusLabel(group.status)}</td>
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
  sortKey: GroupSortKey;
  activeKey: GroupSortKey;
  direction: 'asc' | 'desc';
  onSort: (sortKey: GroupSortKey) => void;
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

function getGroupSortValue(group: CampaignPeopleGroup, sortKey: GroupSortKey) {
  switch (sortKey) {
    case 'type':
      return toRecipientGroupTypeLabel(group.groupType);
    case 'contact':
      return group.primaryContact
        ? `${group.primaryContact.firstName ?? ''} ${group.primaryContact.lastName ?? ''} ${group.primaryContact.email ?? ''}`.trim()
        : '';
    case 'people':
      return group.recipientCount;
    case 'status':
      return toRecipientGroupStatusLabel(group.status);
    case 'group':
    default:
      return group.groupName;
  }
}
