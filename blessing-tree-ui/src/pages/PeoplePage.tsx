import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { buildCampaignPeoplePath, routes } from '@/app/routes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { CampaignPeopleWorkspace } from '@/features/campaigns/ui/CampaignPeopleWorkspace';
import { useCampaignPeopleWorkspace } from '@/features/campaigns/model/useCampaignPeopleWorkspace';

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
    saveWishlist,
    saveWishlistItem,
    removeWishlistItem,
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
    <CampaignPeopleWorkspace
      campaignName={campaign?.name ?? 'Campaign'}
      access={campaign?.userAccess ?? null}
      workspace={workspace}
      isLoading={isLoading}
      isSaving={isSaving}
      error={error}
      saveMessage={saveMessage}
      onSaveGroup={saveGroup}
      onSaveContact={saveContact}
      onDeleteContact={removeContact}
      onSaveRecipient={saveRecipient}
      onSaveWishlist={saveWishlist}
      onSaveWishlistItem={saveWishlistItem}
      onDeleteWishlistItem={removeWishlistItem}
      onClearSaveMessage={clearSaveMessage}
      onClearError={clearError}
    />
  );
}

export function LegacyFamiliesRedirectPage() {
  const { selectedCampaignId } = useCampaigns();

  if (selectedCampaignId) {
    return <Navigate to={buildCampaignPeoplePath(selectedCampaignId)} replace />;
  }

  return <Navigate to={routes.CAMPAIGNS} replace />;
}
