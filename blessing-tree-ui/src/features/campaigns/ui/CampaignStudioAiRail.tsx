import { useState } from 'react';
import {
  campaignStudioPromptStarters,
  type CampaignStudioSectionId,
} from '@/features/campaigns/model/campaignStudio';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';

interface CampaignStudioAiRailProps {
  campaign: Campaign;
  selectedSection: CampaignStudioSectionId;
}

export function CampaignStudioAiRail({
  campaign,
  selectedSection,
}: CampaignStudioAiRailProps) {
  const [draftPrompt, setDraftPrompt] = useState('');

  return (
    <aside className="campaign-studio__ai-rail" aria-label="Campaign Studio AI builder">
      <div className="campaign-studio__eyebrow">AI Builder</div>
      <h2 className="h5 mb-2">Shape {campaign.name}</h2>
      <p className="text-muted small mb-4">
        Draft structured changes for the <strong>{selectedSection}</strong>{' '}
        section. Apply actions will activate once the backend draft endpoints
        exist.
      </p>

      <label className="form-label small fw-semibold" htmlFor="campaign-studio-prompt">
        Campaign Prompt
      </label>
      <textarea
        id="campaign-studio-prompt"
        className="form-control mb-3"
        rows={6}
        value={draftPrompt}
        onChange={(event) => setDraftPrompt(event.target.value)}
        placeholder="Describe what you want to add or improve in this campaign."
      />

      <div className="d-grid gap-2 mb-4">
        <button type="button" className="btn btn-secondary btn-sm" disabled>
          Draft Studio Changes
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled>
          Apply Accepted Changes
        </button>
      </div>

      <div className="campaign-studio__suggestions">
        <div className="small fw-semibold mb-2">Prompt Starters</div>
        <div className="d-grid gap-2">
          {campaignStudioPromptStarters.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="campaign-studio__prompt-chip"
              onClick={() => setDraftPrompt(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="campaign-studio__ai-note mt-4">
        <div className="small fw-semibold mb-1">Phase 1 Note</div>
        <p className="small mb-0 text-muted">
          This rail is intentionally non-destructive right now. The next backend
          slice will add structured draft and apply endpoints.
        </p>
      </div>
    </aside>
  );
}
