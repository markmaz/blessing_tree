import type {
  CampaignReadiness,
  CampaignReadinessItem,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';

interface CampaignStudioReadinessSectionProps {
  readiness: CampaignReadiness;
  onSelectSection: (sectionId: CampaignStudioSectionId) => void;
}

const readinessGroups: Array<{
  key: keyof CampaignReadiness['groups'];
  label: string;
  description: string;
}> = [
  {
    key: 'blockers',
    label: 'Blockers',
    description: 'These issues block the next campaign step until they are resolved.',
  },
  {
    key: 'launch_checks',
    label: 'Launch Checks',
    description: 'These checks should be resolved before the campaign is activated.',
  },
  {
    key: 'planning_gaps',
    label: 'Planning Gaps',
    description: 'These gaps do not block launch yet, but they weaken campaign setup.',
  },
  {
    key: 'operational_health',
    label: 'Operational Health',
    description: 'These checks will matter most once the campaign is actively running.',
  },
];

const phaseLabels: Record<keyof CampaignReadiness['phaseStatus'], string> = {
  draft: 'Draft',
  activate: 'Activate',
  operations: 'Operations',
  close: 'Close',
};

export function CampaignStudioReadinessSection({
  readiness,
  onSelectSection,
}: CampaignStudioReadinessSectionProps) {
  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Readiness"
        title="Launch and Setup Gaps"
        description="These checks come from the backend readiness evaluator and are grouped by what they mean for the campaign lifecycle."
      >
        <div className="campaign-studio__stat-grid campaign-studio__readiness-stat-grid mb-4">
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Overall</span>
            <strong>{toDisplayLabel(readiness.overallStatus)}</strong>
          </div>
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Blockers</span>
            <strong>{readiness.categoryCounts.blockers}</strong>
          </div>
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Launch Checks</span>
            <strong>{readiness.categoryCounts.launch_checks}</strong>
          </div>
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Planning Gaps</span>
            <strong>{readiness.categoryCounts.planning_gaps}</strong>
          </div>
        </div>

        <div className="campaign-studio__readiness-phase-grid">
          {Object.entries(readiness.phaseStatus).map(([phase, status]) => (
            <div
              key={phase}
              className={`campaign-studio__readiness-phase-card ${toPhaseClassName(status)}`}
            >
              <span className="campaign-studio__stat-label">
                {phaseLabels[phase as keyof CampaignReadiness['phaseStatus']]}
              </span>
              <strong>{toDisplayLabel(status)}</strong>
            </div>
          ))}
        </div>

        {readiness.items.length === 0 ? (
          <div className="campaign-studio__readiness-item healthy">
            <span className="campaign-studio__readiness-indicator" aria-hidden="true" />
            <span>The campaign is currently ready from the backend readiness perspective.</span>
          </div>
        ) : (
          <div className="campaign-studio__readiness-group-grid">
            {readinessGroups.map((group) => (
              <section key={group.key} className="campaign-studio__readiness-group-card">
                <div className="campaign-studio__readiness-group-header">
                  <div>
                    <h3 className="h6 mb-1">{group.label}</h3>
                    <p className="text-muted mb-0">{group.description}</p>
                  </div>
                  <span className="campaign-studio__readiness-group-count">
                    {readiness.groups[group.key].length}
                  </span>
                </div>

                <div className="campaign-studio__readiness-list">
                  {readiness.groups[group.key].length === 0 ? (
                    <div className="campaign-studio__empty-note">
                      No findings in this group right now.
                    </div>
                  ) : (
                    readiness.groups[group.key].map((item) => (
                      <ReadinessItemRow
                        key={`${group.key}-${item.code}-${item.section}`}
                        item={item}
                        onSelectSection={onSelectSection}
                      />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </CampaignStudioSectionCard>
    </div>
  );
}

function ReadinessItemRow({
  item,
  onSelectSection,
}: {
  item: CampaignReadinessItem;
  onSelectSection: (sectionId: CampaignStudioSectionId) => void;
}) {
  return (
    <div
      className={`campaign-studio__readiness-item ${
        item.severity === 'error' || item.severity === 'warning' ? 'needs-attention' : 'healthy'
      }`}
    >
      <span className="campaign-studio__readiness-indicator" aria-hidden="true" />
      <div className="campaign-studio__readiness-content">
        <div className="fw-semibold">{item.message}</div>
        <div className="campaign-studio__readiness-meta">
          <span className="campaign-chip campaign-chip-muted">{toDisplayLabel(item.severity)}</span>
          {item.blockingFor.length > 0 ? (
            <span className="campaign-chip campaign-chip-muted">
              Blocks {item.blockingFor.map(toDisplayLabel).join(', ')}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-link btn-sm px-0"
          onClick={() => onSelectSection(toStudioSectionId(item.section))}
        >
          {item.actionLabel}
        </button>
      </div>
    </div>
  );
}

function toDisplayLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function toPhaseClassName(status: CampaignReadiness['status']): string {
  if (status === 'BLOCKED') {
    return 'blocked';
  }
  if (status === 'NEEDS_ATTENTION') {
    return 'needs-attention';
  }
  return 'healthy';
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
  if (section === 'readiness') {
    return 'readiness';
  }
  return 'settings';
}
