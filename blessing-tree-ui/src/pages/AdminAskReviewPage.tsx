import { useEffect, useMemo, useState } from 'react';
import { fetchAdminAskReview, markAdminAskPromptReviewed } from '@/features/admin/api/adminApi';
import type { AdminAskReviewLog } from '@/features/admin/model/adminTypes';

export function AdminAskReviewPage() {
  const [logs, setLogs] = useState<AdminAskReviewLog[]>([]);
  const [reviewOnly, setReviewOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    async function loadReview() {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await fetchAdminAskReview(reviewOnly);
        if (isActive) {
          setLogs(payload.logs);
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load Ask review.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }
    void loadReview();
    return () => {
      isActive = false;
    };
  }, [reviewOnly]);

  const stats = useMemo(() => {
    const negativeCount = logs.filter((log) => log.feedbackRating === 'NEGATIVE').length;
    const clarificationCount = logs.filter((log) => log.resultKind === 'clarification').length;
    const lowConfidenceCount = logs.filter((log) => (log.confidence ?? 1) < 0.55).length;
    return { negativeCount, clarificationCount, lowConfidenceCount };
  }, [logs]);

  async function copyText(logId: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(logId);
      window.setTimeout(() => setCopiedId((currentValue) => (currentValue === logId ? null : currentValue)), 1800);
    } catch {
      setError('Unable to copy to clipboard.');
    }
  }

  async function markReviewed(log: AdminAskReviewLog) {
    setPendingReviewId(log.id);
    setError(null);
    try {
      const updated = await markAdminAskPromptReviewed(log.id, 'Reviewed from Ask Review.');
      setLogs((currentValue) => {
        if (reviewOnly) {
          return currentValue.filter((item) => item.id !== log.id);
        }
        return currentValue.map((item) => (item.id === log.id ? updated : item));
      });
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to mark prompt reviewed.');
    } finally {
      setPendingReviewId(null);
    }
  }

  return (
    <section className="vstack gap-4">
      <div className="campaign-studio-page__header">
        <div>
          <div className="campaign-chip-row mb-3">
            <span className="campaign-chip campaign-chip-muted">Admin</span>
            <span className="campaign-chip campaign-chip-muted">Ask Blessing Tree</span>
          </div>
          <h1 className="h3 mb-1">Ask Review</h1>
          <p className="text-muted mb-0">
            Review failed, low-confidence, and negatively rated Ask Blessing Tree answers.
          </p>
        </div>
        <div className="btn-group" role="group" aria-label="Ask review filter">
          <button
            type="button"
            className={`btn btn-sm ${reviewOnly ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setReviewOnly(true)}
          >
            Needs Review
          </button>
          <button
            type="button"
            className={`btn btn-sm ${!reviewOnly ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setReviewOnly(false)}
          >
            All Prompts
          </button>
        </div>
      </div>

      <div className="row g-3">
        <AskReviewStat label="Negative Feedback" value={stats.negativeCount} />
        <AskReviewStat label="Clarifications" value={stats.clarificationCount} />
        <AskReviewStat label="Low Confidence" value={stats.lowConfidenceCount} />
      </div>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

      <div className="content-card">
        {isLoading ? (
          <p className="text-muted mb-0">Loading Ask review...</p>
        ) : logs.length === 0 ? (
          <p className="text-muted mb-0">No Ask prompts match this filter.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Prompt</th>
                  <th>Matched</th>
                  <th>Campaign</th>
                  <th>User</th>
                  <th>Feedback</th>
                  <th>Asked</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="fw-semibold">{log.prompt}</div>
                      <div className="text-muted small">{summaryText(log.responseSummary)}</div>
                    </td>
                    <td>
                      <span className="badge text-bg-light">{log.resultKey ?? log.resultKind}</span>
                      <div className="text-muted small">
                        {Math.round((log.confidence ?? 0) * 100)}% {log.source ?? ''}
                      </div>
                    </td>
                    <td>{log.campaignName ?? log.campaignId}</td>
                    <td>{log.userName ?? 'Unknown'}</td>
                    <td>
                      {log.feedbackRating ? (
                        <>
                          <span className={`badge ${log.feedbackRating === 'NEGATIVE' ? 'text-bg-danger' : 'text-bg-success'}`}>
                            {log.feedbackRating.toLowerCase()}
                          </span>
                          {log.feedbackComment ? <div className="text-muted small mt-1">{log.feedbackComment}</div> : null}
                        </>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </td>
                    <td>
                      <div>{formatDate(log.createdAt)}</div>
                      {log.reviewedAt ? <div className="text-muted small">Reviewed {formatDate(log.reviewedAt)}</div> : null}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm" role="group" aria-label={`Ask review actions for ${log.prompt}`}>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => void copyText(`${log.id}-prompt`, log.prompt)}
                          title="Copy prompt"
                        >
                          <i className="bi bi-clipboard" aria-hidden="true" />
                          <span className="visually-hidden">Copy prompt</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => void copyText(`${log.id}-alias`, buildAliasBacklogNote(log))}
                          title="Copy alias backlog note"
                        >
                          <i className="bi bi-journal-plus" aria-hidden="true" />
                          <span className="visually-hidden">Copy alias backlog note</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-success"
                          disabled={Boolean(log.reviewedAt) || pendingReviewId === log.id}
                          onClick={() => void markReviewed(log)}
                          title="Mark reviewed"
                        >
                          <i className="bi bi-check2" aria-hidden="true" />
                          <span className="visually-hidden">Mark reviewed</span>
                        </button>
                      </div>
                      {copiedId?.startsWith(log.id) ? <div className="text-success small mt-1">Copied</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function AskReviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="col-12 col-md-4">
      <div className="content-card h-100">
        <div className="text-muted small">{label}</div>
        <div className="display-6 fw-semibold">{value}</div>
      </div>
    </div>
  );
}

function summaryText(summary: Record<string, unknown>): string {
  const answer = summary.answer;
  return typeof answer === 'string' && answer.trim() ? answer : 'No answer summary recorded.';
}

function buildAliasBacklogNote(log: AdminAskReviewLog): string {
  return [
    'Ask Blessing Tree alias candidate',
    '',
    `Prompt: ${log.prompt}`,
    `Current match: ${log.resultKey ?? log.resultKind}`,
    `Confidence: ${Math.round((log.confidence ?? 0) * 100)}%`,
    `Feedback: ${log.feedbackRating ?? 'none'}`,
    log.feedbackComment ? `Comment: ${log.feedbackComment}` : null,
    '',
    'Decision needed:',
    '- Add as phrase/alias to an existing help topic or report metric',
    '- Or create a new fixed report/help topic',
  ].filter(Boolean).join('\n');
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
