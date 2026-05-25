import { useEffect, useMemo, useState } from 'react';
import type { CampaignSponsor } from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import {
  formatPhoneNumber,
  formatShortDate,
  getMostRecentSponsorInteraction,
  summarizeSponsorInteraction,
  summarizeSponsorGiftItems,
  toSponsorDropOffStatusLabel,
  toSponsorStatusLabel,
} from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';
import { clampTablePage, TablePagination } from '@/shared/ui/TablePagination';

type SponsorSortKey = 'sponsor' | 'contact' | 'gifts' | 'status' | 'lastContacted' | 'dropOff';

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const sortedSponsors = useMemo(() => {
    const sorted = [...sponsors].sort((left, right) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch (sortKey) {
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

  useEffect(() => {
    setPage((currentPage) => clampTablePage(currentPage, sortedSponsors.length, pageSize));
  }, [pageSize, sortedSponsors.length]);

  const pagedSponsors = useMemo(() => {
    const safePage = clampTablePage(page, sortedSponsors.length, pageSize);
    return sortedSponsors.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [page, pageSize, sortedSponsors]);

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

  return (
    <>
      <div className="table-responsive">
        <table className="table campaign-team-table align-middle">
          <thead>
            <tr>
              <SortableHeader
                label="Sponsor"
                active={sortKey === 'sponsor'}
                direction={sortDirection}
                onClick={() => toggleSort('sponsor')}
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
            {pagedSponsors.map((sponsor) => (
              <tr
                key={sponsor.id}
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
                  <div className="campaign-sponsor-table__primary">
                    <span className="campaign-sponsor-table__name">{sponsor.displayName}</span>
                    <span className="campaign-sponsor-table__meta">
                      {[
                        sponsor.organizationName,
                        sponsor.participation.sponsorCode,
                        sponsor.selfRegisteredAt ? 'Self-registered' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Staff-managed sponsor'}
                    </span>
                  </div>
                </td>
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
                    <span>{sponsor.sponsoredItemCount}</span>
                    <span className="campaign-sponsor-table__meta">{summarizeSponsorGiftItems(sponsor)}</span>
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
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={page}
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
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareNumbers(left: number, right: number) {
  return left - right;
}

function dateSortValue(value: string | null) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
