import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { useCampaignPeopleWorkspace } from '@/features/campaigns/model/useCampaignPeopleWorkspace';
import type { PeopleWorkspaceOutletContext } from '@/features/campaigns/model/peopleWorkspaceContext';

export function PeoplePage() {
  const { campaignId = null } = useParams();
  const {
    campaigns,
    selectedCampaignId,
    selectCampaign,
    isLoading: isLoadingCampaigns,
  } = useCampaigns();
  const {
    workspace,
    isLoading,
    isSaving,
    error,
    saveMessage,
    saveGroup,
    saveContact,
    removeContact,
    saveRecipient,
    removeGroup,
    removeRecipient,
    saveWishlist,
    saveWishlistItem,
    removeWishlistItem,
    searchAddresses,
    clearSaveMessage,
    clearError,
  } = useCampaignPeopleWorkspace(campaignId);

  useEffect(() => {
    if (!campaignId) {
      return;
    }

    if (selectedCampaignId !== campaignId) {
      selectCampaign(campaignId);
    }
  }, [campaignId, selectCampaign, selectedCampaignId]);

  if (!campaignId) {
    return null;
  }

  if (isLoadingCampaigns && campaigns.length === 0) {
    return <p className="text-muted">Loading campaigns...</p>;
  }

  const campaign = campaigns.find((item) => item.id === campaignId) ?? null;

  if (!campaign && !isLoading && !workspace) {
    return (
      <div className="alert alert-danger" role="alert">
        Campaign access was not found for this People workspace.
      </div>
    );
  }

  return (
    <div className="vstack gap-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <div className="campaign-chip-row mb-3">
            <span className="campaign-chip campaign-chip-muted">
              {campaign?.name ?? 'Campaign'}
            </span>
            {workspace ? (
              <>
                <span className="campaign-chip campaign-chip-muted">
                  {workspace.counts.householdCount} households
                </span>
                <span className="campaign-chip campaign-chip-muted">
                  {workspace.counts.organizationCount} organizations
                </span>
              </>
            ) : null}
          </div>
          <h1 className="h3 mb-1">People</h1>
          <p className="text-muted mb-0">
            Use Intake for new family or organization entry, and Directory to search and maintain existing households, organizations, people, and wishlists.
          </p>
        </div>
      </div>

      <Outlet
        context={{
          campaignId,
          campaignName: campaign?.name ?? 'Campaign',
          access: campaign?.userAccess ?? null,
          workspace,
          isLoading,
          isSaving,
          error,
          saveMessage,
          onSaveGroup: saveGroup,
          onSaveContact: saveContact,
          onDeleteContact: removeContact,
          onSaveRecipient: saveRecipient,
          onDeleteGroup: removeGroup,
          onDeleteRecipient: removeRecipient,
          onSaveWishlist: saveWishlist,
          onSaveWishlistItem: saveWishlistItem,
          onDeleteWishlistItem: removeWishlistItem,
          onSearchAddresses: searchAddresses,
          onClearSaveMessage: clearSaveMessage,
          onClearError: clearError,
        } satisfies PeopleWorkspaceOutletContext}
      />
    </div>
  );
}
