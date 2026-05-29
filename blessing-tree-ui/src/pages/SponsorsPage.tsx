import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import type { SponsorWorkspaceOutletContext } from '@/features/campaigns/model/sponsorWorkspaceContext';
import { useCampaignSponsorWorkspace } from '@/features/campaigns/model/useCampaignSponsorWorkspace';

export function SponsorsPage() {
  const { campaignId = null } = useParams();
  const {
    campaigns,
    selectedCampaignId,
    selectCampaign,
    isLoading: isLoadingCampaigns,
  } = useCampaigns();
  const {
    workspace,
    pendingRegistrations,
    pendingRegistrationError,
    communicationTemplates,
    communicationTemplateError,
    isLoading,
    isSaving,
    error,
    saveMessage,
    interactionsBySponsor,
    loadSponsorInteractions,
    previewCommunication,
    sendCommunication,
    saveSponsor,
    removeSponsor,
    saveInteraction,
    removeInteraction,
    resendPendingRegistration,
    cancelPendingRegistration,
    verifyPendingRegistration,
    clearSaveMessage,
    clearError,
  } = useCampaignSponsorWorkspace(campaignId);

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
        Campaign access was not found for this Sponsors workspace.
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
        pendingRegistrations,
        pendingRegistrationError,
        communicationTemplates,
        communicationTemplateError,
        isLoading,
        isSaving,
        error,
        saveMessage,
        interactionsBySponsor,
        onLoadSponsorInteractions: loadSponsorInteractions,
        onPreviewCommunication: previewCommunication,
        onSendCommunication: sendCommunication,
        onSaveSponsor: saveSponsor,
        onDeleteSponsor: removeSponsor,
        onSaveInteraction: saveInteraction,
        onDeleteInteraction: removeInteraction,
        onResendPendingRegistration: resendPendingRegistration,
        onCancelPendingRegistration: cancelPendingRegistration,
        onVerifyPendingRegistration: verifyPendingRegistration,
        onClearSaveMessage: clearSaveMessage,
        onClearError: clearError,
      } satisfies SponsorWorkspaceOutletContext}
    />
  );
}
