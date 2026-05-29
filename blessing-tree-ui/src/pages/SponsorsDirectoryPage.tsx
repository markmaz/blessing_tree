import { useSponsorWorkspaceContext } from '@/features/campaigns/model/sponsorWorkspaceContext';
import { CampaignSponsorsWorkspace } from '@/features/campaigns/ui/CampaignSponsorsWorkspace';

export function SponsorsDirectoryPage() {
  const {
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
      <div>
        <h1 className="h3 mb-1">Sponsors Directory</h1>
        <p className="text-muted mb-0">
          Search and maintain sponsors, campaign participation, sponsored gifts, and communication history for this campaign.
        </p>
      </div>

      <CampaignSponsorsWorkspace
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
