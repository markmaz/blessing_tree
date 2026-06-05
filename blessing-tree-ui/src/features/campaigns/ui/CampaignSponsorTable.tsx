import { Fragment, useMemo, useState } from 'react';
import type { CampaignSponsor } from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import {
  formatPhoneNumber,
  formatShortDate,
  getMostRecentSponsorInteraction,
  summarizeSponsorInteraction,
  toSponsorDropOffStatusLabel,
  toSponsorStatusLabel,
} from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';
import { ExpandCollapseControls } from '@/shared/ui/ExpandCollapseControls';
import { TablePagination } from '@/shared/ui/TablePagination';
import { clampTablePage } from '@/shared/ui/tablePaginationModel';

type SponsorSortKey = 'sponsor' | 'code' | 'contact' | 'gifts' | 'status' | 'lastContacted' | 'dropOff';

interface CampaignSponsorTableProps {
  sponsors: CampaignSponsor[];
  canEdit: boolean;
  onSelectSponsor: (sponsorId: string) => void;
  onRequestDeleteSponsor: (sponsorId: string) => void;
}

export function CampaignSponsorTable({
  sponsors,
  canEdit,
  onSelectSponsor,
  onRequestDeleteSponsor,
}: CampaignSponsorTableProps) {
  const [sortKey, setSortKey] = useState<SponsorSortKey>('sponsor');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openSponsorIds, setOpenSponsorIds] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const sortedSponsors = useMemo(() => {
    const sorted = [...sponsors].sort((left, right) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'code':
          return direction * compareStrings(left.participation.sponsorCode ?? '', right.participation.sponsorCode ?? '');
        case 'contact':
          return direction * compareStrings(left.email ?? left.phone ?? '', right.email ?? right.phone ?? '');
        case 'gifts':
          return direction * (left.sponsoredItemCount - right.sponsoredItemCount);
        case 'status':
          return direction * compareStrings(left.participation.status, right.participation.status);
        case 'lastContacted':
          return direction * compareNumbers(dateSortValue(left.lastContactedAt), dateSortValue(right.lastContactedAt));
        case 'dropOff':
          return direction * compareStrings(left.participation.dropOffStatus, right.participation.dropOffStatus);
        case 'sponsor':
        default:
          return direction * compareStrings(left.displayName, right.displayName);
      }
    });
    return sorted;
  }, [sortDirection, sortKey, sponsors]);

  const safePage = clampTablePage(page, sortedSponsors.length, pageSize);

  const pagedSponsors = useMemo(() => {
    return sortedSponsors.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [pageSize, safePage, sortedSponsors]);

  const hasExpandableSponsors = sortedSponsors.some((sponsor) => sponsor.sponsoredItems.length > 0);

  if (sortedSponsors.length === 0) {
    return <div className="campaign-studio__empty-note">No sponsors match the current search.</div>;
  }

  const toggleSort = (nextKey: SponsorSortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((currentValue) => (currentValue === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('asc');
  };

  const toggleOpen = (sponsorId: string) => {
    setOpenSponsorIds((currentValue) => ({ ...currentValue, [sponsorId]: !currentValue[sponsorId] }));
  };

  const expandAll = () => {
    setOpenSponsorIds(
      Object.fromEntries(
        sortedSponsors
          .filter((sponsor) => sponsor.sponsoredItems.length > 0)
          .map((sponsor) => [sponsor.id, true])
      )
    );
  };

  const collapseAll = () => {
    setOpenSponsorIds({});
  };

  return (
    <>
      {hasExpandableSponsors ? (
        <ExpandCollapseControls onExpandAll={expandAll} onCollapseAll={collapseAll} />
      ) : null}
      <div className="table-responsive">
        <table className="table campaign-team-table align-middle">
          <thead>
            <tr>
              <th style={{ width: 40 }} />
              <SortableHeader
                label="Sponsor"
                active={sortKey === 'sponsor'}
                direction={sortDirection}
                onClick={() => toggleSort('sponsor')}
              />
              <SortableHeader
                label="Sponsor Code"
                active={sortKey === 'code'}
                direction={sortDirection}
                onClick={() => toggleSort('code')}
              />
              <SortableHeader
                label="Contact"
                active={sortKey === 'contact'}
                direction={sortDirection}
                onClick={() => toggleSort('contact')}
              />
              <SortableHeader
                label="Gifts"
                active={sortKey === 'gifts'}
                direction={sortDirection}
                onClick={() => toggleSort('gifts')}
              />
              <SortableHeader
                label="Status"
                active={sortKey === 'status'}
                direction={sortDirection}
                onClick={() => toggleSort('status')}
              />
              <SortableHeader
                label="Last Contacted"
                active={sortKey === 'lastContacted'}
                direction={sortDirection}
                onClick={() => toggleSort('lastContacted')}
              />
              <SortableHeader
                label="Drop-off"
                active={sortKey === 'dropOff'}
                direction={sortDirection}
                onClick={() => toggleSort('dropOff')}
              />
              {canEdit ? <th scope="col" className="text-end">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {pagedSponsors.map((sponsor) => {
              const hasSponsoredItems = sponsor.sponsoredItems.length > 0;
              const isOpen = !!openSponsorIds[sponsor.id];

              return (
                <Fragment key={sponsor.id}>
                  <tr
                    className="campaign-team-table__row campaign-sponsor-table__row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectSponsor(sponsor.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectSponsor(sponsor.id);
                      }
                    }}
                  >
                    <td>
                      {hasSponsoredItems ? (
                        <button
                          type="button"
                          className="campaign-people-group-row__toggle"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? `Collapse ${sponsor.displayName}` : `Expand ${sponsor.displayName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleOpen(sponsor.id);
                          }}
                        >
                          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="campaign-people-row__toggle-placeholder" aria-hidden="true" />
                      )}
                    </td>
                    <td>
                      <div className="campaign-sponsor-table__primary">
                        <span className="campaign-sponsor-table__name">{sponsor.displayName}</span>
                        <span className="campaign-sponsor-table__meta">
                          {[
                            sponsor.organizationName,
                            sponsor.selfRegisteredAt ? 'Self-registered' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Staff-managed sponsor'}
                        </span>
                      </div>
                    </td>
                    <td>{sponsor.participation.sponsorCode ?? '—'}</td>
                    <td>
                      <div className="campaign-sponsor-table__primary">
                        <span>{sponsor.email ?? sponsor.phone ?? 'No contact details'}</span>
                        <span className="campaign-sponsor-table__meta">
                          {[
                            sponsor.email ? null : sponsor.phone ? formatPhoneNumber(sponsor.phone) : null,
                            sponsor.city && sponsor.state ? `${sponsor.city}, ${sponsor.state}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'No city or state'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="campaign-sponsor-table__primary">
                        <span>
                          {sponsor.sponsoredItemCount} gift{sponsor.sponsoredItemCount === 1 ? '' : 's'}
                        </span>
                        <span className="campaign-sponsor-table__meta">
                          {hasSponsoredItems ? 'Expand to view gift status' : 'No sponsored gifts yet'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="campaign-sponsor-table__primary">
                        <span>{toSponsorStatusLabel(sponsor.participation.status)}</span>
                        <span className="campaign-sponsor-table__meta">{sponsor.participation.interestStatus}</span>
                      </div>
                    </td>
                    <td>
                      <div className="campaign-sponsor-table__primary">
                        <span>{formatShortDate(sponsor.lastContactedAt)}</span>
                        <span className="campaign-sponsor-table__meta">
                          {summarizeSponsorInteraction(getMostRecentSponsorInteraction(sponsor.recentInteractions))}
                        </span>
                      </div>
                    </td>
                    <td>{toSponsorDropOffStatusLabel(sponsor.participation.dropOffStatus)}</td>
                    {canEdit ? (
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRequestDeleteSponsor(sponsor.id);
                          }}
                        >
                          <i className="bi bi-trash3" aria-hidden="true" />
                          <span className="ms-2">Delete</span>
                        </button>
                      </td>
                    ) : null}
                  </tr>
                  {isOpen ? (
                    <tr className="campaign-sponsor-table__gift-row">
                      <td colSpan={canEdit ? 9 : 8}>
                        <div className="campaign-people-group-children-wrap">
                          <table className="table table-sm mb-0 campaign-people-group-children-table">
                            <thead>
                              <tr>
                                <th scope="col">Recipient</th>
                                <th scope="col">Gift</th>
                                <th scope="col">Size</th>
                                <th scope="col">Qty</th>
                                <th scope="col">Gift Status</th>
                                <th scope="col">Committed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sponsor.sponsoredItems.map((item) => (
                                <tr key={item.id}>
                                  <td>
                                    <div className="campaign-sponsor-table__primary">
                                      <span>{item.recipient?.displayLabel ?? 'Unknown recipient'}</span>
                                      <span className="campaign-sponsor-table__meta">
                                        {item.recipient?.programRecipientId ?? 'No recipient ID'}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="campaign-sponsor-table__primary">
                                      <span>{item.gift?.description ?? 'Unknown gift'}</span>
                                      <span className="campaign-sponsor-table__meta">
                                        {item.gift?.category ?? 'No category'}
                                      </span>
                                    </div>
                                  </td>
                                  <td>{item.gift?.size ?? '—'}</td>
                                  <td>{item.qtyCommitted}</td>
                                  <td>{formatSponsorGiftStatus(item.gift?.status)}</td>
                                  <td>{formatShortDate(item.committedAt)}</td>
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
        totalItems={sortedSponsors.length}
        itemLabel="sponsors"
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />
    </>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <th scope="col">
      <button type="button" className="campaign-team-table__sort" onClick={onClick}>
        <span>{label}</span>
        <i
          className={`bi ${
            active ? (direction === 'asc' ? 'bi-sort-down' : 'bi-sort-up') : 'bi-arrow-down-up'
          }`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function compareNumbers(left: number, right: number) {
  return left - right;
}

function formatSponsorGiftStatus(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }
  return value
    .split('_')
    .map((segment) => `${segment.slice(0, 1)}${segment.slice(1).toLowerCase()}`)
    .join(' ');
}

function dateSortValue(value: string | null) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
