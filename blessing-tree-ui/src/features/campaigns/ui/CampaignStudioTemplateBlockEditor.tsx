import {
  createTemplateBlock,
  getTemplateBlockIcon,
  getTemplateBlockLabel,
  type CommunicationTemplateBlock,
  type CommunicationTemplateBlockType,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';

interface CampaignStudioTemplateBlockEditorProps {
  blocks: CommunicationTemplateBlock[];
  isSaving: boolean;
  onChangeBlocks: (blocks: CommunicationTemplateBlock[]) => void;
  onFocusBlockField: (
    blockId: string,
    field: 'content' | 'src' | 'altText' | 'caption'
  ) => void;
}

const blockPalette: CommunicationTemplateBlockType[] = ['heading', 'text', 'image'];

export function CampaignStudioTemplateBlockEditor({
  blocks,
  isSaving,
  onChangeBlocks,
  onFocusBlockField,
}: CampaignStudioTemplateBlockEditorProps) {
  return (
    <div className="campaign-template-block-editor">
      <div className="campaign-template-block-editor__palette">
        {blockPalette.map((type) => (
          <button
            key={type}
            type="button"
            className="campaign-template-block-editor__palette-button"
            disabled={isSaving}
            onClick={() => onChangeBlocks([...blocks, createTemplateBlock(type)])}
          >
            <i className={`bi ${getTemplateBlockIcon(type)}`} aria-hidden="true" />
            <span>Add {getTemplateBlockLabel(type)}</span>
          </button>
        ))}
      </div>

      <div className="campaign-template-block-editor__list">
        {blocks.map((block, index) => (
          <article key={block.id} className="campaign-template-block-card">
            <div className="campaign-template-block-card__header">
              <div className="campaign-template-block-card__label">
                <i className={`bi ${getTemplateBlockIcon(block.type)}`} aria-hidden="true" />
                <strong>{getTemplateBlockLabel(block.type)}</strong>
              </div>
              <div className="campaign-template-block-card__actions">
                <button
                  type="button"
                  className="campaign-template-block-card__action-button"
                  aria-label="Move block up"
                  disabled={isSaving || index === 0}
                  onClick={() => onChangeBlocks(moveBlock(blocks, index, index - 1))}
                >
                  <i className="bi bi-arrow-up" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="campaign-template-block-card__action-button"
                  aria-label="Move block down"
                  disabled={isSaving || index === blocks.length - 1}
                  onClick={() => onChangeBlocks(moveBlock(blocks, index, index + 1))}
                >
                  <i className="bi bi-arrow-down" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="campaign-template-block-card__action-button is-danger"
                  aria-label="Delete block"
                  disabled={isSaving}
                  onClick={() =>
                    onChangeBlocks(blocks.filter((entry) => entry.id !== block.id))
                  }
                >
                  <i className="bi bi-trash3" aria-hidden="true" />
                </button>
              </div>
            </div>

            {block.type === 'image' ? (
              <div className="campaign-template-block-card__field-stack">
                <label className="form-label">
                  Image URL
                  <input
                    className="form-control"
                    value={block.src}
                    onFocus={() => onFocusBlockField(block.id, 'src')}
                    onChange={(event) =>
                      onChangeBlocks(
                        blocks.map((entry) =>
                          entry.id === block.id
                            ? { ...entry, src: event.target.value }
                            : entry
                        )
                      )
                    }
                  />
                </label>
                <label className="form-label">
                  Alt Text
                  <input
                    className="form-control"
                    value={block.altText}
                    onFocus={() => onFocusBlockField(block.id, 'altText')}
                    onChange={(event) =>
                      onChangeBlocks(
                        blocks.map((entry) =>
                          entry.id === block.id
                            ? { ...entry, altText: event.target.value }
                            : entry
                        )
                      )
                    }
                  />
                </label>
                <label className="form-label mb-0">
                  Caption
                  <textarea
                    className="form-control"
                    rows={3}
                    value={block.caption}
                    onFocus={() => onFocusBlockField(block.id, 'caption')}
                    onChange={(event) =>
                      onChangeBlocks(
                        blocks.map((entry) =>
                          entry.id === block.id
                            ? { ...entry, caption: event.target.value }
                            : entry
                        )
                      )
                    }
                  />
                </label>
              </div>
            ) : (
              <label className="form-label mb-0">
                {block.type === 'heading' ? 'Heading' : 'Text'}
                <textarea
                  className="form-control"
                  rows={block.type === 'heading' ? 3 : 6}
                  value={block.content}
                  onFocus={() => onFocusBlockField(block.id, 'content')}
                  onChange={(event) =>
                    onChangeBlocks(
                      blocks.map((entry) =>
                        entry.id === block.id
                          ? { ...entry, content: event.target.value }
                          : entry
                      )
                    )
                  }
                />
              </label>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function moveBlock(
  blocks: CommunicationTemplateBlock[],
  fromIndex: number,
  toIndex: number
): CommunicationTemplateBlock[] {
  const nextBlocks = [...blocks];
  const [movedBlock] = nextBlocks.splice(fromIndex, 1);
  nextBlocks.splice(toIndex, 0, movedBlock);
  return nextBlocks;
}
