import { useState } from 'react';
import {
  type CampaignStudioSectionId,
} from '@/features/campaigns/model/campaignStudio';
import {
  getAiPromptStarters,
  getAiReadinessSignals,
} from '@/features/campaigns/model/campaignStudioAi';
import type {
  CampaignReadiness,
  CampaignScheduleItem,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';

interface CampaignStudioAiRailProps {
  campaign: Campaign;
  selectedSection: CampaignStudioSectionId;
  readiness: CampaignReadiness;
  scheduleItems: CampaignScheduleItem[];
}

export function CampaignStudioAiRail({
  campaign,
  selectedSection,
  readiness,
  scheduleItems,
}: CampaignStudioAiRailProps) {
  const [draftPrompt, setDraftPrompt] = useState('');
  const promptStarters = getAiPromptStarters(selectedSection, readiness, scheduleItems);
  const readinessSignals = getAiReadinessSignals(selectedSection, readiness);

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
          {promptStarters.map((prompt) => (
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

      {readinessSignals.length > 0 ? (
        <div className="campaign-studio__suggestions">
          <div className="small fw-semibold mb-2">Current Signals</div>
          <div className="d-grid gap-2">
            {readinessSignals.map((item) => (
              <div key={item.code} className="campaign-studio__inline-note">
                <div className="fw-semibold small mb-1">{item.message}</div>
                <div className="small text-muted">
                  Use the prompt panel to draft a response for this {item.section} gap.
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
