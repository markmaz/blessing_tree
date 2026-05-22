import { useMemo, useState } from 'react';
import '@/features/campaigns/ui/campaignStudioTeam.css';
import '@/features/campaigns/ui/campaignPeople.css';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import type {
  CampaignAddressSuggestion,
  CampaignPeopleGroup,
  CampaignPeopleGroupContact,
  CampaignPeopleWorkspaceData,
  CampaignRecipient,
  CampaignWishlist,
  CampaignWishlistItem,
  GroupContactUpsertInput,
  RecipientGroupType,
  RecipientGroupUpsertInput,
  RecipientUpsertInput,
  WishlistItemUpsertInput,
  WishlistUpsertInput,
} from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';
import { CampaignPeopleGroupTable } from '@/features/campaigns/ui/CampaignPeopleGroupTable';
import { CampaignPeopleRecipientTable } from '@/features/campaigns/ui/CampaignPeopleRecipientTable';
import { CampaignPeopleGroupDrawer } from '@/features/campaigns/ui/CampaignPeopleGroupDrawer';
import { CampaignPeopleRecipientDrawer } from '@/features/campaigns/ui/CampaignPeopleRecipientDrawer';

interface CampaignPeopleWorkspaceProps {
  campaignName: string;
  access: CampaignAccess | null;
  workspace: CampaignPeopleWorkspaceData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveMessage: string | null;
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
  onSaveWishlist: (
    recipientId: string,
    input: WishlistUpsertInput
  ) => Promise<CampaignWishlist | null | unknown>;
  onSaveWishlistItem: (
    recipientId: string,
    input: WishlistItemUpsertInput,
    itemId?: string
  ) => Promise<CampaignWishlistItem | null>;
  onDeleteWishlistItem: (recipientId: string, itemId: string) => Promise<boolean>;
  onSearchAddresses: (query: string) => Promise<CampaignAddressSuggestion[]>;
  onClearSaveMessage: () => void;
  onClearError: () => void;
  showHero?: boolean;
  showCreateActions?: boolean;
}

export function CampaignPeopleWorkspace({
  campaignName,
  access,
  workspace,
  isLoading,
  isSaving,
  error,
  saveMessage,
  onSaveGroup,
  onSaveContact,
  onDeleteContact,
  onSaveRecipient,
  onSaveWishlist,
  onSaveWishlistItem,
  onDeleteWishlistItem,
  onSearchAddresses,
  onClearSaveMessage,
  onClearError,
  showHero = true,
  showCreateActions = true,
}: CampaignPeopleWorkspaceProps) {
  const canEditPeople = canManageCampaign(access) || access?.capabilities.includes('campaign.recipients.edit') === true;
  const [groupSearch, setGroupSearch] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [createGroupType, setCreateGroupType] = useState<RecipientGroupType | null>(null);
  const [isCreateRecipientOpen, setIsCreateRecipientOpen] = useState(false);
  const [createRecipientGroupId, setCreateRecipientGroupId] = useState<string | null>(null);

  const filteredGroups = useMemo(() => {
    if (!workspace) {
      return [];
    }

    const normalizedSearch = groupSearch.trim().toLowerCase();
    return workspace.groups.filter((group) => {
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        group.groupName,
        group.primaryContact?.firstName ?? '',
        group.primaryContact?.lastName ?? '',
        group.primaryContact?.email ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [groupSearch, workspace]);

  const filteredRecipients = useMemo(() => {
    if (!workspace) {
      return [];
    }

    const normalizedSearch = recipientSearch.trim().toLowerCase();
    return workspace.recipients.filter((recipient) => {
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        recipient.displayLabel,
        recipient.firstName ?? '',
        recipient.lastName ?? '',
        recipient.group?.groupName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [recipientSearch, workspace]);

  const selectedGroup =
    workspace?.groups.find((group) => group.id === selectedGroupId) ?? null;
  const selectedRecipient =
    workspace?.recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null;

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
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
            <div>
              <div className="campaign-chip-row mb-3">
                <span className="campaign-chip campaign-chip-muted">
                  {campaignName}
                </span>
                <span className="campaign-chip campaign-chip-muted">
                  {workspace.counts.householdCount} households
                </span>
                <span className="campaign-chip campaign-chip-muted">
                  {workspace.counts.careFacilityCount} facilities
                </span>
              </div>
              <h1 className="h3 mb-1">People</h1>
              <p className="text-muted mb-0">
                Manage households, facilities, contacts, people, and wishlists for this campaign.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {saveMessage ? (
        <AutoDismissAlert
          key={saveMessage}
          message={saveMessage}
          onDismiss={onClearSaveMessage}
        />
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
        <StatCard label="Groups" value={workspace.counts.groupCount} />
        <StatCard label="People" value={workspace.counts.recipientCount} />
        <StatCard label="Wishlists" value={workspace.counts.wishlistCount} />
        <StatCard label="Open Items" value={workspace.counts.openItemCount} />
      </div>

      <div className="campaign-team-workspace">
        <section className="campaign-team-workspace__section">
          <div className="campaign-team-workspace__section-header">
            <div>
              <h2 className="h5 mb-1">Households &amp; Facilities</h2>
              <p className="text-muted mb-0">
                Shared intake containers for parents, guardians, staff contacts, and the people they represent.
              </p>
            </div>
            {canEditPeople && showCreateActions ? (
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm campaign-team-workspace__section-action"
                  onClick={() => {
                    setSelectedGroupId(null);
                    setCreateGroupType('HOUSEHOLD');
                  }}
                >
                  <i className="bi bi-house-add" aria-hidden="true" />
                  <span>Add Household</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm campaign-team-workspace__section-action"
                  onClick={() => {
                    setSelectedGroupId(null);
                    setCreateGroupType('CARE_FACILITY');
                  }}
                >
                  <i className="bi bi-buildings" aria-hidden="true" />
                  <span>Add Facility</span>
                </button>
              </div>
            ) : null}
          </div>

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
            onSelectGroup={(groupId) => {
              setCreateGroupType(null);
              setSelectedGroupId(groupId);
            }}
          />
        </section>

        <section className="campaign-team-workspace__section">
          <div className="campaign-team-workspace__section-header">
            <div>
              <h2 className="h5 mb-1">People</h2>
              <p className="text-muted mb-0">
                Each row is an actual gift recipient, with a campaign-specific wishlist and program context.
              </p>
            </div>
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
          </div>

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
            onSelectRecipient={(recipientId) => {
              setIsCreateRecipientOpen(false);
              setCreateRecipientGroupId(null);
              setSelectedRecipientId(recipientId);
            }}
          />
        </section>
      </div>

      <CampaignPeopleGroupDrawer
        key={selectedGroup?.id ?? `group-${createGroupType ?? 'closed'}`}
        isOpen={createGroupType !== null || selectedGroup !== null}
        isSaving={isSaving}
        canEdit={canEditPeople}
        group={selectedGroup}
        initialGroupType={createGroupType ?? 'HOUSEHOLD'}
        onClose={() => {
          setCreateGroupType(null);
          setSelectedGroupId(null);
        }}
        onSaveGroup={async (input, groupId) => {
          const savedGroup = await onSaveGroup(input, groupId);
          if (savedGroup) {
            setCreateGroupType(null);
            setSelectedGroupId(savedGroup.id);
          }
          return savedGroup;
        }}
        onSaveContact={onSaveContact}
        onDeleteContact={onDeleteContact}
        onSearchAddresses={onSearchAddresses}
        onAddRecipientToGroup={(groupId) => {
          setCreateGroupType(null);
          setSelectedGroupId(null);
          setIsCreateRecipientOpen(true);
          setSelectedRecipientId(null);
          setCreateRecipientGroupId(groupId);
        }}
        onSelectRecipient={(recipientId) => {
          setCreateGroupType(null);
          setSelectedGroupId(null);
          setIsCreateRecipientOpen(false);
          setCreateRecipientGroupId(null);
          setSelectedRecipientId(recipientId);
        }}
      />

      <CampaignPeopleRecipientDrawer
        key={selectedRecipient?.id ?? `recipient-${createRecipientGroupId ?? (isCreateRecipientOpen ? 'create' : 'closed')}`}
        isOpen={selectedRecipient !== null || isCreateRecipientOpen}
        isSaving={isSaving}
        canEdit={canEditPeople}
        recipient={selectedRecipient}
        initialGroupId={createRecipientGroupId}
        lockedGroupId={createRecipientGroupId}
        groups={workspace.groups}
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
        onSaveWishlist={onSaveWishlist}
        onSaveWishlistItem={onSaveWishlistItem}
        onDeleteWishlistItem={onDeleteWishlistItem}
      />
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="campaign-studio__stat-card">
      <div className="campaign-studio__stat-label">{label}</div>
      <div className="campaign-studio__stat-value">{value}</div>
    </article>
  );
}
