import {
  communicationTemplateMergeFieldGroups,
  getTemplateBlockLabel,
  renderTemplateBlocksPreview,
  renderTemplateText,
  type CommunicationTemplateBlock,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';

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
  const renderedBlocks = renderTemplateBlocksPreview(blocks);

  return (
    <div className="campaign-template-workspace__preview-column">
      <div className="campaign-template-preview-card">
        <div className="campaign-template-preview-card__heading">
          <span className="campaign-studio__eyebrow">Email Preview</span>
          <strong>Rendered sample</strong>
        </div>
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

      <div className="campaign-template-merge-fields">
        <div className="campaign-template-preview-card__heading">
          <span className="campaign-studio__eyebrow">Merge Fields</span>
          <strong>Insert sample fields</strong>
        </div>
        {communicationTemplateMergeFieldGroups.map((group) => (
          <div key={group.label} className="campaign-template-merge-fields__group">
            <div className="campaign-template-merge-fields__label">{group.label}</div>
            <div className="campaign-template-token-grid">
              {group.fields.map((field) => (
                <button
                  key={field}
                  type="button"
                  className="campaign-template-token"
                  onClick={() => onInsertMergeField(field)}
                >
                  {field}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="campaign-template-preview-card">
        <div className="campaign-template-preview-card__heading">
          <span className="campaign-studio__eyebrow">Content Notes</span>
          <strong>Supported blocks</strong>
        </div>
        <div className="campaign-template-content-notes">
          <div>{getTemplateBlockLabel('heading')}: section titles or callouts.</div>
          <div>{getTemplateBlockLabel('text')}: message body and instructions.</div>
          <div>{getTemplateBlockLabel('image')}: maps, pickup graphics, or reference visuals.</div>
        </div>
      </div>
    </div>
  );
}
