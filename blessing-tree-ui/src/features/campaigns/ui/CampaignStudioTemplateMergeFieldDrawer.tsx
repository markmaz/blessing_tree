import {
  communicationTemplateMergeFieldGroups,
  getTemplateBlockLabel,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';

interface CampaignStudioTemplateMergeFieldDrawerProps {
  isOpen: boolean;
  onInsertMergeField: (field: string) => void;
}

export function CampaignStudioTemplateMergeFieldDrawer({
  isOpen,
  onInsertMergeField,
}: CampaignStudioTemplateMergeFieldDrawerProps) {
  return (
    <aside
      className={`campaign-template-merge-drawer ${isOpen ? 'is-open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div className="campaign-template-merge-drawer__inner">
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
                  <i className="bi bi-braces-asterisk me-2" aria-hidden="true" />
                  {field}
                </button>
              ))}
            </div>
          </div>
        ))}

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
    </aside>
  );
}
