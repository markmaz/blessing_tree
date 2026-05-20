import type { CommunicationTemplate } from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignStudioTemplateLibraryProps {
  templates: CommunicationTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  onCreateNew: () => void;
}

export function CampaignStudioTemplateLibrary({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onCreateNew,
}: CampaignStudioTemplateLibraryProps) {
  return (
    <aside className="campaign-template-library" aria-label="Saved communication templates">
      <div className="campaign-template-library__header">
        <div>
          <div className="campaign-studio__eyebrow">Templates</div>
          <h3 className="h6 mb-1">Saved Templates</h3>
          <p className="text-muted small mb-0">
            Start a new draft or reopen an existing email template.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onCreateNew}
        >
          <i className="bi bi-plus-lg" aria-hidden="true" /> New
        </button>
      </div>

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
                  <span className="campaign-chip">{template.audience}</span>
                </div>
                <div className="campaign-template-library__item-meta">
                  {template.templateKey}
                </div>
                <div className="campaign-template-library__item-subject">
                  {template.subjectTemplate}
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
    </aside>
  );
}
