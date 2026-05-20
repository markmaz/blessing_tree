import { milestoneDefinitions } from '@/features/campaigns/model/campaignStudio';
import type {
  CampaignMilestone,
  SaveCampaignMilestoneInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';

interface MilestoneDraft {
  milestoneKey: string;
  label: string;
  occursOn: string;
  notes: string;
  sortOrder: number;
}

interface CampaignStudioMilestonesEditorProps {
  milestones: CampaignMilestone[];
  isSaving: boolean;
  onSave: (milestones: SaveCampaignMilestoneInput[]) => Promise<boolean>;
}

export function CampaignStudioMilestonesEditor({
  milestones,
  isSaving,
  onSave,
}: CampaignStudioMilestonesEditorProps) {
  const drafts = buildMilestoneDrafts(milestones);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = drafts.flatMap((draft) => {
      const occursOn = String(formData.get(`occursOn:${draft.milestoneKey}`) ?? '').trim();
      if (!occursOn) {
        return [];
      }
      return [
        {
          milestoneKey: draft.milestoneKey,
          label: String(formData.get(`label:${draft.milestoneKey}`) ?? draft.label).trim(),
          occursOn,
          notes: String(formData.get(`notes:${draft.milestoneKey}`) ?? '').trim() || null,
          sortOrder: draft.sortOrder,
        },
      ];
    });
    await onSave(payload);
  };

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Schedule"
        title="Milestones"
        description="Set the named campaign checkpoints that drive readiness and scheduled communications."
      >
        <form onSubmit={handleSubmit}>
          <div className="campaign-studio__milestone-editor">
            {drafts.map((draft) => (
              <article key={draft.milestoneKey} className="campaign-studio__milestone-editor-card">
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
                  <div>
                    <h3 className="h6 mb-1">{draft.label}</h3>
                    <div className="small text-muted">{draft.milestoneKey}</div>
                  </div>
                </div>
                <div className="campaign-studio__form-grid">
                  <label className="form-label">
                    Date
                    <input
                      name={`occursOn:${draft.milestoneKey}`}
                      type="date"
                      className="form-control"
                      defaultValue={draft.occursOn}
                    />
                  </label>
                  <label className="form-label">
                    Label
                    <input
                      name={`label:${draft.milestoneKey}`}
                      className="form-control"
                      defaultValue={draft.label}
                    />
                  </label>
                  <label className="form-label campaign-studio__form-span-2">
                    Notes
                    <textarea
                      name={`notes:${draft.milestoneKey}`}
                      className="form-control"
                      rows={3}
                      defaultValue={draft.notes}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
          <div className="campaign-studio__form-actions mt-4">
            <button type="submit" className="btn btn-secondary btn-sm" disabled={isSaving}>
              Save Milestones
            </button>
          </div>
        </form>
      </CampaignStudioSectionCard>
    </div>
  );
}

function buildMilestoneDrafts(milestones: CampaignMilestone[]): MilestoneDraft[] {
  return milestoneDefinitions.map((definition) => {
    const milestone = milestones.find((item) => item.milestoneKey === definition.key);
    return {
      milestoneKey: definition.key,
      label: milestone?.label ?? definition.label,
      occursOn: milestone?.occursOn ?? '',
      notes: milestone?.notes ?? '',
      sortOrder: milestone?.sortOrder ?? definition.sortOrder,
    };
  });
}
