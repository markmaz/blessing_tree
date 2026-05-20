import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { routes } from '@/app/routes';
import {
  campaignStudioSections,
  type CampaignStudioSectionId,
} from '@/features/campaigns/model/campaignStudio';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { useCampaignOverview } from '@/features/campaigns/model/useCampaignOverview';
import { CampaignStudioAiRail } from '@/features/campaigns/ui/CampaignStudioAiRail';
import { CampaignStudioOverview } from '@/features/campaigns/ui/CampaignStudioOverview';
import { CampaignStudioRail } from '@/features/campaigns/ui/CampaignStudioRail';

function CampaignStudioSectionPlaceholder({
  sectionLabel,
}: {
  sectionLabel: string;
}) {
  return (
    <div className="campaign-studio__canvas-stack">
      <section className="campaign-surface-card">
        <div className="campaign-studio__card-eyebrow">{sectionLabel}</div>
        <h1 className="h4 mb-3">{sectionLabel} Builder</h1>
        <p className="text-muted mb-4">
          Phase 1 establishes the studio shell and overview surface. This
          section will become editable once its supporting APIs are added.
        </p>
        <div className="campaign-studio__placeholder-grid">
          <div className="campaign-studio__placeholder-card">
            <h2 className="h6 mb-2">Visible Representation</h2>
            <p className="small text-muted mb-0">
              This card area will show the structured state of the {sectionLabel.toLowerCase()}{' '}
              section instead of a plain settings form.
            </p>
          </div>
          <div className="campaign-studio__placeholder-card">
            <h2 className="h6 mb-2">Next API Dependency</h2>
            <p className="small text-muted mb-0">
              The next implementation phase will connect this section to its own
              create, update, and readiness endpoints.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function CampaignStudioPage() {
  const { campaignId = null } = useParams();
  const { selectedCampaignId, selectCampaign } = useCampaigns();
  const { campaign, access, summary, isLoading, error } = useCampaignOverview(campaignId);
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

  if (error || !campaign || !access || !summary) {
    return (
      <div className="alert alert-danger" role="alert">
        {error ?? 'Unable to load campaign studio.'}
      </div>
    );
  }

  const selectedSectionLabel =
    campaignStudioSections.find((section) => section.id === selectedSection)?.label ??
    'Overview';

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
            to={`/campaigns/${campaign.id}`}
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
          {selectedSection === 'overview' ? (
            <CampaignStudioOverview
              campaign={campaign}
              access={access}
              summary={summary}
            />
          ) : (
            <CampaignStudioSectionPlaceholder sectionLabel={selectedSectionLabel} />
          )}
        </main>

        <CampaignStudioAiRail
          campaign={campaign}
          selectedSection={selectedSection}
        />
      </div>
    </section>
  );
}
