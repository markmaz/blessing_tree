import { Fragment, useMemo, useState } from 'react';
import {
  formatRecipientAge,
  formatShortDate,
  recipientAgeSortValue,
  toGiftWorkflowStatusLabel,
  toRecipientProgramTypeLabel,
  toRecipientStatusLabel,
} from '@/features/campaigns/model/campaignPeopleWorkspacePresentation';
import type { CampaignRecipient } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

interface CampaignPeopleRecipientTableProps {
  recipients: CampaignRecipient[];
  canEdit: boolean;
  onSelectRecipient: (recipientId: string) => void;
  onRequestDeleteRecipient: (recipientId: string) => void;
}

type RecipientSortKey = 'person' | 'program' | 'group' | 'age' | 'wishlist' | 'status';

export function CampaignPeopleRecipientTable({
  recipients,
  canEdit,
  onSelectRecipient,
  onRequestDeleteRecipient,
}: CampaignPeopleRecipientTableProps) {
  const [sortKey, setSortKey] = useState<RecipientSortKey>('person');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openRecipientIds, setOpenRecipientIds] = useState<Record<string, boolean>>({});

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

  const toggleOpen = (recipientId: string) => {
    setOpenRecipientIds((currentValue) => ({ ...currentValue, [recipientId]: !currentValue[recipientId] }));
  };

  if (recipients.length === 0) {
    return <div className="campaign-studio__empty-note">No people match the current search.</div>;
  }

  return (
    <div className="campaign-team-table-wrap">
      <table className="table campaign-team-table mb-0">
        <thead>
          <tr>
            <th style={{ width: 40 }} />
            <SortableHeader
              label="Person"
              sortKey="person"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <th>Person ID</th>
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedRecipients.map((recipient) => {
            const hasWishlistItems = (recipient.wishlist?.items.length ?? 0) > 0;
            const isOpen = !!openRecipientIds[recipient.id];

            return (
              <Fragment key={recipient.id}>
                <tr
                  className="campaign-team-table__row campaign-people-recipient-parent-row"
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
                    {hasWishlistItems ? (
                      <button
                        type="button"
                        className="campaign-people-group-row__toggle"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Collapse ${recipient.displayLabel}` : `Expand ${recipient.displayLabel}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleOpen(recipient.id);
                        }}
                      >
                        <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="campaign-people-row__toggle-placeholder" aria-hidden="true" />
                    )}
                  </td>
                  <td>
                    <div className="campaign-people-row__link">
                      <span className="campaign-people-row__name">{recipient.displayLabel}</span>
                      <span className="campaign-people-row__meta">
                        {recipient.group?.groupType === 'ORGANIZATION' && recipient.facilityRoom
                          ? `Room ${recipient.facilityRoom}`
                          : recipient.gender
                            ? `Gender ${recipient.gender}`
                            : 'No profile details yet'}
                      </span>
                    </div>
                  </td>
                  <td>{recipient.programRecipientId ?? '—'}</td>
                  <td>{toRecipientProgramTypeLabel(recipient.programType)}</td>
                  <td>{recipient.group?.groupName ?? 'No group'}</td>
                  <td>{formatRecipientAge(recipient.age, recipient.ageUnit)}</td>
                  <td>
                    {recipient.wishlist ? (
                      <strong>{recipient.wishlist.items.length} item{recipient.wishlist.items.length === 1 ? '' : 's'}</strong>
                    ) : (
                      <span className="text-muted">No wishlist yet</span>
                    )}
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
                        <span className="ms-2">Delete</span>
                      </button>
                    ) : null}
                  </td>
                </tr>
                {isOpen && recipient.wishlist ? (
                  <tr className="campaign-people-recipient-children-row">
                    <td colSpan={9}>
                      <div className="campaign-people-group-children-wrap">
                        <table className="table table-sm mb-0 campaign-people-group-children-table">
                          <thead>
                            <tr>
                              <th>Gift</th>
                              <th>Type</th>
                              <th>Requested</th>
                              <th>Status</th>
                              <th>Label</th>
                              <th>Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recipient.wishlist.items.map((item) => (
                              <tr key={item.id} className="campaign-people-recipient-child-row">
                                <td>
                                  <div className="campaign-people-group-child-primary">
                                    <strong>{item.description}</strong>
                                    {item.category ? <span>{item.category}</span> : null}
                                  </div>
                                </td>
                                <td>{item.itemType.replaceAll('_', ' ')}</td>
                                <td>{item.qtyRequested}</td>
                                <td>
                                  {toGiftWorkflowStatusLabel(
                                    item.giftWorkflow.isPickedUp,
                                    item.giftWorkflow.isFullyFulfilled,
                                    item.giftWorkflow.sponsorshipStatus
                                  )}
                                </td>
                                <td>{item.giftWorkflow.labelCode}</td>
                                <td>{formatShortDate(item.updatedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
      return recipientAgeSortValue(recipient.age, recipient.ageUnit);
    case 'wishlist':
      return recipient.wishlist?.items.length ?? -1;
    case 'status':
      return toRecipientStatusLabel(recipient.status);
    case 'person':
    default:
      return recipient.displayLabel;
  }
}
