import { useMemo, useState } from 'react';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import type { RecipientGroupType } from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';
import { usePeopleWorkspaceContext } from '@/features/campaigns/model/peopleWorkspaceContext';
import { CampaignPeopleGroupDrawer } from '@/features/campaigns/ui/CampaignPeopleGroupDrawer';
import { CampaignPeopleRecipientDrawer } from '@/features/campaigns/ui/CampaignPeopleRecipientDrawer';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';
import '@/features/campaigns/ui/campaignPeople.css';

export function PeopleIntakePage() {
  const {
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
  } = usePeopleWorkspaceContext();

  const canEditPeople =
    canManageCampaign(access) || access?.capabilities.includes('campaign.recipients.edit') === true;
  const [createGroupType, setCreateGroupType] = useState<RecipientGroupType | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [createRecipientGroupId, setCreateRecipientGroupId] = useState<string | null>(null);
  const [isCreateRecipientOpen, setIsCreateRecipientOpen] = useState(false);

  const selectedGroup =
    workspace?.groups.find((group) => group.id === selectedGroupId) ?? null;
  const selectedRecipient =
    workspace?.recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null;

  const recentGroups = useMemo(() => {
    if (!workspace) {
      return [];
    }

    return [...workspace.groups]
      .sort((left, right) => {
        const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 6);
  }, [workspace]);

  if (isLoading && !workspace) {
    return <p className="text-muted">Loading intake workspace...</p>;
  }

  if (!workspace) {
    return (
      <div className="alert alert-danger" role="alert">
        {error ?? 'Unable to load intake workspace.'}
      </div>
    );
  }

  return (
    <section className="campaign-page-stack">
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

      <div className="campaign-hero-card">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div className="campaign-chip-row mb-3">
              <span className="campaign-chip campaign-chip-muted">
                Intake
              </span>
              <span className="campaign-chip campaign-chip-muted">
                {workspace.counts.householdCount} families
              </span>
              <span className="campaign-chip campaign-chip-muted">
                {workspace.counts.careFacilityCount} facilities
              </span>
            </div>
            <h2 className="h4 mb-1">Start New Intake</h2>
            <p className="text-muted mb-0">
              Choose the type of intake you are entering, then stay in that flow to add children or residents and their wishlists.
            </p>
          </div>
        </div>
      </div>

      <div className="campaign-people-intake-grid">
        <button
          type="button"
          className="campaign-people-intake-card"
          onClick={() => {
            setCreateGroupType('HOUSEHOLD');
            setSelectedGroupId(null);
          }}
          disabled={!canEditPeople}
        >
          <span className="campaign-people-intake-card__icon">
            <i className="bi bi-house-heart" aria-hidden="true" />
          </span>
          <span className="campaign-people-intake-card__title">Add Family</span>
          <span className="campaign-people-intake-card__body">
            Create the family, add parent or guardian contacts, then add the children and their wishlists in one connected flow.
          </span>
        </button>

        <button
          type="button"
          className="campaign-people-intake-card"
          onClick={() => {
            setCreateGroupType('CARE_FACILITY');
            setSelectedGroupId(null);
          }}
          disabled={!canEditPeople}
        >
          <span className="campaign-people-intake-card__icon">
            <i className="bi bi-buildings" aria-hidden="true" />
          </span>
          <span className="campaign-people-intake-card__title">Add Facility</span>
          <span className="campaign-people-intake-card__body">
            Create the facility intake, add staff or social-worker contacts, then enter residents and their wishlists from the same place.
          </span>
        </button>
      </div>

      <section className="campaign-team-workspace__section">
        <div className="campaign-team-workspace__section-header">
          <div>
            <h2 className="h5 mb-1">Continue Recent Intake</h2>
            <p className="text-muted mb-0">
              Re-open a recently updated family or facility to keep adding children, residents, contacts, or wishlists.
            </p>
          </div>
        </div>

        <div className="campaign-team-inline-list">
          {recentGroups.length === 0 ? (
            <div className="campaign-studio__empty-note">
              No intake records yet. Start with Add Family or Add Facility.
            </div>
          ) : (
            recentGroups.map((group) => (
              <div key={group.id} className="campaign-team-inline-item campaign-team-inline-item--stacked">
                <div className="campaign-team-inline-item__content">
                  <strong>{group.groupName}</strong>
                  <div className="campaign-team-inline-meta">
                    <span className="campaign-chip campaign-chip-muted">
                      <i className={`bi ${group.groupType === 'HOUSEHOLD' ? 'bi-house-door' : 'bi-building'} me-1`} aria-hidden="true" />
                      {group.groupType === 'HOUSEHOLD' ? 'Family' : 'Facility'}
                    </span>
                    <span className="campaign-chip campaign-chip-muted">
                      <i className="bi bi-people me-1" aria-hidden="true" />
                      {group.recipientCount} people
                    </span>
                  </div>
                </div>
                <div className="campaign-team-inline-item__actions">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setCreateGroupType(null);
                      setSelectedGroupId(group.id);
                    }}
                  >
                    <i className="bi bi-arrow-right-circle me-2" aria-hidden="true" />
                    Continue Intake
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

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
          setCreateRecipientGroupId(selectedGroup?.id ?? null);
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
            setCreateRecipientGroupId(savedRecipient.recipientGroupId);
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
