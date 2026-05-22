import { useMemo, useState } from 'react';
import {
  toGiftWorkflowStatusLabel,
  toRecipientProgramTypeLabel,
  toRecipientStatusLabel,
} from '@/features/campaigns/model/campaignPeopleWorkspacePresentation';
import type { CampaignRecipient } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

interface CampaignPeopleRecipientTableProps {
  recipients: CampaignRecipient[];
  onSelectRecipient: (recipientId: string) => void;
}

type RecipientSortKey = 'person' | 'program' | 'group' | 'age' | 'wishlist' | 'status';

export function CampaignPeopleRecipientTable({
  recipients,
  onSelectRecipient,
}: CampaignPeopleRecipientTableProps) {
  const [sortKey, setSortKey] = useState<RecipientSortKey>('person');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedRecipients = useMemo(() => {
    const sorted = [...recipients];

    sorted.sort((left, right) => {
      const leftValue = getRecipientSortValue(left, sortKey);
      const rightValue = getRecipientSortValue(right, sortKey);

      if (leftValue < rightValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (leftValue > rightValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return left.displayLabel.localeCompare(right.displayLabel);
    });

    return sorted;
  }, [recipients, sortDirection, sortKey]);

  const handleSort = (nextKey: RecipientSortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((currentValue) => (currentValue === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  };

  if (recipients.length === 0) {
    return <div className="campaign-studio__empty-note">No people match the current search.</div>;
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
              label="Program"
              sortKey="program"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Group"
              sortKey="group"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Age"
              sortKey="age"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Wishlist"
              sortKey="wishlist"
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
          {sortedRecipients.map((recipient) => (
            <tr
              key={recipient.id}
              className="campaign-team-table__row"
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
                <div className="campaign-team-table__person">
                  <strong>{recipient.displayLabel}</strong>
                  <span>
                    {recipient.group?.groupType === 'ADULT_PROGRAM' && recipient.programRecipientId
                      ? [recipient.programRecipientId, recipient.facilityRoom ? `Room ${recipient.facilityRoom}` : null]
                          .filter(Boolean)
                          .join(' · ')
                      : recipient.group?.groupType === 'ADULT_PROGRAM' && recipient.facilityRoom
                        ? `Room ${recipient.facilityRoom}`
                      : recipient.gender
                        ? `Gender ${recipient.gender}`
                        : 'No profile details yet'}
                  </span>
                </div>
              </td>
              <td>{toRecipientProgramTypeLabel(recipient.programType)}</td>
              <td>{recipient.group?.groupName ?? 'No group'}</td>
              <td>{recipient.age ?? recipient.birthYear ?? 'Not set'}</td>
              <td>
                {recipient.wishlist ? (
                  <div className="campaign-team-table__person">
                    <strong>{recipient.wishlist.items.length} item{recipient.wishlist.items.length === 1 ? '' : 's'}</strong>
                    <div className="campaign-people-wishlist-list">
                      {recipient.wishlist.items.map((item) => (
                        <div key={item.id} className="campaign-people-wishlist-list__item">
                          <span className="campaign-people-wishlist-list__name">{item.description}</span>
                          <span className="campaign-people-wishlist-list__meta">
                            {toGiftWorkflowStatusLabel(
                              item.giftWorkflow.isPickedUp,
                              item.giftWorkflow.isFullyFulfilled,
                              item.giftWorkflow.sponsorshipStatus
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted">No wishlist yet</span>
                )}
              </td>
              <td>{toRecipientStatusLabel(recipient.status)}</td>
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
  sortKey: RecipientSortKey;
  activeKey: RecipientSortKey;
  direction: 'asc' | 'desc';
  onSort: (sortKey: RecipientSortKey) => void;
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

function getRecipientSortValue(recipient: CampaignRecipient, sortKey: RecipientSortKey) {
  switch (sortKey) {
    case 'program':
      return toRecipientProgramTypeLabel(recipient.programType);
    case 'group':
      return recipient.group?.groupName ?? '';
    case 'age':
      return recipient.age ?? recipient.birthYear ?? -1;
    case 'wishlist':
      return recipient.wishlist?.items.length ?? -1;
    case 'status':
      return toRecipientStatusLabel(recipient.status);
    case 'person':
    default:
      return recipient.displayLabel;
  }
}
