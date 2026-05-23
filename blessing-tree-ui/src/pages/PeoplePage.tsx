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
  );
}
