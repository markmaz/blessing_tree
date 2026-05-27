import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { askBlessingTree } from '@/features/ask/api/askApi';
import type { AskAction, AskResponse } from '@/features/ask/model/askTypes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { ReportExportActions } from '@/features/reports/ui/ReportExportActions';
import '@/features/ask/ui/ask.css';

const SUGGESTED_PROMPTS = [
  'How do I add a sponsor?',
  'Where is the Gift Status report?',
  'Show recipients still needing sponsors.',
  'Show committed gifts not received.',
  'Show readiness blockers.',
  'Show sponsors without commitments.',
];

export function AskBlessingTreePage() {
  const { campaignId = null } = useParams();
  const { campaigns, selectedCampaign, selectedCampaignId, selectCampaign } = useCampaigns();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!campaignId) {
    return null;
  }
  const activeCampaignId = campaignId;

  async function submitPrompt(nextPrompt: string) {
    const cleaned = nextPrompt.trim();
    if (!cleaned || isLoading) {
      return;
    }
    setPrompt(cleaned);
    setIsLoading(true);
    setError(null);
    try {
      const result = await askBlessingTree(activeCampaignId, cleaned);
      setResponse(result);
      setRecentPrompts((currentValue) => [cleaned, ...currentValue.filter((item) => item !== cleaned)].slice(0, 5));
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : 'Unable to ask Blessing Tree.');
    } finally {
      setIsLoading(false);
    }
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

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="content-card">
          <p className="text-muted mb-0">Checking Blessing Tree...</p>
        </div>
      ) : response ? (
        <AskResult response={response} onPrompt={(nextPrompt) => void submitPrompt(nextPrompt)} />
      ) : (
        <div className="content-card ask-empty">
          Choose a suggested prompt or ask a question about this campaign.
        </div>
      )}

      {recentPrompts.length > 0 ? (
        <div className="content-card">
          <h2 className="h6 mb-3">Recent Questions</h2>
          <div className="ask-suggestions">
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

function AskResult({ response, onPrompt }: { response: AskResponse; onPrompt: (prompt: string) => void }) {
  return (
    <div className="content-card ask-result">
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
                  <td key={column.key}>{formatCell(row[column.key])}</td>
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
