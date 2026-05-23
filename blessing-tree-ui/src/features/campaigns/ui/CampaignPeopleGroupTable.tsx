import { Fragment, useMemo, useState } from 'react';
import {
  formatShortDate,
  toGroupContactRoleLabel,
  toRecipientProgramTypeLabel,
  toRecipientGroupStatusLabel,
  toRecipientGroupTypeLabel,
  toRecipientStatusLabel,
} from '@/features/campaigns/model/campaignPeopleWorkspacePresentation';
import type { CampaignPeopleGroup } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

interface CampaignPeopleGroupTableProps {
  groups: CampaignPeopleGroup[];
  canEdit: boolean;
  onSelectGroup: (groupId: string) => void;
  onSelectRecipient: (recipientId: string) => void;
  onRequestDeleteGroup: (groupId: string) => void;
  onRequestDeleteRecipient: (recipientId: string) => void;
}

type GroupSortKey = 'group' | 'type' | 'contact' | 'people' | 'updated' | 'status';

export function CampaignPeopleGroupTable({
  groups,
  canEdit,
  onSelectGroup,
  onSelectRecipient,
  onRequestDeleteGroup,
  onRequestDeleteRecipient,
}: CampaignPeopleGroupTableProps) {
  const [sortKey, setSortKey] = useState<GroupSortKey>('group');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openGroupIds, setOpenGroupIds] = useState<Record<string, boolean>>({});

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

  const toggleOpen = (groupId: string) => {
    setOpenGroupIds((currentValue) => ({ ...currentValue, [groupId]: !currentValue[groupId] }));
  };

  if (groups.length === 0) {
    return <div className="campaign-studio__empty-note">No households or organizations match the current search.</div>;
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
              label="Last Updated"
              sortKey="updated"
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedGroups.map((group) => {
            const isOpen = !!openGroupIds[group.id];

            return (
              <Fragment key={group.id}>
                <tr className="campaign-team-table__row campaign-people-group-parent-row">
                  <td className="campaign-people-group-cell">
                    <div className="campaign-people-group-row">
                      <button
                        type="button"
                        className="campaign-people-group-row__toggle"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Collapse ${group.groupName}` : `Expand ${group.groupName}`}
                        onClick={() => toggleOpen(group.id)}
                      >
                        <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="campaign-people-group-row__link"
                        onClick={() => onSelectGroup(group.id)}
                      >
                        <span className="campaign-people-group-row__name">{group.groupName}</span>
                        <span className="campaign-people-group-row__meta">
                          {group.city && group.state ? `${group.city}, ${group.state}` : group.intakeSource ?? 'No source yet'}
                        </span>
                      </button>
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
                    </div>
                  </td>
                  <td>{formatShortDate(group.updatedAt)}</td>
                  <td>{toRecipientGroupStatusLabel(group.status)}</td>
                  <td>
                    {canEdit ? (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => onRequestDeleteGroup(group.id)}
                      >
                        <i className="bi bi-trash3" aria-hidden="true" />
                        <span className="ms-2">Delete</span>
                      </button>
                    ) : null}
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="campaign-people-group-children-row">
                    <td colSpan={7}>
                      {group.recipients.length > 0 ? (
                        <div className="campaign-people-group-children-wrap">
                          <table className="table table-sm mb-0 campaign-people-group-children-table">
                            <thead>
                              <tr>
                                <th>Member</th>
                                <th>Program</th>
                                <th>Details</th>
                                <th>Wishlist</th>
                                <th>Status</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.recipients.map((recipient) => (
                                <tr
                                  key={recipient.id}
                                  className="campaign-people-group-child-row"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => onSelectRecipient(recipient.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      onSelectRecipient(recipient.id);
                                    }
                                  }}
                                >
                                  <td>
                                    <div className="campaign-people-group-child-primary">
                                      <strong>{recipient.displayLabel}</strong>
                                      {recipient.programRecipientId ? (
                                        <span>{recipient.programRecipientId}</span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td>{toRecipientProgramTypeLabel(recipient.programType)}</td>
                                  <td>
                                    {[recipient.age !== null ? `Age ${recipient.age}` : null, recipient.facilityRoom ? `Room ${recipient.facilityRoom}` : null]
                                      .filter(Boolean)
                                      .join(' · ') || 'No extra details'}
                                  </td>
                                  <td>
                                    {recipient.wishlist
                                      ? `${recipient.wishlist.items.length} gift${recipient.wishlist.items.length === 1 ? '' : 's'}`
                                      : 'No wishlist'}
                                  </td>
                                  <td>{toRecipientStatusLabel(recipient.status)}</td>
                                  <td>
                                    {canEdit ? (
                                      <button
                                        type="button"
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          onRequestDeleteRecipient(recipient.id);
                                        }}
                                      >
                                        <i className="bi bi-trash3" aria-hidden="true" />
                                      </button>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="campaign-studio__empty-note">No people have been added to this group yet.</div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
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
    case 'updated':
      return group.updatedAt ?? '';
    case 'status':
      return toRecipientGroupStatusLabel(group.status);
    case 'group':
    default:
      return group.groupName;
  }
}
