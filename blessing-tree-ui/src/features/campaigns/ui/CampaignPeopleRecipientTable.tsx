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
import { ExpandCollapseControls } from '@/shared/ui/ExpandCollapseControls';
import { TablePagination } from '@/shared/ui/TablePagination';
import { clampTablePage } from '@/shared/ui/tablePaginationModel';
import { compareOptionalProgramIds } from '@/shared/lib/naturalSort';

interface CampaignPeopleRecipientTableProps {
  recipients: CampaignRecipient[];
  canEdit: boolean;
  onSelectRecipient: (recipientId: string) => void;
  onRequestDeleteRecipient: (recipientId: string) => void;
}

type RecipientSortKey = 'person' | 'personId' | 'program' | 'group' | 'age' | 'wishlist' | 'status';

export function CampaignPeopleRecipientTable({
  recipients,
  canEdit,
  onSelectRecipient,
  onRequestDeleteRecipient,
}: CampaignPeopleRecipientTableProps) {
  const [sortKey, setSortKey] = useState<RecipientSortKey>('person');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openRecipientIds, setOpenRecipientIds] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const sortedRecipients = useMemo(() => {
    const sorted = [...recipients];

    sorted.sort((left, right) => {
      const leftValue = getRecipientSortValue(left, sortKey);
      const rightValue = getRecipientSortValue(right, sortKey);

      const comparison =
        sortKey === 'personId'
          ? compareOptionalProgramIds(String(leftValue), String(rightValue))
          : compareSortValues(leftValue, rightValue);
      if (comparison !== 0) {
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      return compareSortValues(left.displayLabel, right.displayLabel);
    });

    return sorted;
  }, [recipients, sortDirection, sortKey]);

  const safePage = clampTablePage(page, sortedRecipients.length, pageSize);

  const pagedRecipients = useMemo(() => {
    return sortedRecipients.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [pageSize, safePage, sortedRecipients]);

  const hasExpandableRecipients = sortedRecipients.some((recipient) => (recipient.wishlist?.items.length ?? 0) > 0);

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

  const expandAll = () => {
    setOpenRecipientIds(
      Object.fromEntries(
        sortedRecipients
          .filter((recipient) => (recipient.wishlist?.items.length ?? 0) > 0)
          .map((recipient) => [recipient.id, true])
      )
    );
  };

  const collapseAll = () => {
    setOpenRecipientIds({});
  };

  if (recipients.length === 0) {
    return <div className="campaign-studio__empty-note">No people match the current search.</div>;
  }

  return (
    <>
      {hasExpandableRecipients ? (
        <ExpandCollapseControls onExpandAll={expandAll} onCollapseAll={collapseAll} />
      ) : null}
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
            <SortableHeader
              label="Person ID"
              sortKey="personId"
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pagedRecipients.map((recipient) => {
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
                  <td>
                    {[recipient.group?.programGroupId, recipient.group?.groupName].filter(Boolean).join(' ') || 'No group'}
                  </td>
                  <td>{formatRecipientAge(recipient.age, recipient.ageUnit)}</td>
                  <td>
                    {recipient.wishlist?.items.length ? (
                      <GiftSummaryList items={recipient.wishlist.items} />
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
                              <th>Size</th>
                              <th>Type</th>
                              <th>Requested</th>
                              <th>Sponsor</th>
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
                                <td>{item.size ?? '—'}</td>
                                <td>{item.itemType.replaceAll('_', ' ')}</td>
                                <td>{item.qtyRequested}</td>
                                <td>
                                  {item.sponsor ? (
                                    <div className="campaign-people-group-child-primary">
                                      <strong>{item.sponsor.displayName}</strong>
                                      {item.sponsor.phone ? <span>{item.sponsor.phone}</span> : null}
                                    </div>
                                  ) : (
                                    <span className="text-muted">Unsponsored</span>
                                  )}
                                </td>
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
      <TablePagination
        page={safePage}
        pageSize={pageSize}
        totalItems={sortedRecipients.length}
        itemLabel="people"
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />
    </>
  );
}

function GiftSummaryList({
  items,
}: {
  items: NonNullable<CampaignRecipient['wishlist']>['items'];
}) {
  return (
    <div className="campaign-people-gift-summary-list">
      {items.map((item) => (
        <div key={item.id} className="campaign-people-gift-summary-line">
          <span className="campaign-people-gift-summary-line__gift">
            {item.description}
            {item.size ? ` (${item.size})` : ''}
          </span>
          <span className="campaign-people-gift-summary-line__meta">
            {item.sponsor?.displayName ?? 'Unsponsored'}
            {item.sponsor?.phone ? ` · ${item.sponsor.phone}` : ''}
            {' · '}
            {toGiftWorkflowStatusLabel(
              item.giftWorkflow.isPickedUp,
              item.giftWorkflow.isFullyFulfilled,
              item.giftWorkflow.sponsorshipStatus
            )}
            {item.giftWorkflow.isPickedUp ? ' · Picked up' : ''}
          </span>
        </div>
      ))}
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
    case 'personId':
      return recipient.programRecipientId ?? '';
    case 'person':
    default:
      return recipient.displayLabel;
  }
}

function compareSortValues(left: string | number, right: string | number) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}
