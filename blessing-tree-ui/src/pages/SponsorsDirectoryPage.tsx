import { useSponsorWorkspaceContext } from '@/features/campaigns/model/sponsorWorkspaceContext';
import { CampaignSponsorsWorkspace } from '@/features/campaigns/ui/CampaignSponsorsWorkspace';
import { WorkspacePageHeader } from '@/shared/ui/WorkspacePageHeader';

export function SponsorsDirectoryPage() {
  const {
    campaignName,
    access,
    workspace,
    pendingRegistrations,
    pendingRegistrationError,
    communicationTemplates,
    communicationTemplateError,
    isLoading,
    isSaving,
    error,
    interactionsBySponsor,
    onLoadSponsorInteractions,
    onPreviewCommunication,
    onSendCommunication,
    onRevokeDropoffToken,
    onRegenerateDropoffToken,
    onCommitGift,
    onSaveSponsor,
    onDeleteSponsor,
    onSaveInteraction,
    onDeleteInteraction,
    onResendPendingRegistration,
    onCancelPendingRegistration,
    onVerifyPendingRegistration,
    onClearError,
  } = useSponsorWorkspaceContext();

  return (
    <section className="campaign-page-stack">
      <WorkspacePageHeader
        title="Sponsors Directory"
        description="Search and maintain sponsors, campaign participation, sponsored gifts, and communication history for this campaign."
      />

      <CampaignSponsorsWorkspace
        campaignName={campaignName}
        access={access}
        workspace={workspace}
        pendingRegistrations={pendingRegistrations}
        pendingRegistrationError={pendingRegistrationError}
        communicationTemplates={communicationTemplates}
        communicationTemplateError={communicationTemplateError}
        isLoading={isLoading}
        isSaving={isSaving}
        error={error}
        interactionsBySponsor={interactionsBySponsor}
        onLoadSponsorInteractions={onLoadSponsorInteractions}
        onPreviewCommunication={onPreviewCommunication}
        onSendCommunication={onSendCommunication}
        onRevokeDropoffToken={onRevokeDropoffToken}
        onRegenerateDropoffToken={onRegenerateDropoffToken}
        onCommitGift={onCommitGift}
        onSaveSponsor={onSaveSponsor}
        onDeleteSponsor={onDeleteSponsor}
        onSaveInteraction={onSaveInteraction}
        onDeleteInteraction={onDeleteInteraction}
        onResendPendingRegistration={onResendPendingRegistration}
        onCancelPendingRegistration={onCancelPendingRegistration}
        onVerifyPendingRegistration={onVerifyPendingRegistration}
        onClearError={onClearError}
        showCreateActions={false}
      />
    </section>
  );
}
