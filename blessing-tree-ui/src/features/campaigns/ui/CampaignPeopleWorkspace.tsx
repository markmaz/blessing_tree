import { useMemo, useState } from 'react';
import '@/features/campaigns/ui/campaignStudioTeam.css';
import '@/features/campaigns/ui/campaignPeople.css';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import {
  formatRecipientAge,
  toGroupContactRoleLabel,
  toRecipientGroupTypeLabel,
  toRecipientProgramTypeLabel,
  toRecipientStatusLabel,
} from '@/features/campaigns/model/campaignPeopleWorkspacePresentation';
import type {
  CampaignAddressSuggestion,
  CampaignPeopleGroup,
  CampaignPeopleGroupContact,
  CampaignPeopleWorkspaceData,
  CampaignRecipient,
  CampaignWishlistItem,
  GroupContactUpsertInput,
  RecipientGroupType,
  RecipientGroupUpsertInput,
  RecipientUpsertInput,
  WishlistItemUpsertInput,
} from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';
import { canManagePeople } from '@/features/campaigns/model/campaignPermissions';
import { CampaignPeopleGroupTable } from '@/features/campaigns/ui/CampaignPeopleGroupTable';
import { CampaignPeopleRecipientTable } from '@/features/campaigns/ui/CampaignPeopleRecipientTable';
import { CampaignPeopleGroupDrawer } from '@/features/campaigns/ui/CampaignPeopleGroupDrawer';
import { CampaignPeopleRecipientDrawer } from '@/features/campaigns/ui/CampaignPeopleRecipientDrawer';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import { WorkspacePageHeader } from '@/shared/ui/WorkspacePageHeader';
import { WorkspaceSectionHeader } from '@/shared/ui/WorkspaceSectionHeader';
import { ReportExportActions } from '@/features/reports/ui/ReportExportActions';
import type { ReportExportPayload } from '@/features/reports/model/reportExport';

interface CampaignPeopleWorkspaceProps {
  campaignName: string;
  heroContextLabel?: string;
  access: CampaignAccess | null;
  workspace: CampaignPeopleWorkspaceData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onSaveGroup: (
    input: RecipientGroupUpsertInput,
    groupId?: string
  ) => Promise<CampaignPeopleGroup | null>;
  onSaveContact: (
    groupId: string,
    input: GroupContactUpsertInput,
    contactId?: string
  ) => Promise<CampaignPeopleGroupContact | null>;
  onDeleteContact: (groupId: string, contactId: string) => Promise<boolean>;
  onSaveRecipient: (
    input: RecipientUpsertInput,
    recipientId?: string
  ) => Promise<CampaignRecipient | null>;
  onDeleteGroup: (groupId: string) => Promise<boolean>;
  onDeleteRecipient: (recipientId: string) => Promise<boolean>;
  onSaveWishlistItem: (
    recipientId: string,
    input: WishlistItemUpsertInput,
    itemId?: string
  ) => Promise<CampaignWishlistItem | null>;
  onDeleteWishlistItem: (recipientId: string, itemId: string) => Promise<boolean>;
  onSearchAddresses: (query: string) => Promise<CampaignAddressSuggestion[]>;
  onClearError: () => void;
  showHero?: boolean;
  showCreateActions?: boolean;
}

export function CampaignPeopleWorkspace({
  campaignName,
  heroContextLabel,
  access,
  workspace,
  isLoading,
  isSaving,
  error,
  onSaveGroup,
  onSaveContact,
  onDeleteContact,
  onSaveRecipient,
  onDeleteGroup,
  onDeleteRecipient,
  onSaveWishlistItem,
  onDeleteWishlistItem,
  onSearchAddresses,
  onClearError,
  showHero = true,
  showCreateActions = true,
}: CampaignPeopleWorkspaceProps) {
  const canEditPeople = canManagePeople(access);
  const [groupSearch, setGroupSearch] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedProgramAbbreviation, setSelectedProgramAbbreviation] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [createGroupType, setCreateGroupType] = useState<RecipientGroupType | null>(null);
  const [createParentOrganizationGroupId, setCreateParentOrganizationGroupId] = useState<string | null>(null);
  const [isCreateRecipientOpen, setIsCreateRecipientOpen] = useState(false);
  const [createRecipientGroupId, setCreateRecipientGroupId] = useState<string | null>(null);
  const [pendingDeleteGroupId, setPendingDeleteGroupId] = useState<string | null>(null);
  const [pendingDeleteRecipientId, setPendingDeleteRecipientId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const programFilterOptions = useMemo(() => {
    if (!workspace) {
      return [];
    }
    return Array.from(
      new Set(
        workspace.groups
          .map((group) => group.programAbbreviation?.trim())
          .filter((value): value is string => !!value)
      )
    ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
  }, [workspace]);

  const groupProgramAbbreviationById = useMemo(() => {
    const abbreviations = new Map<string, string>();
    workspace?.groups.forEach((group) => {
      const groupAbbreviation = group.programAbbreviation?.trim();
      const parentAbbreviation = group.parentOrganizationGroupId
        ? workspace.groups.find((candidate) => candidate.id === group.parentOrganizationGroupId)?.programAbbreviation?.trim()
        : null;
      const abbreviation = groupAbbreviation || parentAbbreviation;
      if (abbreviation) {
        abbreviations.set(group.id, abbreviation);
      }
    });
    return abbreviations;
  }, [workspace]);

  const filteredGroups = useMemo(() => {
    if (!workspace) {
      return [];
    }

    const normalizedSearch = groupSearch.trim().toLowerCase();
    return workspace.groups.filter((group) => {
      if (selectedProgramAbbreviation && groupProgramAbbreviationById.get(group.id) !== selectedProgramAbbreviation) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        group.groupName,
        group.programAbbreviation ?? '',
        group.externalReference ?? '',
        group.parentOrganization?.groupName ?? '',
        group.primaryContact?.firstName ?? '',
        group.primaryContact?.lastName ?? '',
        group.primaryContact?.email ?? '',
        group.primaryContact?.phone ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [groupProgramAbbreviationById, groupSearch, selectedProgramAbbreviation, workspace]);

  const filteredRecipients = useMemo(() => {
    if (!workspace) {
      return [];
    }

    const normalizedSearch = recipientSearch.trim().toLowerCase();
    return workspace.recipients.filter((recipient) => {
      if (
        selectedProgramAbbreviation &&
        groupProgramAbbreviationById.get(recipient.recipientGroupId) !== selectedProgramAbbreviation
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        recipient.programRecipientId ?? '',
        recipient.displayLabel,
        recipient.firstName ?? '',
        recipient.lastName ?? '',
        recipient.group?.groupName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [groupProgramAbbreviationById, recipientSearch, selectedProgramAbbreviation, workspace]);

  const selectedGroup =
    workspace?.groups.find((group) => group.id === selectedGroupId) ?? null;
  const selectedRecipient =
    workspace?.recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null;
  const pendingDeleteGroup =
    workspace?.groups.find((group) => group.id === pendingDeleteGroupId) ?? null;
  const pendingDeleteRecipient =
    workspace?.recipients.find((recipient) => recipient.id === pendingDeleteRecipientId) ?? null;
  const groupDirectoryExport = useMemo(
    () => buildGroupDirectoryExport(campaignName, filteredGroups),
    [campaignName, filteredGroups]
  );
  const peopleDirectoryExport = useMemo(
    () => buildPeopleDirectoryExport(campaignName, filteredRecipients),
    [campaignName, filteredRecipients]
  );

  const pendingDeleteGroupDetails = useMemo(() => {
    if (!pendingDeleteGroup) {
      return [];
    }
    const recipientCount = pendingDeleteGroup.recipients.length;
    const wishlistCount = pendingDeleteGroup.recipients.filter((recipient) => recipient.wishlist).length;
    const wishlistItemCount = pendingDeleteGroup.recipients.reduce(
      (total, recipient) => total + (recipient.wishlist?.items.length ?? 0),
      0
    );
    return [
      `${pendingDeleteGroup.contacts.length} contact${pendingDeleteGroup.contacts.length === 1 ? '' : 's'}`,
      `${recipientCount} ${pendingDeleteGroup.groupType === 'HOUSEHOLD' ? 'child' : 'person'} record${recipientCount === 1 ? '' : 's'}`,
      `${wishlistCount} wishlist${wishlistCount === 1 ? '' : 's'}`,
      `${wishlistItemCount} gift item${wishlistItemCount === 1 ? '' : 's'}`,
    ];
  }, [pendingDeleteGroup]);

  const pendingDeleteRecipientDetails = useMemo(() => {
    if (!pendingDeleteRecipient) {
      return [];
    }
    const wishlistItemCount = pendingDeleteRecipient.wishlist?.items.length ?? 0;
    return [
      pendingDeleteRecipient.programRecipientId
        ? `Person ID: ${pendingDeleteRecipient.programRecipientId}`
        : `${pendingDeleteRecipient.recipientKind === 'CHILD' ? 'Child' : 'Person'} record`,
      pendingDeleteRecipient.wishlist ? '1 wishlist record' : 'No wishlist record',
      `${wishlistItemCount} gift item${wishlistItemCount === 1 ? '' : 's'}`,
    ];
  }, [pendingDeleteRecipient]);

  if (isLoading && !workspace) {
    return <p className="text-muted">Loading People workspace...</p>;
  }

  if (!workspace) {
    return (
      <div className="alert alert-danger" role="alert">
        {error ?? 'Unable to load People workspace.'}
      </div>
    );
  }

  return (
    <section className="campaign-page-stack">
      {showHero ? (
        <div className="campaign-hero-card mb-4">
          <WorkspacePageHeader
            title="People"
            description="Manage households, organizations, contacts, people, and wishlists for this campaign."
            chips={
              <>
                <span className="campaign-chip campaign-chip-muted">{campaignName}</span>
                <span className="campaign-chip campaign-chip-muted">People</span>
                {heroContextLabel ? (
                  <span className="campaign-chip campaign-chip-muted">{heroContextLabel}</span>
                ) : null}
              </>
            }
          />
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger" role="alert">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={onClearError}
            >
              <i className="bi bi-x-circle me-2" aria-hidden="true" />
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="campaign-studio__stat-grid campaign-people-stats">
        <StatCard label="Total Groups" value={workspace.counts.groupCount} />
        <StatCard label="Total People" value={workspace.counts.recipientCount} />
        <StatCard label="Total Wishlists" value={workspace.counts.wishlistCount} />
        <StatCard label="Open Gift Items" value={workspace.counts.openItemCount} />
      </div>

      <div className="campaign-team-workspace">
        <section className="campaign-team-workspace__section">
          <WorkspaceSectionHeader
            title="Households & Organizations"
            description="Shared intake containers for parents, guardians, coordinators, staff contacts, and the people they represent."
            actions={
              <>
              <ReportExportActions payload={groupDirectoryExport} formats={['pdf', 'excel']} />
              {canEditPeople && showCreateActions ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm campaign-team-workspace__section-action"
                    onClick={() => {
                      setSelectedGroupId(null);
                      setCreateParentOrganizationGroupId(null);
                      setCreateGroupType('HOUSEHOLD');
                    }}
                  >
                    <i className="bi bi-house-heart" aria-hidden="true" />
                    <span>Add Family</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm campaign-team-workspace__section-action"
                    onClick={() => {
                      setSelectedGroupId(null);
                      setCreateParentOrganizationGroupId(null);
                      setCreateGroupType('ORGANIZATION');
                    }}
                  >
                    <i className="bi bi-diagram-3-fill" aria-hidden="true" />
                    <span>Add Organization</span>
                  </button>
                </>
              ) : null}
              </>
            }
          />

          {programFilterOptions.length > 0 ? (
            <div className="campaign-program-filter-row" aria-label="Program filters">
              <span className="small text-uppercase text-muted fw-semibold">Program</span>
              <div className="campaign-program-filter-row__chips" role="group" aria-label="Filter by program abbreviation">
                <button
                  type="button"
                  className={`campaign-program-filter-chip${selectedProgramAbbreviation === null ? ' is-active' : ''}`}
                  onClick={() => setSelectedProgramAbbreviation(null)}
                >
                  All
                </button>
                {programFilterOptions.map((abbreviation) => (
                  <button
                    key={abbreviation}
                    type="button"
                    className={`campaign-program-filter-chip${selectedProgramAbbreviation === abbreviation ? ' is-active' : ''}`}
                    onClick={() => setSelectedProgramAbbreviation(abbreviation)}
                  >
                    {abbreviation}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="campaign-team-table-toolbar">
            <label className="form-label campaign-team-toolbar__search mb-0">
              <span className="small text-uppercase text-muted fw-semibold">Search Groups</span>
              <input
                className="form-control mt-2"
                value={groupSearch}
                onChange={(event) => setGroupSearch(event.target.value)}
                placeholder="Search group name or contact"
              />
            </label>
          </div>

          <CampaignPeopleGroupTable
            groups={filteredGroups}
            canEdit={canEditPeople}
            onSelectGroup={(groupId) => {
              setCreateParentOrganizationGroupId(null);
              setCreateGroupType(null);
              setSelectedGroupId(groupId);
            }}
            onSelectRecipient={(recipientId) => {
              setCreateGroupType(null);
              setCreateParentOrganizationGroupId(null);
              setSelectedGroupId(null);
              setIsCreateRecipientOpen(false);
              setCreateRecipientGroupId(null);
              setSelectedRecipientId(recipientId);
            }}
            onRequestDeleteGroup={setPendingDeleteGroupId}
            onRequestDeleteRecipient={setPendingDeleteRecipientId}
          />
        </section>

        <section className="campaign-team-workspace__section">
          <WorkspaceSectionHeader
            title="People"
            description="Each row is an actual gift recipient, with a campaign-specific wishlist and program context."
            actions={
              <>
              <ReportExportActions payload={peopleDirectoryExport} formats={['pdf', 'excel']} />
              {canEditPeople && showCreateActions ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm campaign-team-workspace__section-action"
                  onClick={() => {
                    setIsCreateRecipientOpen(true);
                    setSelectedRecipientId(null);
                    setCreateRecipientGroupId(null);
                  }}
                >
                  <i className="bi bi-person-plus" aria-hidden="true" />
                  <span>Add Person</span>
                </button>
              ) : null}
              </>
            }
          />

          <div className="campaign-team-table-toolbar">
            <label className="form-label campaign-team-toolbar__search mb-0">
              <span className="small text-uppercase text-muted fw-semibold">Search People</span>
              <input
                className="form-control mt-2"
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Search person or group"
              />
            </label>
          </div>

          <CampaignPeopleRecipientTable
            recipients={filteredRecipients}
            canEdit={canEditPeople}
            onSelectRecipient={(recipientId) => {
              setIsCreateRecipientOpen(false);
              setCreateRecipientGroupId(null);
              setSelectedRecipientId(recipientId);
            }}
            onRequestDeleteRecipient={setPendingDeleteRecipientId}
          />
        </section>
      </div>

      <CampaignPeopleGroupDrawer
        key={selectedGroup?.id ?? `group-${createGroupType ?? 'closed'}`}
        campaignId={workspace.campaignId}
        isOpen={createGroupType !== null || selectedGroup !== null}
        isSaving={isSaving}
        canEdit={canEditPeople}
        group={selectedGroup}
        groups={workspace.groups}
        organizationTypes={workspace.organizationTypes ?? []}
        initialGroupType={createGroupType ?? 'HOUSEHOLD'}
        initialParentOrganizationGroupId={createParentOrganizationGroupId}
        onClose={() => {
          setCreateGroupType(null);
          setCreateParentOrganizationGroupId(null);
          setSelectedGroupId(null);
        }}
        onSaveGroup={async (input, groupId) => {
          const savedGroup = await onSaveGroup(input, groupId);
          if (savedGroup) {
            setCreateGroupType(null);
            setCreateParentOrganizationGroupId(null);
            setSelectedGroupId(savedGroup.id);
          }
          return savedGroup;
        }}
        onSaveContact={onSaveContact}
        onDeleteContact={onDeleteContact}
        onDeleteGroup={onDeleteGroup}
        onSearchAddresses={onSearchAddresses}
        onAddRecipientToGroup={(groupId) => {
          setCreateGroupType(null);
          setCreateParentOrganizationGroupId(null);
          setSelectedGroupId(null);
          setIsCreateRecipientOpen(true);
          setSelectedRecipientId(null);
          setCreateRecipientGroupId(groupId);
        }}
        onAddFamilyToOrganization={(organizationGroupId) => {
          setSelectedGroupId(null);
          setSelectedRecipientId(null);
          setIsCreateRecipientOpen(false);
          setCreateRecipientGroupId(null);
          setCreateParentOrganizationGroupId(organizationGroupId);
          setCreateGroupType('HOUSEHOLD');
        }}
        onSelectGroup={(groupId) => {
          setCreateGroupType(null);
          setCreateParentOrganizationGroupId(null);
          setSelectedGroupId(groupId);
        }}
        onSelectRecipient={(recipientId) => {
          setCreateGroupType(null);
          setCreateParentOrganizationGroupId(null);
          setSelectedGroupId(null);
          setIsCreateRecipientOpen(false);
          setCreateRecipientGroupId(null);
          setSelectedRecipientId(recipientId);
        }}
      />

      <CampaignPeopleRecipientDrawer
        key={selectedRecipient?.id ?? `recipient-${createRecipientGroupId ?? (isCreateRecipientOpen ? 'create' : 'closed')}`}
        campaignId={workspace.campaignId}
        isOpen={selectedRecipient !== null || isCreateRecipientOpen}
        isSaving={isSaving}
        canEdit={canEditPeople}
        recipient={selectedRecipient}
        initialGroupId={createRecipientGroupId}
        lockedGroupId={createRecipientGroupId}
        groups={workspace.groups}
        recipients={workspace.recipients}
        organizationTypes={workspace.organizationTypes ?? []}
        onClose={() => {
          setIsCreateRecipientOpen(false);
          setSelectedRecipientId(null);
          setCreateRecipientGroupId(null);
        }}
        onSaveRecipient={async (input, recipientId) => {
          const savedRecipient = await onSaveRecipient(input, recipientId);
          if (savedRecipient) {
            setIsCreateRecipientOpen(false);
            setCreateRecipientGroupId(null);
            setSelectedRecipientId(savedRecipient.id);
          }
          return savedRecipient;
        }}
        onSaveWishlistItem={onSaveWishlistItem}
        onDeleteWishlistItem={onDeleteWishlistItem}
        onDeleteRecipient={onDeleteRecipient}
        onSelectExistingRecipient={(recipientId) => {
          setIsCreateRecipientOpen(false);
          setCreateRecipientGroupId(null);
          setSelectedRecipientId(recipientId);
        }}
        onStartAnotherRecipient={() => {
          const nextGroupId = createRecipientGroupId ?? selectedRecipient?.recipientGroupId ?? null;
          if (!nextGroupId) {
            return;
          }
          setCreateRecipientGroupId(nextGroupId);
          setSelectedRecipientId(null);
          setIsCreateRecipientOpen(true);
        }}
      />

      <ConfirmationModal
        open={pendingDeleteGroup !== null}
        title={
          pendingDeleteGroup?.groupType === 'HOUSEHOLD'
            ? 'Delete Family'
            : 'Delete Organization'
        }
        message={
          pendingDeleteGroup
            ? `Delete ${pendingDeleteGroup.groupName}? This cannot be undone.`
            : ''
        }
        details={pendingDeleteGroupDetails}
        confirmLabel={
          pendingDeleteGroup?.groupType === 'HOUSEHOLD'
            ? 'Delete Family'
            : 'Delete Organization'
        }
        isSubmitting={isDeleting}
        onClose={() => setPendingDeleteGroupId(null)}
        onConfirm={async () => {
          if (!pendingDeleteGroup) {
            return;
          }
          setIsDeleting(true);
          try {
            const didDelete = await onDeleteGroup(pendingDeleteGroup.id);
            if (didDelete) {
              setPendingDeleteGroupId(null);
            }
          } finally {
            setIsDeleting(false);
          }
        }}
      />

      <ConfirmationModal
        open={pendingDeleteRecipient !== null}
        title={
          pendingDeleteRecipient?.recipientKind === 'CHILD'
            ? 'Delete Child'
            : 'Delete Person'
        }
        message={
          pendingDeleteRecipient
            ? `Delete ${pendingDeleteRecipient.displayLabel}? This cannot be undone.`
            : ''
        }
        details={pendingDeleteRecipientDetails}
        confirmLabel={
          pendingDeleteRecipient?.recipientKind === 'CHILD'
            ? 'Delete Child'
            : 'Delete Person'
        }
        isSubmitting={isDeleting}
        onClose={() => setPendingDeleteRecipientId(null)}
        onConfirm={async () => {
          if (!pendingDeleteRecipient) {
            return;
          }
          setIsDeleting(true);
          try {
            const didDelete = await onDeleteRecipient(pendingDeleteRecipient.id);
            if (didDelete) {
              setPendingDeleteRecipientId(null);
            }
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="campaign-studio__stat-card">
      <span className="campaign-studio__stat-label">{label}</span>
      <strong className="campaign-studio__stat-value">{value ?? 0}</strong>
    </article>
  );
}

function buildGroupDirectoryExport(campaignName: string, groups: CampaignPeopleGroup[]): ReportExportPayload {
  const directoryRows = buildGroupDirectoryRows(groups);

  return {
    title: 'Households & Organizations Directory',
    subtitle: campaignName,
    fileName: `${campaignName}-groups-directory`,
    sheets: [
      {
        name: 'Directory',
        columns: [
          { key: 'recipientId', label: 'Recipient ID', pdfWidthWeight: 0.85 },
          { key: 'recipientName', label: 'Recipient Name', pdfWidthWeight: 1.45 },
          { key: 'age', label: 'Age', pdfWidthWeight: 0.65 },
          { key: 'location', label: 'Location', pdfWidthWeight: 1.05 },
          { key: 'giftItems', label: 'Gift Items', pdfWidthWeight: 2.6 },
          { key: 'sponsor', label: 'Sponsor', pdfWidthWeight: 1.55 },
        ],
        rows: directoryRows.length ? directoryRows : [{ group: 'No groups' }],
      },
    ],
  };
}

function buildGroupDirectoryRows(groups: CampaignPeopleGroup[]) {
  const rows: Array<Record<string, unknown>> = [];
  const childGroupsByParentId = new Map<string, CampaignPeopleGroup[]>();
  groups.forEach((group) => {
    if (!group.parentOrganizationGroupId) {
      return;
    }
    childGroupsByParentId.set(group.parentOrganizationGroupId, [
      ...(childGroupsByParentId.get(group.parentOrganizationGroupId) ?? []),
      group,
    ]);
  });

  groups
    .filter((group) => !group.parentOrganizationGroupId)
    .forEach((group) => {
    const familyGroups = childGroupsByParentId.get(group.id) ?? [];
    const totalPeople = group.recipientCount + familyGroups.reduce((total, family) => total + family.recipientCount, 0);
    rows.push({
      __rowType: 'organizationHeader',
      recipientId: formatGroupHeader(group, totalPeople),
    });

    sortRecipientsByProgramId(group.recipients).forEach((recipient) => {
      rows.push(buildRecipientDirectoryRow(recipient, group));
    });

    familyGroups.forEach((family) => {
      rows.push({
        __rowType: 'familyHeader',
        recipientId: formatFamilyHeader(family),
      });
      sortRecipientsByProgramId(family.recipients).forEach((recipient) => {
        rows.push(buildRecipientDirectoryRow(recipient, family));
      });
    });

    rows.push({ __rowType: 'spacer', recipientId: '' });
  });

  return rows;
}

function sortRecipientsByProgramId(recipients: CampaignRecipient[]): CampaignRecipient[] {
  return [...recipients].sort((left, right) => {
    const leftId = left.programRecipientId ?? '';
    const rightId = right.programRecipientId ?? '';
    const idComparison = leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: 'base' });
    if (idComparison !== 0) {
      return idComparison;
    }
    return left.displayLabel.localeCompare(right.displayLabel);
  });
}

function buildRecipientDirectoryRow(recipient: CampaignRecipient, group: CampaignPeopleGroup): Record<string, unknown> {
  return {
    recipientId: recipient.programRecipientId ?? '',
    recipientName: recipient.displayLabel,
    age: formatRecipientAge(recipient.age, recipient.ageUnit),
    location: recipient.facilityRoom ? `Room ${recipient.facilityRoom}` : [group.city, group.state].filter(Boolean).join(', '),
    giftItems: formatRecipientGiftItems(recipient),
    sponsor: formatRecipientSponsors(recipient),
  };
}

function formatGroupHeader(group: CampaignPeopleGroup, totalPeople: number): string {
  return [
    group.groupName,
    [
      group.programAbbreviation ? `Program: ${group.programAbbreviation}` : null,
      toRecipientGroupTypeLabel(group.groupType),
      group.organizationType ?? null,
      `People: ${totalPeople}`,
    ]
      .filter(Boolean)
      .join(' · '),
    `Contact: ${formatGroupPrimaryContact(group)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatFamilyHeader(group: CampaignPeopleGroup): string {
  return [
    group.groupName,
    `Parent/Guardian: ${formatGroupPrimaryContact(group)}`,
    group.externalReference ? `External Reference: ${group.externalReference}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatGroupPrimaryContact(group: CampaignPeopleGroup): string {
  const contact = group.primaryContact;
  if (!contact) {
    return 'No contact yet';
  }
  return [
    contact.displayName,
    [
      toGroupContactRoleLabel(contact.contactRole),
      contact.email,
      contact.phone,
    ]
      .filter(Boolean)
      .join(' · '),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatRecipientGiftItems(recipient: CampaignRecipient): string {
  const items = recipient.wishlist?.items ?? [];
  if (items.length === 0) {
    return 'No wishlist';
  }
  return items
    .map((item) => `${item.description}${item.size ? ` (${item.size})` : ''}`)
    .join('; ');
}

function formatRecipientSponsors(recipient: CampaignRecipient): string {
  const items = recipient.wishlist?.items ?? [];
  if (items.length === 0) {
    return '';
  }
  return items
    .map((item) => {
      if (!item.sponsor) {
        return 'Unsponsored';
      }
      return `${item.sponsor.displayName}${item.sponsor.phone ? ` ${item.sponsor.phone}` : ''}`;
    })
    .join('; ');
}

function buildPeopleDirectoryExport(campaignName: string, recipients: CampaignRecipient[]): ReportExportPayload {
  return {
    title: 'People Directory',
    subtitle: campaignName,
    fileName: `${campaignName}-people-directory`,
    sheets: [
      {
        name: 'People',
        columns: [
          { key: 'personId', label: 'Person ID' },
          { key: 'person', label: 'Person' },
          { key: 'program', label: 'Program' },
          { key: 'group', label: 'Group' },
          { key: 'age', label: 'Age' },
          { key: 'gender', label: 'Gender' },
          { key: 'room', label: 'Room' },
          { key: 'directEmail', label: 'Direct Email' },
          { key: 'directPhone', label: 'Direct Phone' },
          { key: 'wishlistItems', label: 'Wishlist Items' },
          { key: 'gifts', label: 'Gifts' },
          { key: 'sponsors', label: 'Sponsors' },
          { key: 'openItems', label: 'Open Items' },
          { key: 'status', label: 'Status' },
        ],
        rows: recipients.map((recipient) => ({
          personId: recipient.programRecipientId ?? '',
          person: recipient.displayLabel,
          program: toRecipientProgramTypeLabel(recipient.programType),
          group: recipient.group?.groupName ?? '',
          age: formatRecipientAge(recipient.age, recipient.ageUnit),
          gender: recipient.gender ?? '',
          room: recipient.facilityRoom ?? '',
          directEmail: recipient.directEmail ?? '',
          directPhone: recipient.directPhone ?? '',
          wishlistItems: recipient.wishlist?.items.length ?? 0,
          gifts: formatRecipientGiftExport(recipient),
          sponsors: formatRecipientSponsorExport(recipient),
          openItems: recipient.workflowSummary.openItemCount,
          status: toRecipientStatusLabel(recipient.status),
        })),
      },
      {
        name: 'Gift Detail',
        columns: [
          { key: 'personId', label: 'Person ID' },
          { key: 'person', label: 'Person' },
          { key: 'group', label: 'Group' },
          { key: 'gift', label: 'Gift' },
          { key: 'size', label: 'Size' },
          { key: 'category', label: 'Category' },
          { key: 'sponsor', label: 'Sponsor' },
          { key: 'sponsorPhone', label: 'Sponsor Phone' },
          { key: 'giftReceived', label: 'Gft Rcvd' },
          { key: 'pickedUp', label: 'Picked Up' },
        ],
        rows: recipients.flatMap((recipient) =>
          (recipient.wishlist?.items ?? []).map((item) => ({
            personId: recipient.programRecipientId ?? '',
            person: recipient.displayLabel,
            group: recipient.group?.groupName ?? '',
            gift: item.description,
            size: item.size ?? '',
            category: item.category ?? item.itemType.replaceAll('_', ' '),
            sponsor: item.sponsor?.displayName ?? '',
            sponsorPhone: item.sponsor?.phone ?? '',
            giftReceived: item.status === 'OPEN' || item.status === 'RESERVED' ? '' : 'Yes',
            pickedUp: item.giftWorkflow.isPickedUp ? 'Yes' : '',
          }))
        ),
      },
    ],
  };
}

function formatRecipientGiftExport(recipient: CampaignRecipient): string {
  return (recipient.wishlist?.items ?? [])
    .map((item) => `${item.description}${item.size ? ` (${item.size})` : ''}`)
    .join('; ');
}

function formatRecipientSponsorExport(recipient: CampaignRecipient): string {
  return (recipient.wishlist?.items ?? [])
    .map((item) => {
      if (!item.sponsor) {
        return 'Unsponsored';
      }
      return `${item.sponsor.displayName}${item.sponsor.phone ? ` (${item.sponsor.phone})` : ''}`;
    })
    .join('; ');
}
