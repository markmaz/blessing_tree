import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { routes } from '@/app/routes';
import { updateCampaign } from '@/features/campaigns/api/campaignApi';
import {
  campaignStudioSections,
  type CampaignStudioSectionId,
} from '@/features/campaigns/model/campaignStudio';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import type { CampaignUpsertInput } from '@/features/campaigns/model/campaignTypes';
import { CampaignStudioAiRail } from '@/features/campaigns/ui/CampaignStudioAiRail';
import { CampaignStudioCommunicationsSection } from '@/features/campaigns/ui/CampaignStudioCommunicationsSection';
import { CampaignStudioOverview } from '@/features/campaigns/ui/CampaignStudioOverview';
import { CampaignStudioReadinessSection } from '@/features/campaigns/ui/CampaignStudioReadinessSection';
import { CampaignStudioRail } from '@/features/campaigns/ui/CampaignStudioRail';
import { CampaignStudioScheduleSection } from '@/features/campaigns/ui/CampaignStudioScheduleSection';
import { CampaignStudioTeamSection } from '@/features/campaigns/ui/CampaignStudioTeamSection';
import { useCampaignStudio } from '@/features/campaigns/model/useCampaignStudio';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import { CampaignEditorForm } from '@/features/campaigns/ui/CampaignEditorForm';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';
import { useAppFeatures } from '@/features/admin/model/appFeaturesContext';

export function CampaignStudioPage() {
  const { isFeatureEnabled } = useAppFeatures();
  const { campaignId = null } = useParams();
  const { selectedCampaignId, selectCampaign, reloadCampaigns } = useCampaigns();
  const {
    studio,
    isLoading,
    isSaving,
    error,
    saveMessage,
    reload,
    addCommunicationTemplate,
    patchCommunicationTemplate,
    removeCommunicationTemplate,
    addCommunicationSchedule,
    patchCommunicationSchedule,
    removeCommunicationSchedule,
    persistMilestones,
    addScheduleEvent,
    updateScheduleEvent,
    removeScheduleEvent,
    clearSaveMessage,
  } = useCampaignStudio(campaignId);
  const [selectedSection, setSelectedSection] =
    useState<CampaignStudioSectionId>('overview');
  const [isAiRailOpen, setIsAiRailOpen] = useState(false);
  const [teamWorkspaceRefreshToken, setTeamWorkspaceRefreshToken] = useState(0);
  const [communicationTemplateFocusId, setCommunicationTemplateFocusId] = useState<string | null>(null);
  const [isUpdatingCampaign, setIsUpdatingCampaign] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const campaignAiEnabled = isFeatureEnabled('campaign_ai');

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

  if (isLoading) {
    return <p className="text-muted">Loading campaign studio...</p>;
  }

  if (error || !studio) {
    return (
      <div className="alert alert-danger" role="alert">
        {error ?? 'Unable to load campaign studio.'}
      </div>
    );
  }

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Campaign Studio</h1>
          <p className="text-muted mb-0">
            Build the campaign in one visible workspace with cards, section
            rails, and an AI planning panel.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {campaignAiEnabled ? (
            <button
              type="button"
              className={`btn btn-sm d-inline-flex align-items-center gap-2 ${
                isAiRailOpen ? 'btn-secondary' : 'btn-outline-secondary'
              }`}
              onClick={() => setIsAiRailOpen((currentValue) => !currentValue)}
            >
              <i className={`bi ${isAiRailOpen ? 'bi-stars' : 'bi-robot'}`} aria-hidden="true" />
              <span>{isAiRailOpen ? 'Hide AI Panel' : 'Open AI Panel'}</span>
            </button>
          ) : null}
          <Link
            to={routes.CAMPAIGNS}
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
          >
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span>Back to Campaigns</span>
          </Link>
          <Link
            to={`/campaigns/${studio.campaign.id}`}
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
          >
            <i className="bi bi-layout-text-window-reverse" aria-hidden="true" />
            <span>Open Detail View</span>
          </Link>
        </div>
      </div>

      <div className="campaign-studio">
      <CampaignStudioRail
          sections={campaignStudioSections}
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
        />

        <main className="campaign-studio__canvas" aria-label="Campaign Studio canvas">
          {saveMessage ? (
            <AutoDismissAlert
              key={saveMessage}
              message={saveMessage}
              onDismiss={clearSaveMessage}
            />
          ) : null}
          {updateMessage ? (
            <AutoDismissAlert
              key={updateMessage}
              message={updateMessage}
              onDismiss={() => setUpdateMessage(null)}
            />
          ) : null}
          {updateError ? (
            <div className="alert alert-danger" role="alert">
              {updateError}
            </div>
          ) : null}
          {renderStudioSection({
            selectedSection,
            studio,
            isSaving: isSaving || isUpdatingCampaign,
            teamWorkspaceRefreshToken,
            communicationTemplateFocusId,
            setSelectedSection,
            setCommunicationTemplateFocusId,
            onUpdateCampaign: async (input) => {
              setIsUpdatingCampaign(true);
              setUpdateError(null);
              setUpdateMessage(null);

              try {
                await updateCampaign(campaignId, input);
                await Promise.all([reloadCampaigns(), reload()]);
                setSelectedSection('overview');
                setUpdateMessage('Campaign updated.');
                return true;
              } catch (updateCampaignError) {
                setUpdateError(
                  updateCampaignError instanceof Error
                    ? updateCampaignError.message
                    : 'Unable to update campaign'
                );
                return false;
              } finally {
                setIsUpdatingCampaign(false);
              }
            },
            addCommunicationTemplate,
            patchCommunicationTemplate,
            removeCommunicationTemplate,
            addCommunicationSchedule,
            patchCommunicationSchedule,
            removeCommunicationSchedule,
            persistMilestones,
            addScheduleEvent,
            updateScheduleEvent,
            removeScheduleEvent,
          })}
        </main>

        {campaignAiEnabled && isAiRailOpen ? (
          <button
            type="button"
            className="campaign-studio__ai-backdrop"
            aria-label="Close AI panel backdrop"
            onClick={() => setIsAiRailOpen(false)}
          />
        ) : null}
        {campaignAiEnabled ? (
          <CampaignStudioAiRail
            open={isAiRailOpen}
            onClose={() => setIsAiRailOpen(false)}
            campaign={studio.campaign}
            selectedSection={selectedSection}
            readiness={studio.readiness}
            scheduleItems={studio.schedule.items}
            templates={studio.communications.templates}
            milestones={studio.milestones}
            isSaving={isSaving || isUpdatingCampaign}
            onCreateScheduleEvent={addScheduleEvent}
            onCreateCommunicationTemplate={addCommunicationTemplate}
            onCreateCommunicationSchedule={addCommunicationSchedule}
            onSaveMilestones={persistMilestones}
            onTeamWorkspaceChanged={async () => {
              setTeamWorkspaceRefreshToken((currentValue) => currentValue + 1);
              await reload();
            }}
            onUpdateCampaignSettings={async (input) => {
              setIsUpdatingCampaign(true);
              setUpdateError(null);
              setUpdateMessage(null);

              try {
                await updateCampaign(campaignId, input);
                await Promise.all([reloadCampaigns(), reload()]);
                setUpdateMessage('Campaign updated.');
                return true;
              } catch (updateCampaignError) {
                setUpdateError(
                  updateCampaignError instanceof Error
                    ? updateCampaignError.message
                    : 'Unable to update campaign'
                );
                return false;
              } finally {
                setIsUpdatingCampaign(false);
              }
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function renderStudioSection({
  selectedSection,
  studio,
  isSaving,
  teamWorkspaceRefreshToken,
  communicationTemplateFocusId,
  setSelectedSection,
  setCommunicationTemplateFocusId,
  onUpdateCampaign,
  addCommunicationTemplate,
  patchCommunicationTemplate,
  removeCommunicationTemplate,
  addCommunicationSchedule,
  patchCommunicationSchedule,
  removeCommunicationSchedule,
  persistMilestones,
  addScheduleEvent,
  updateScheduleEvent,
  removeScheduleEvent,
}: {
  selectedSection: CampaignStudioSectionId;
  studio: NonNullable<ReturnType<typeof useCampaignStudio>['studio']>;
  isSaving: boolean;
  teamWorkspaceRefreshToken: number;
  communicationTemplateFocusId: string | null;
  setSelectedSection: (sectionId: CampaignStudioSectionId) => void;
  setCommunicationTemplateFocusId: (templateId: string | null) => void;
  onUpdateCampaign: (input: CampaignUpsertInput) => Promise<boolean>;
  addCommunicationTemplate: ReturnType<typeof useCampaignStudio>['addCommunicationTemplate'];
  patchCommunicationTemplate: ReturnType<typeof useCampaignStudio>['patchCommunicationTemplate'];
  removeCommunicationTemplate: ReturnType<typeof useCampaignStudio>['removeCommunicationTemplate'];
  addCommunicationSchedule: ReturnType<typeof useCampaignStudio>['addCommunicationSchedule'];
  patchCommunicationSchedule: ReturnType<typeof useCampaignStudio>['patchCommunicationSchedule'];
  removeCommunicationSchedule: ReturnType<typeof useCampaignStudio>['removeCommunicationSchedule'];
  persistMilestones: ReturnType<typeof useCampaignStudio>['persistMilestones'];
  addScheduleEvent: ReturnType<typeof useCampaignStudio>['addScheduleEvent'];
  updateScheduleEvent: ReturnType<typeof useCampaignStudio>['updateScheduleEvent'];
  removeScheduleEvent: ReturnType<typeof useCampaignStudio>['removeScheduleEvent'];
}) {
  if (selectedSection === 'overview') {
    return (
      <CampaignStudioOverview
        studio={studio}
        onEditCampaign={() => setSelectedSection('settings')}
        onOpenCommunication={(templateId) => {
          setCommunicationTemplateFocusId(templateId);
          setSelectedSection('communications');
        }}
      />
    );
  }

  if (selectedSection === 'team') {
    return (
      <CampaignStudioTeamSection
        campaignId={studio.campaign.id}
        access={studio.access}
        refreshToken={teamWorkspaceRefreshToken}
      />
    );
  }

  if (selectedSection === 'communications') {
    return (
      <CampaignStudioCommunicationsSection
        templates={studio.communications.templates}
        isSaving={isSaving}
        requestedTemplateId={communicationTemplateFocusId}
        onConsumeRequestedTemplate={() => setCommunicationTemplateFocusId(null)}
        onCreateTemplate={addCommunicationTemplate}
        onUpdateTemplate={patchCommunicationTemplate}
        onDeleteTemplate={removeCommunicationTemplate}
      />
    );
  }

  if (selectedSection === 'schedule') {
    return (
      <CampaignStudioScheduleSection
        access={studio.access}
        items={studio.schedule.items}
        milestones={studio.milestones}
        schedules={studio.communications.schedules}
        templates={studio.communications.templates}
        isSaving={isSaving}
        onSaveMilestones={persistMilestones}
        onCreateEvent={addScheduleEvent}
        onUpdateEvent={updateScheduleEvent}
        onDeleteEvent={removeScheduleEvent}
        onCreateSchedule={addCommunicationSchedule}
        onUpdateSchedule={patchCommunicationSchedule}
        onDeleteSchedule={removeCommunicationSchedule}
      />
    );
  }

  if (selectedSection === 'readiness') {
    return (
      <CampaignStudioReadinessSection
        readiness={studio.readiness}
        onSelectSection={setSelectedSection}
      />
    );
  }

  return (
    <div className="campaign-studio__canvas-stack">
      {canManageCampaign(studio.access) ? (
        <CampaignStudioSectionCard
          eyebrow="Settings"
          title="Campaign Settings"
          description="Update the campaign metadata, lifecycle, and operating dates without leaving Studio."
        >
          <CampaignEditorForm
            campaign={studio.campaign}
            title="Edit Campaign Setup"
            description="Changes here feed directly into the campaign overview, detail page, and Studio cards."
            submitLabel="Save Campaign"
            isSaving={isSaving}
            showHeader={false}
            onSubmit={onUpdateCampaign}
          />
        </CampaignStudioSectionCard>
      ) : (
        <CampaignStudioSectionCard
          eyebrow="Settings"
          title="Campaign Settings"
          description="Campaign settings are available only to managers and app admins."
        >
          <div className="campaign-studio__empty-note">
            You do not currently have the `campaign.admin` capability for this campaign.
          </div>
        </CampaignStudioSectionCard>
      )}
    </div>
  );
}
