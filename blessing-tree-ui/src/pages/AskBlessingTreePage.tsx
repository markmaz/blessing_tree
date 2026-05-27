import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { askBlessingTree, submitAskFeedback } from '@/features/ask/api/askApi';
import type { AskAction, AskResponse } from '@/features/ask/model/askTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { ReportExportActions } from '@/features/reports/ui/ReportExportActions';
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
    async (nextPrompt: string) => {
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
          response: null,
          error: null,
        },
      ]);
      setPendingTurnId(turnId);
      setIsLoading(true);
      try {
        const result = await askBlessingTree(activeCampaignId, cleaned);
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
    if (!campaignId || !urlPrompt || submittedUrlPrompt === urlPrompt) {
      return;
    }
    setSubmittedUrlPrompt(urlPrompt);
    setSearchParams({}, { replace: true });
    void submitPrompt(urlPrompt);
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
            <i className="bi bi-stars me-2" aria-hidden="true" />
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

function AskResult({
  campaignId,
  response,
  onPrompt,
}: {
  campaignId: string;
  response: AskResponse;
  onPrompt: (prompt: string) => void;
}) {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'positive' | 'negative' | 'error'>('idle');
  const relatedPrompts = response.suggestions.filter((suggestion) => !response.actions.some((action) => action.prompt === suggestion)).slice(0, 4);

  async function handleFeedback(rating: 'POSITIVE' | 'NEGATIVE') {
    if (!response.promptLogId || feedbackState === 'positive' || feedbackState === 'negative') {
      return;
    }
    try {
      await submitAskFeedback(campaignId, response.promptLogId, rating);
      setFeedbackState(rating === 'POSITIVE' ? 'positive' : 'negative');
    } catch {
      setFeedbackState('error');
    }
  }

  return (
    <div className="ask-message__bubble ask-result">
      <div className="ask-result__header">
        <div>
          <div className="campaign-chip-row mb-2">
            <span className="campaign-chip campaign-chip-muted">{resultLabel(response.kind)}</span>
            {response.confidence > 0 ? (
              <span className="campaign-chip campaign-chip-muted">{Math.round(response.confidence * 100)}% match</span>
            ) : null}
          </div>
          <h2 className="h5 mb-2">{response.title ?? 'Blessing Tree Answer'}</h2>
          <p className="mb-0">{response.answer}</p>
        </div>
        {response.report ? (
          <div className="ask-result__summary">
            <span className="ask-result__summary-value">{response.report.summary.value}</span>
            <span>{response.report.summary.label}</span>
          </div>
        ) : null}
      </div>

      {response.steps?.length ? (
        <ol className="mb-0">
          {response.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}

      {response.interpretedAs?.filterChips.length ? (
        <div className="ask-filter-chips">
          {response.interpretedAs.filterChips.map((chip) => (
            <span key={chip} className="ask-filter-chip">
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {response.report ? <AskReport report={response.report} /> : null}

      {response.warnings.length ? (
        <div className="alert alert-warning mb-0" role="alert">
          {response.warnings.join(' ')}
        </div>
      ) : null}

      {response.actions.length ? (
        <div className="ask-result__actions">
          {response.actions.map((action) => (
            <AskActionButton key={`${action.label}-${action.route ?? action.prompt}`} action={action} onPrompt={onPrompt} />
          ))}
        </div>
      ) : null}

      {response.promptLogId ? (
        <div className="ask-feedback" aria-label="Answer feedback">
          <span className="ask-feedback__label">
            {feedbackState === 'positive'
              ? 'Marked helpful'
              : feedbackState === 'negative'
                ? 'Marked not helpful'
                : feedbackState === 'error'
                  ? 'Feedback could not be saved'
                  : 'Was this helpful?'}
          </span>
          <div className="btn-group btn-group-sm" role="group">
            <button
              type="button"
              className={`btn ${feedbackState === 'positive' ? 'btn-success' : 'btn-outline-secondary'}`}
              disabled={feedbackState === 'positive' || feedbackState === 'negative'}
              onClick={() => void handleFeedback('POSITIVE')}
              title="Helpful"
            >
              <i className="bi bi-hand-thumbs-up" aria-hidden="true" />
              <span className="visually-hidden">Helpful</span>
            </button>
            <button
              type="button"
              className={`btn ${feedbackState === 'negative' ? 'btn-danger' : 'btn-outline-secondary'}`}
              disabled={feedbackState === 'positive' || feedbackState === 'negative'}
              onClick={() => void handleFeedback('NEGATIVE')}
              title="Not helpful"
            >
              <i className="bi bi-hand-thumbs-down" aria-hidden="true" />
              <span className="visually-hidden">Not helpful</span>
            </button>
          </div>
        </div>
      ) : null}

      {relatedPrompts.length ? (
        <div className="ask-related">
          <h3 className="h6 mb-2">Related Questions</h3>
          <div className="ask-suggestions">
            {relatedPrompts.map((suggestion) => (
              <button key={suggestion} type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPrompt(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AskReport({ report }: { report: NonNullable<AskResponse['report']> }) {
  const exportPayload = {
    title: report.summary.label,
    fileName: report.summary.label,
    sheets: [
      {
        name: 'Summary',
        columns: [
          { key: 'metric', label: 'Metric' },
          { key: 'value', label: 'Value' },
        ],
        rows: [{ metric: report.summary.label, value: report.summary.value }],
      },
      {
        name: 'Results',
        columns: report.columns,
        rows: report.rows,
      },
    ],
  };
  if (report.rows.length === 0) {
    return (
      <div className="d-grid gap-3">
        <ReportExportActions payload={exportPayload} />
        <div className="ask-empty">No rows matched this report.</div>
      </div>
    );
  }
  return (
    <div className="d-grid gap-3">
      <ReportExportActions payload={exportPayload} />
      <div className="ask-report-table">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              {report.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, index) => (
              <tr key={String(row.id ?? row.recipient_id ?? row.wishlist_item_id ?? row.line_id ?? index)}>
                {report.columns.map((column) => (
                  <td key={column.key}>
                    <AskReportCell columnKey={column.key} value={row[column.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {report.totals?.limited ? (
          <p className="text-muted small mb-0">
            Showing {report.rows.length} of {report.totals.rowCount} matching rows.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AskReportCell({ columnKey, value }: { columnKey: string; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted">—</span>;
  }
  if (columnKey.includes('email') && typeof value === 'string') {
    return <a href={`mailto:${value}`}>{value}</a>;
  }
  if (columnKey.includes('phone') && typeof value === 'string') {
    return <a href={`tel:${value}`}>{formatPhone(value)}</a>;
  }
  if (columnKey.includes('status')) {
    return <span className={`ask-status ask-status--${statusTone(value)}`}>{formatCell(value)}</span>;
  }
  if (columnKey.endsWith('_at') && typeof value === 'string') {
    return <span>{formatDateTime(value)}</span>;
  }
  if (columnKey.includes('count') && typeof value === 'number') {
    return <strong>{value}</strong>;
  }
  return <>{formatCell(value)}</>;
}

function AskActionButton({ action, onPrompt }: { action: AskAction; onPrompt: (prompt: string) => void }) {
  if (action.type === 'prompt' && action.prompt) {
    return (
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPrompt(action.prompt!)}>
        {action.label}
      </button>
    );
  }
  if (action.route) {
    return (
      <Link to={action.route} className="btn btn-secondary btn-sm">
        {action.label}
      </Link>
    );
  }
  return null;
}

function resultLabel(kind: AskResponse['kind']) {
  if (kind === 'report_result') return 'Report';
  if (kind === 'navigation_result') return 'Navigation';
  if (kind === 'app_help') return 'Help';
  if (kind === 'clarification') return 'Clarification';
  return 'Answer';
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value).replaceAll('_', ' ');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

function statusTone(value: unknown): string {
  const normalized = String(value).toLowerCase();
  if (normalized.includes('open') || normalized.includes('pending') || normalized.includes('not started')) {
    return 'attention';
  }
  if (normalized.includes('exception') || normalized.includes('late') || normalized.includes('expired')) {
    return 'danger';
  }
  if (normalized.includes('received') || normalized.includes('ready') || normalized.includes('verified')) {
    return 'success';
  }
  return 'neutral';
}

function createAskTurnId(): string {
  return crypto.randomUUID();
}
