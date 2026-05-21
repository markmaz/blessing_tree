import {
  renderTemplateBlocksPreview,
  renderTemplateText,
  type CommunicationTemplateBlock,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';

interface CampaignStudioTemplatePreviewPanelProps {
  subjectTemplate: string;
  blocks: CommunicationTemplateBlock[];
}

export function CampaignStudioTemplatePreviewPanel({
  subjectTemplate,
  blocks,
}: CampaignStudioTemplatePreviewPanelProps) {
  const renderedBlocks = renderTemplateBlocksPreview(blocks);

  return (
    <div className="campaign-template-workspace__preview-column">
      <div className="campaign-template-preview-shell">
        <div className="campaign-template-preview-shell__header">
          <div>
            <span className="campaign-studio__eyebrow">Rendered Preview</span>
            <div className="campaign-template-preview-shell__title">Live email sample</div>
          </div>
          <div className="campaign-template-preview-shell__note">
            This surface shows the rendered version only.
          </div>
        </div>
        <div className="campaign-template-preview-stage">
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
                    return (
                      <p key={block.id} className="campaign-template-preview-card__text-block">
                        {block.content || 'Text block'}
                      </p>
                    );
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
