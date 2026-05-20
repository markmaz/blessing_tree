import type { CampaignReadiness } from '@/features/campaigns/model/campaignStudioTypes';
import type { CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';

interface CampaignStudioReadinessSectionProps {
  readiness: CampaignReadiness;
  onSelectSection: (sectionId: CampaignStudioSectionId) => void;
}

export function CampaignStudioReadinessSection({
  readiness,
  onSelectSection,
}: CampaignStudioReadinessSectionProps) {
  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Readiness"
        title="Launch and Setup Gaps"
        description="These checks come directly from the backend readiness evaluator and show what still needs attention."
      >
        <div className="campaign-studio__stat-grid mb-4">
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Status</span>
            <strong>{readiness.status}</strong>
          </div>
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Warnings</span>
            <strong>{readiness.counts.warnings}</strong>
          </div>
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Errors</span>
            <strong>{readiness.counts.errors}</strong>
          </div>
        </div>

        <div className="campaign-studio__readiness-list">
          {readiness.items.length === 0 ? (
            <div className="campaign-studio__readiness-item healthy">
              <span className="campaign-studio__readiness-indicator" aria-hidden="true" />
              <span>The campaign is currently ready from the backend readiness perspective.</span>
            </div>
          ) : (
            readiness.items.map((item) => (
              <div
                key={`${item.code}-${item.section}`}
                className={`campaign-studio__readiness-item ${
                  item.severity === 'error' || item.severity === 'warning'
                    ? 'needs-attention'
                    : 'healthy'
                }`}
              >
                <span className="campaign-studio__readiness-indicator" aria-hidden="true" />
                <div className="campaign-studio__readiness-content">
                  <div className="fw-semibold">{item.message}</div>
                  <button
                    type="button"
                    className="btn btn-link btn-sm px-0"
                    onClick={() => onSelectSection(toStudioSectionId(item.section))}
                  >
                    Open {item.section}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CampaignStudioSectionCard>
    </div>
  );
}

function toStudioSectionId(section: string): CampaignStudioSectionId {
  if (section === 'communications') {
    return 'communications';
  }
  if (section === 'dates' || section === 'schedule') {
    return 'schedule';
  }
  if (section === 'team') {
    return 'team';
  }
  return 'settings';
}
