import { getTemplateBodySummary } from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
import type { CommunicationTemplate } from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignStudioTemplateLibraryProps {
  templates: CommunicationTemplate[];
  selectedTemplateId: string | null;
  isCollapsed: boolean;
  onSelectTemplate: (templateId: string) => void;
  onCreateNew: () => void;
  onToggleCollapsed: () => void;
}

export function CampaignStudioTemplateLibrary({
  templates,
  selectedTemplateId,
  isCollapsed,
  onSelectTemplate,
  onCreateNew,
  onToggleCollapsed,
}: CampaignStudioTemplateLibraryProps) {
  return (
    <aside
      className={`campaign-template-library ${isCollapsed ? 'is-collapsed' : ''}`}
      aria-label="Saved communication templates"
    >
      <div className="campaign-template-library__header">
        {!isCollapsed ? (
          <div>
            <div className="campaign-studio__eyebrow">Templates</div>
            <h3 className="h6 mb-1">Saved Templates</h3>
            <p className="text-muted small mb-0">
              Start a new draft or reopen an existing email template.
            </p>
          </div>
        ) : null}
        <button
          type="button"
          className="campaign-template-library__utility-button"
          onClick={onCreateNew}
          aria-label="New template"
          title="New template"
        >
          <i className="bi bi-plus-lg" aria-hidden="true" />
          {!isCollapsed ? <span>New</span> : null}
        </button>
        <button
          type="button"
          className="campaign-template-library__utility-button"
          onClick={onToggleCollapsed}
          aria-label={isCollapsed ? 'Expand saved templates' : 'Collapse saved templates'}
          title={isCollapsed ? 'Expand saved templates' : 'Collapse saved templates'}
        >
          <i className={`bi ${isCollapsed ? 'bi-layout-sidebar-inset-reverse' : 'bi-layout-sidebar-inset'}`} aria-hidden="true" />
          {!isCollapsed ? <span>{isCollapsed ? 'Expand' : 'Collapse'}</span> : null}
        </button>
      </div>

      {!isCollapsed ? (
        <div className="campaign-template-library__list">
          {templates.length === 0 ? (
            <div className="campaign-studio__empty-note">
              No templates yet. Start the first sponsor, volunteer, or family email.
            </div>
          ) : (
            templates.map((template) => {
              const isSelected = template.id === selectedTemplateId;
              return (
                <button
                  key={template.id}
                  type="button"
                  className={`campaign-template-library__item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelectTemplate(template.id)}
                >
                  <div className="campaign-template-library__item-title-row">
                    <span className="campaign-template-library__item-title">{template.name}</span>
                    <span className="campaign-template-badge">{template.audience}</span>
                  </div>
                  <div className="campaign-template-library__item-meta">
                    {template.templateKey}
                  </div>
                  <div className="campaign-template-library__item-subject">
                    {template.subjectTemplate}
                  </div>
                  <div className="campaign-template-library__item-summary">
                    {getTemplateBodySummary(template)}
                  </div>
                  {!template.isActive ? (
                    <div className="campaign-template-library__item-status">
                      Inactive
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="campaign-template-library__collapsed-note">
          <div className="campaign-template-library__collapsed-count">{templates.length}</div>
          <div className="campaign-template-library__collapsed-label">templates</div>
        </div>
      )}
    </aside>
  );
}
