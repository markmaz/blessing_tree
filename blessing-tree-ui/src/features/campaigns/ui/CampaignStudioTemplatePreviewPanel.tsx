import { useState } from 'react';
import {
  renderTemplateBlocksPreview,
  renderTemplateText,
  type CommunicationTemplateBlock,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
import { CampaignStudioTemplateMergeFieldDrawer } from '@/features/campaigns/ui/CampaignStudioTemplateMergeFieldDrawer';

interface CampaignStudioTemplatePreviewPanelProps {
  subjectTemplate: string;
  blocks: CommunicationTemplateBlock[];
  onInsertMergeField: (field: string) => void;
}

export function CampaignStudioTemplatePreviewPanel({
  subjectTemplate,
  blocks,
  onInsertMergeField,
}: CampaignStudioTemplatePreviewPanelProps) {
  const [isMergeDrawerOpen, setIsMergeDrawerOpen] = useState(false);
  const renderedBlocks = renderTemplateBlocksPreview(blocks);

  return (
    <div className="campaign-template-workspace__preview-column">
      <div className="campaign-template-preview-shell">
        <div className="campaign-template-preview-shell__header">
          <div>
            <span className="campaign-studio__eyebrow">Rendered Preview</span>
            <div className="campaign-template-preview-shell__title">Live email sample</div>
          </div>
          <button
            type="button"
            className={`campaign-template-preview-shell__drawer-toggle ${
              isMergeDrawerOpen ? 'is-active' : ''
            }`}
            onClick={() => setIsMergeDrawerOpen((currentValue) => !currentValue)}
            aria-expanded={isMergeDrawerOpen}
            aria-controls="campaign-template-merge-drawer"
          >
            <i className="bi bi-braces-asterisk" aria-hidden="true" />
            <span>{isMergeDrawerOpen ? 'Hide merge fields' : 'Show merge fields'}</span>
          </button>
        </div>
        <div className={`campaign-template-preview-stage ${isMergeDrawerOpen ? 'is-drawer-open' : ''}`}>
          <div id="campaign-template-merge-drawer">
            <CampaignStudioTemplateMergeFieldDrawer
              isOpen={isMergeDrawerOpen}
              onInsertMergeField={onInsertMergeField}
            />
          </div>

          <div className="campaign-template-preview-email">
            <div className="campaign-template-preview-email__chrome">
              <span className="campaign-template-preview-email__dot" />
              <span className="campaign-template-preview-email__dot" />
              <span className="campaign-template-preview-email__dot" />
              <span className="campaign-template-preview-email__label">Rendered output</span>
            </div>
            <div className="campaign-template-preview-card is-rendered">
              <div className="campaign-template-preview-card__subject">
                {renderTemplateText(subjectTemplate) || 'Subject line preview'}
              </div>
              <div className="campaign-template-preview-card__body">
                {renderedBlocks.length > 0 ? (
                  renderedBlocks.map((block) => {
                    if (block.type === 'heading') {
                      return <h3 key={block.id}>{block.content || 'Heading block'}</h3>;
                    }
                    if (block.type === 'image') {
                      return (
                        <figure key={block.id} className="campaign-template-preview-card__image">
                          <div className="campaign-template-preview-card__image-frame">
                            {block.src ? (
                              <img src={block.src} alt={block.altText || 'Template preview'} />
                            ) : (
                              <div className="campaign-template-preview-card__image-placeholder">
                                Image placeholder
                              </div>
                            )}
                          </div>
                          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
                        </figure>
                      );
                    }
                    return <p key={block.id}>{block.content || 'Text block'}</p>;
                  })
                ) : (
                  <p className="text-muted mb-0">Body preview will appear here.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
