import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommunicationTemplate } from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignStudioTemplateLibraryProps {
  templates: CommunicationTemplate[];
  selectedTemplateId: string | null;
  isPanelOpen: boolean;
  onSelectTemplate: (templateId: string) => void;
  onCreateNew: () => void;
  onDeleteTemplate: (templateId: string) => Promise<boolean>;
  onTogglePanel: () => void;
}

export function CampaignStudioTemplateLibrary({
  templates,
  selectedTemplateId,
  isPanelOpen,
  onSelectTemplate,
  onCreateNew,
  onDeleteTemplate,
  onTogglePanel,
}: CampaignStudioTemplateLibraryProps) {
  const [menuTemplateId, setMenuTemplateId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuTemplateId) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) {
        return;
      }
      setMenuTemplateId(null);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [menuTemplateId]);

  const deleteTarget = useMemo(
    () => templates.find((template) => template.id === deleteTargetId) ?? null,
    [deleteTargetId, templates]
  );

  return (
    <aside
      className={`campaign-template-library-shell ${isPanelOpen ? 'is-panel-open' : ''}`}
      aria-label="Saved communication templates"
    >
      <div className="campaign-template-library-toolbar" aria-label="Template rail controls">
        <button
          type="button"
          className={`campaign-template-library-toolbar__button ${isPanelOpen ? 'is-active' : ''}`}
          onClick={onTogglePanel}
          aria-label={isPanelOpen ? 'Collapse template files' : 'Open template files'}
          title={isPanelOpen ? 'Collapse template files' : 'Open template files'}
        >
          <i className={`bi ${isPanelOpen ? 'bi-layout-sidebar-inset' : 'bi-files'}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="campaign-template-library-toolbar__button"
          onClick={onCreateNew}
          aria-label="Create new template file"
          title="Create new template file"
        >
          <i className="bi bi-file-earmark-plus" aria-hidden="true" />
        </button>
      </div>

      {isPanelOpen ? (
        <div className="campaign-template-library-panel">
          <div className="campaign-template-library-panel__header">
            <div className="campaign-studio__eyebrow">Templates</div>
            <h3 className="h6 mb-0">Communication Files</h3>
          </div>

          <div className="campaign-template-library-panel__list">
            {templates.length === 0 ? (
              <div className="campaign-studio__empty-note">
                No templates yet. Create the first communication file.
              </div>
            ) : (
              templates.map((template) => {
                const isSelected = template.id === selectedTemplateId;
                const isMenuOpen = menuTemplateId === template.id;
                return (
                  <div
                    key={template.id}
                    className={`campaign-template-file ${isSelected ? 'is-selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="campaign-template-file__main"
                      onClick={() => onSelectTemplate(template.id)}
                      aria-label={`Open template ${template.name}`}
                    >
                      <div className="campaign-template-file__icon">
                        <i className="bi bi-file-earmark-text" aria-hidden="true" />
                      </div>
                      <div className="campaign-template-file__content">
                        <div className="campaign-template-file__name">{template.name}</div>
                        <div className="campaign-template-file__meta">
                          Created {formatTemplateDate(template.createdAt ?? template.updatedAt)}
                        </div>
                      </div>
                    </button>
                    <div className="campaign-template-file__actions" ref={isMenuOpen ? menuRef : null}>
                      <button
                        type="button"
                        className="campaign-template-file__menu-toggle"
                        aria-label={`Open actions for ${template.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTargetId(null);
                          setMenuTemplateId((currentValue) =>
                            currentValue === template.id ? null : template.id
                          );
                        }}
                      >
                        <i className="bi bi-three-dots" aria-hidden="true" />
                      </button>
                      {isMenuOpen ? (
                        <div className="campaign-template-file__menu">
                          <button
                            type="button"
                            className="campaign-template-file__menu-item is-danger"
                            onClick={() => {
                              setMenuTemplateId(null);
                              setDeleteTargetId(template.id);
                            }}
                          >
                            <i className="bi bi-trash3" aria-hidden="true" />
                            <span>Delete template</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {deleteTarget ? (
            <div className="campaign-template-library-panel__confirm">
              <div className="small text-muted">
                Delete <strong>{deleteTarget.name}</strong>? This removes the file from the library.
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    void (async () => {
                      const deleted = await onDeleteTemplate(deleteTarget.id);
                      if (deleted) {
                        setDeleteTargetId(null);
                      }
                    })();
                  }}
                >
                  <i className="bi bi-trash3 me-2" aria-hidden="true" />
                  Delete
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setDeleteTargetId(null)}
                >
                  <i className="bi bi-x-lg me-2" aria-hidden="true" />
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function formatTemplateDate(value: string | null): string {
  if (!value) {
    return 'unknown date';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'unknown date';
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
