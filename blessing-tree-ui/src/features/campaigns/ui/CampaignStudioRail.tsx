import type {
  CampaignStudioSection,
  CampaignStudioSectionId,
} from '@/features/campaigns/model/campaignStudio';

interface CampaignStudioRailProps {
  sections: CampaignStudioSection[];
  selectedSection: CampaignStudioSectionId;
  onSelectSection: (sectionId: CampaignStudioSectionId) => void;
}

export function CampaignStudioRail({
  sections,
  selectedSection,
  onSelectSection,
}: CampaignStudioRailProps) {
  return (
    <aside className="campaign-studio__rail" aria-label="Campaign Studio sections">
      <div className="campaign-studio__rail-header">
        <div className="campaign-studio__eyebrow">Campaign Studio</div>
        <h2 className="campaign-studio__rail-title">Build Surface</h2>
        <p className="text-muted mb-0 small">
          Move through the campaign one operational layer at a time.
        </p>
      </div>

      <nav className="campaign-studio__nav">
        {sections.map((section) => {
          const isSelected = section.id === selectedSection;

          return (
            <button
              key={section.id}
              type="button"
              className={`campaign-studio__nav-item ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectSection(section.id)}
            >
              <div className="d-flex align-items-start gap-3">
                <span className="campaign-studio__nav-icon" aria-hidden="true">
                  <i className={`bi ${section.icon}`} />
                </span>
                <span className="text-start">
                  <span className="campaign-studio__nav-label">{section.label}</span>
                  <span className="campaign-studio__nav-description">
                    {section.description}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
