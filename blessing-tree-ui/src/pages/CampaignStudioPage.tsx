import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { routes } from '@/app/routes';
import {
  campaignStudioSections,
  type CampaignStudioSectionId,
} from '@/features/campaigns/model/campaignStudio';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { CampaignStudioAiRail } from '@/features/campaigns/ui/CampaignStudioAiRail';
import { CampaignStudioCommunicationsSection } from '@/features/campaigns/ui/CampaignStudioCommunicationsSection';
import { CampaignStudioDatesSection } from '@/features/campaigns/ui/CampaignStudioDatesSection';
import { CampaignStudioOverview } from '@/features/campaigns/ui/CampaignStudioOverview';
import { CampaignStudioReadinessSection } from '@/features/campaigns/ui/CampaignStudioReadinessSection';
import { CampaignStudioRail } from '@/features/campaigns/ui/CampaignStudioRail';
import { CampaignStudioTeamSection } from '@/features/campaigns/ui/CampaignStudioTeamSection';
import { useCampaignStudio } from '@/features/campaigns/model/useCampaignStudio';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';

export function CampaignStudioPage() {
  const { campaignId = null } = useParams();
  const { selectedCampaignId, selectCampaign } = useCampaigns();
  const {
    studio,
    isLoading,
    isSaving,
    error,
    saveMessage,
    addCommunicationTemplate,
    addCommunicationSchedule,
    persistMilestones,
    clearSaveMessage,
  } = useCampaignStudio(campaignId);
  const [selectedSection, setSelectedSection] =
    useState<CampaignStudioSectionId>('overview');

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
          {renderStudioSection({
            selectedSection,
            studio,
            isSaving,
            setSelectedSection,
            addCommunicationTemplate,
            addCommunicationSchedule,
            persistMilestones,
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
  addCommunicationTemplate,
  addCommunicationSchedule,
  persistMilestones,
}: {
  selectedSection: CampaignStudioSectionId;
  studio: NonNullable<ReturnType<typeof useCampaignStudio>['studio']>;
  isSaving: boolean;
  setSelectedSection: (sectionId: CampaignStudioSectionId) => void;
  addCommunicationTemplate: ReturnType<typeof useCampaignStudio>['addCommunicationTemplate'];
  addCommunicationSchedule: ReturnType<typeof useCampaignStudio>['addCommunicationSchedule'];
  persistMilestones: ReturnType<typeof useCampaignStudio>['persistMilestones'];
}) {
  if (selectedSection === 'overview') {
    return <CampaignStudioOverview studio={studio} />;
  }

  if (selectedSection === 'team') {
    return <CampaignStudioTeamSection team={studio.team} />;
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

  if (selectedSection === 'dates') {
    return (
      <CampaignStudioDatesSection
        key={studio.milestones.map((milestone) => `${milestone.milestoneKey}:${milestone.occursOn ?? ''}:${milestone.updatedAt ?? ''}`).join('|')}
        milestones={studio.milestones}
        isSaving={isSaving}
        onSave={persistMilestones}
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
      <CampaignStudioSectionCard
        eyebrow="Settings"
        title="Campaign Settings"
        description="This section will become the launch point for campaign metadata editing and lifecycle actions."
      >
        <div className="campaign-studio__empty-note">
          Settings remain read-only in this phase. The next step is wiring create/update
          campaign UI for admins on top of the existing backend campaign routes.
        </div>
      </CampaignStudioSectionCard>
    </div>
  );
}
