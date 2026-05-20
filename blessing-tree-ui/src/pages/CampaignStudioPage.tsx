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

export function CampaignStudioPage() {
  const { campaignId = null } = useParams();
  const { selectedCampaignId, selectCampaign, reloadCampaigns } = useCampaigns();
  const {
    studio,
    isLoading,
    isSaving,
    error,
    saveMessage,
    reload,
    addAssignment,
    addCommunicationTemplate,
    addCommunicationSchedule,
    persistMilestones,
    addScheduleEvent,
    updateScheduleEvent,
    removeScheduleEvent,
    clearSaveMessage,
  } = useCampaignStudio(campaignId);
  const [selectedSection, setSelectedSection] =
    useState<CampaignStudioSectionId>('overview');
  const [isUpdatingCampaign, setIsUpdatingCampaign] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

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
          <Link to={routes.CAMPAIGNS} className="btn btn-outline-secondary btn-sm">
            Back to Campaigns
          </Link>
          <Link
            to={`/campaigns/${studio.campaign.id}`}
            className="btn btn-outline-secondary btn-sm"
          >
            Open Detail View
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
            <div className="alert alert-success" role="alert">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <span>{saveMessage}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={clearSaveMessage}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
          {updateMessage ? (
            <div className="alert alert-success" role="alert">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <span>{updateMessage}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => setUpdateMessage(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
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
            setSelectedSection,
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
            addAssignment,
            addCommunicationTemplate,
            addCommunicationSchedule,
            persistMilestones,
            addScheduleEvent,
            updateScheduleEvent,
            removeScheduleEvent,
          })}
        </main>

        <CampaignStudioAiRail
          campaign={studio.campaign}
          selectedSection={selectedSection}
        />
      </div>
    </section>
  );
}

function renderStudioSection({
  selectedSection,
  studio,
  isSaving,
  setSelectedSection,
  onUpdateCampaign,
  addAssignment,
  addCommunicationTemplate,
  addCommunicationSchedule,
  persistMilestones,
  addScheduleEvent,
  updateScheduleEvent,
  removeScheduleEvent,
}: {
  selectedSection: CampaignStudioSectionId;
  studio: NonNullable<ReturnType<typeof useCampaignStudio>['studio']>;
  isSaving: boolean;
  setSelectedSection: (sectionId: CampaignStudioSectionId) => void;
  onUpdateCampaign: (input: CampaignUpsertInput) => Promise<boolean>;
  addAssignment: ReturnType<typeof useCampaignStudio>['addAssignment'];
  addCommunicationTemplate: ReturnType<typeof useCampaignStudio>['addCommunicationTemplate'];
  addCommunicationSchedule: ReturnType<typeof useCampaignStudio>['addCommunicationSchedule'];
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
      />
    );
  }

  if (selectedSection === 'team') {
    return (
      <CampaignStudioTeamSection
        campaignId={studio.campaign.id}
        access={studio.access}
        team={studio.team}
        isSaving={isSaving}
        onAddAssignment={addAssignment}
      />
    );
  }

  if (selectedSection === 'communications') {
    return (
      <CampaignStudioCommunicationsSection
        templates={studio.communications.templates}
        schedules={studio.communications.schedules}
        isSaving={isSaving}
        onCreateTemplate={addCommunicationTemplate}
        onCreateSchedule={addCommunicationSchedule}
      />
    );
  }

  if (selectedSection === 'schedule') {
    return (
      <CampaignStudioScheduleSection
        access={studio.access}
        items={studio.schedule.items}
        milestones={studio.milestones}
        isSaving={isSaving}
        onSaveMilestones={persistMilestones}
        onCreateEvent={addScheduleEvent}
        onUpdateEvent={updateScheduleEvent}
        onDeleteEvent={removeScheduleEvent}
        onOpenCommunications={() => setSelectedSection('communications')}
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
