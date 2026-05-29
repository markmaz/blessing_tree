import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { askBlessingTree } from '@/features/ask/api/askApi';
import type { AskRequestContext, AskResponse } from '@/features/ask/model/askTypes';
import { AskResult } from '@/features/ask/ui/AskResult';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import '@/features/ask/ui/ask.css';

const SUGGESTED_PROMPTS = [
  'Show recipients still needing sponsors.',
  'How many gifts are unsponsored?',
  'Which sponsors have not turned in gifts?',
  'Show top 5 gifts by gender.',
  'How many children and adults are in this campaign?',
];

interface AskConversationTurn {
  id: string;
  prompt: string;
  context: AskRequestContext | null;
  response: AskResponse | null;
  error: string | null;
}

export function AskBlessingTreePage() {
  const { campaignId = null } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { campaigns, selectedCampaign, selectedCampaignId, selectCampaign } = useCampaigns();
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const [prompt, setPrompt] = useState('');
  const [conversationTurns, setConversationTurns] = useState<AskConversationTurn[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const [submittedUrlPrompt, setSubmittedUrlPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTurnId, setPendingTurnId] = useState<string | null>(null);
  const recentPromptStorageKey = campaignId ? `blessing-tree:ask:recent:${campaignId}` : null;
  const activeCampaignId = campaignId;

  const campaign = useMemo(
    () =>
      campaigns.find((item) => item.id === campaignId) ??
      (selectedCampaign?.id === campaignId ? selectedCampaign : null),
    [campaignId, campaigns, selectedCampaign]
  );

  useEffect(() => {
    if (campaignId && selectedCampaignId !== campaignId) {
      selectCampaign(campaignId);
    }
  }, [campaignId, selectCampaign, selectedCampaignId]);

  const submitPrompt = useCallback(
    async (nextPrompt: string, context: AskRequestContext | null = null) => {
      const cleaned = nextPrompt.trim();
      if (!activeCampaignId || !cleaned || isLoading) {
        return;
      }
      const turnId = createAskTurnId();
      setPrompt('');
      setConversationTurns((currentValue) => [
        ...currentValue,
        {
          id: turnId,
          prompt: cleaned,
          context,
          response: null,
          error: null,
        },
      ]);
      setPendingTurnId(turnId);
      setIsLoading(true);
      try {
        const result = await askBlessingTree(activeCampaignId, cleaned, context);
        setConversationTurns((currentValue) =>
          currentValue.map((turn) => (turn.id === turnId ? { ...turn, response: result } : turn))
        );
        setRecentPrompts((currentValue) => {
          const nextValue = [cleaned, ...currentValue.filter((item) => item !== cleaned)].slice(0, 5);
          if (recentPromptStorageKey) {
            window.localStorage.setItem(recentPromptStorageKey, JSON.stringify(nextValue));
          }
          return nextValue;
        });
      } catch (askError) {
        const errorMessage = askError instanceof Error ? askError.message : 'Unable to ask Blessing Tree.';
        setConversationTurns((currentValue) =>
          currentValue.map((turn) => (turn.id === turnId ? { ...turn, error: errorMessage } : turn))
        );
      } finally {
        setPendingTurnId(null);
        setIsLoading(false);
      }
    },
    [activeCampaignId, isLoading, recentPromptStorageKey]
  );

  useEffect(() => {
    if (!recentPromptStorageKey) {
      return;
    }
    try {
      const stored = window.localStorage.getItem(recentPromptStorageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      setRecentPrompts(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 5) : []);
    } catch {
      setRecentPrompts([]);
    }
  }, [recentPromptStorageKey]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversationTurns, pendingTurnId]);

  useEffect(() => {
    const urlPrompt = searchParams.get('prompt')?.trim();
    const fieldName = searchParams.get('fieldName')?.trim();
    const fieldLabel = searchParams.get('fieldLabel')?.trim();
    const screen = searchParams.get('screen')?.trim();
    const route = searchParams.get('route')?.trim();
    if (!campaignId || !urlPrompt || submittedUrlPrompt === urlPrompt) {
      return;
    }
    setSubmittedUrlPrompt(urlPrompt);
    setSearchParams({}, { replace: true });
    void submitPrompt(
      urlPrompt,
      fieldName || fieldLabel || screen || route
        ? {
            fieldName: fieldName || undefined,
            fieldLabel: fieldLabel || undefined,
            screen: screen || undefined,
            route: route || undefined,
          }
        : null
    );
  }, [campaignId, searchParams, setSearchParams, submitPrompt, submittedUrlPrompt]);

  if (!campaignId) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(prompt);
  }

  return (
    <section className="ask-page">
      <div className="campaign-studio-page__header">
        <div>
          <div className="campaign-chip-row mb-3">
            <span className="campaign-chip campaign-chip-muted">{campaign?.name ?? 'Campaign'}</span>
            <span className="campaign-chip campaign-chip-muted">Ask Blessing Tree</span>
          </div>
          <h1 className="h3 mb-1">Ask Blessing Tree</h1>
          <p className="text-muted mb-0">
            Ask for help using the app or run a campaign report in plain language.
          </p>
        </div>
        <a href="/blessing-tree-user-guide.pdf" className="btn btn-outline-secondary btn-sm" download>
          <i className="bi bi-file-earmark-pdf me-2" aria-hidden="true" />
          Download User Guide
        </a>
      </div>

      <div className="content-card ask-composer">
        <form className="ask-composer__form" onSubmit={handleSubmit}>
          <input
            className="form-control ask-composer__input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask about this campaign or how to use Blessing Tree..."
            aria-label="Ask Blessing Tree"
          />
          <button type="submit" className="btn btn-primary" disabled={isLoading || !prompt.trim()}>
            <i className="bi bi-chat-square-text me-2" aria-hidden="true" />
            Ask
          </button>
        </form>
        <div className="ask-suggestions" aria-label="Suggested prompts">
          {SUGGESTED_PROMPTS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => void submitPrompt(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {conversationTurns.length > 0 ? (
        <div className="content-card ask-conversation-card">
          <div className="ask-transcript" aria-live="polite" aria-label="Ask Blessing Tree conversation">
            {conversationTurns.map((turn) => (
              <AskConversationTurn
                key={turn.id}
                campaignId={campaignId}
                turn={turn}
                isPending={pendingTurnId === turn.id}
                onPrompt={(nextPrompt) => void submitPrompt(nextPrompt)}
              />
            ))}
            <div ref={transcriptEndRef} />
          </div>
          <div className="ask-conversation-card__footer">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={isLoading}
              onClick={() => {
                setConversationTurns([]);
                setPendingTurnId(null);
              }}
            >
              <i className="bi bi-trash me-1" aria-hidden="true" />
              Clear Chat
            </button>
          </div>
        </div>
      ) : (
        <div className="content-card ask-empty">
          Choose a suggested prompt or ask a question about this campaign.
        </div>
      )}

      {recentPrompts.length > 0 ? (
        <div className="content-card ask-prompt-group">
          <div className="ask-prompt-group__header">
            <h2 className="h6 mb-0">Recent Questions</h2>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setRecentPrompts([]);
                if (recentPromptStorageKey) {
                  window.localStorage.removeItem(recentPromptStorageKey);
                }
              }}
            >
              Clear
            </button>
          </div>
          <div className="ask-suggestions mt-3">
            {recentPrompts.map((item) => (
              <button key={item} type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void submitPrompt(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AskConversationTurn({
  campaignId,
  turn,
  isPending,
  onPrompt,
}: {
  campaignId: string;
  turn: AskConversationTurn;
  isPending: boolean;
  onPrompt: (prompt: string) => void;
}) {
  return (
    <div className="ask-turn">
      <div className="ask-message ask-message--user">
        <div className="ask-message__bubble">
          <p className="mb-0">{turn.prompt}</p>
          {turn.context?.fieldLabel || turn.context?.screen ? (
            <p className="ask-message__context mb-0">
              {[turn.context.fieldLabel, turn.context.screen].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="ask-message ask-message--assistant">
        {isPending ? (
          <div className="ask-message__bubble ask-message__bubble--pending">
            <span className="ask-thinking-dot" aria-hidden="true" />
            <span>Checking Blessing Tree...</span>
          </div>
        ) : turn.error ? (
          <div className="ask-message__bubble ask-message__bubble--error" role="alert">
            {turn.error}
          </div>
        ) : turn.response ? (
          <AskResult campaignId={campaignId} response={turn.response} onPrompt={onPrompt} />
        ) : null}
      </div>
    </div>
  );
}

function createAskTurnId(): string {
  return crypto.randomUUID();
}
