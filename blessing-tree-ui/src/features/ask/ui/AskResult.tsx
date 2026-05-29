import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitAskFeedback } from '@/features/ask/api/askApi';
import type { AskAction, AskResponse } from '@/features/ask/model/askTypes';
import { ReportExportActions } from '@/features/reports/ui/ReportExportActions';

interface AskResultProps {
  campaignId: string;
  response: AskResponse;
  onPrompt: (prompt: string) => void;
}

export function AskResult({ campaignId, response, onPrompt }: AskResultProps) {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'positive' | 'negative' | 'error'>('idle');
  const relatedPrompts = response.suggestions
    .filter((suggestion) => !response.actions.some((action) => action.prompt === suggestion))
    .slice(0, 4);

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
              <span className="campaign-chip campaign-chip-muted">
                {Math.round(response.confidence * 100)}% match
              </span>
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

      {response.sources.length ? (
        <div className="ask-sources" aria-label="Answer sources">
          <h3 className="h6 mb-2">From the Guide</h3>
          <div className="ask-source-list">
            {response.sources.map((source) => (
              <span key={`${source.document}-${source.title}`} className="ask-source">
                <i className="bi bi-journal-text" aria-hidden="true" />
                {source.document}: {source.title}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {response.warnings.length ? (
        <div className="alert alert-warning mb-0" role="alert">
          {response.warnings.join(' ')}
        </div>
      ) : null}

      {response.actions.length ? (
        <div className="ask-result__actions">
          {response.actions.map((action) => (
            <AskActionButton
              key={`${action.label}-${action.route ?? action.prompt}`}
              action={action}
              onPrompt={onPrompt}
            />
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
              <button
                key={suggestion}
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => onPrompt(suggestion)}
              >
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
    return <span className="text-muted">-</span>;
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
    if (action.type === 'external') {
      return (
        <a href={action.route} className="btn btn-secondary btn-sm" download={action.route.endsWith('.pdf') || undefined}>
          <i className="bi bi-download me-1" aria-hidden="true" />
          {action.label}
        </a>
      );
    }
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
  if (kind === 'knowledge_result') return 'Guide';
  if (kind === 'navigation_result') return 'Navigation';
  if (kind === 'app_help') return 'Help';
  if (kind === 'clarification') return 'Clarification';
  return 'Answer';
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
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
