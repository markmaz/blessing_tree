import type { RefObject } from 'react';

interface CampaignStudioAiComposerProps {
  prompt: string;
  placeholder: string;
  isSaving: boolean;
  isPending: boolean;
  canClearHistory: boolean;
  promptRef: RefObject<HTMLTextAreaElement | null>;
  onPromptChange: (prompt: string) => void;
  onSubmit: () => void;
  onClearHistory: () => void;
  onStartNewSession: () => void;
}

export function CampaignStudioAiComposer({
  prompt,
  placeholder,
  isSaving,
  isPending,
  canClearHistory,
  promptRef,
  onPromptChange,
  onSubmit,
  onClearHistory,
  onStartNewSession,
}: CampaignStudioAiComposerProps) {
  return (
    <div className="campaign-studio__ai-composer">
      <form
        className="campaign-studio__ai-goal"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="campaign-studio-prompt" className="visually-hidden">
          Campaign prompt
        </label>
        <div className="campaign-studio__ai-goal-box">
          <textarea
            id="campaign-studio-prompt"
            ref={promptRef}
            className="form-control campaign-studio__ai-goal-input"
            rows={3}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) {
                return;
              }

              event.preventDefault();
              onSubmit();
            }}
            placeholder={placeholder}
          />
          <div className="campaign-studio__ai-composer-tools">
            <button
              type="button"
              className="btn btn-sm campaign-studio__ai-tool-btn"
              onClick={onClearHistory}
              disabled={isPending || !canClearHistory}
              aria-label="Clear chat"
              title="Clear chat"
            >
              <i className="bi bi-trash3" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-sm campaign-studio__ai-tool-btn"
              onClick={onStartNewSession}
              disabled={isPending}
              aria-label="New session"
              title="Start a new planning session"
            >
              <i className="bi bi-arrow-clockwise" aria-hidden="true" />
            </button>
          </div>
          <button
            type="submit"
            className="campaign-studio__ai-send-btn"
            disabled={isPending || !prompt.trim() || isSaving}
            aria-label="Send AI prompt"
            title="Send AI prompt"
          >
            <i className={`bi ${isPending ? 'bi-arrow-repeat' : 'bi-arrow-up'}`} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
