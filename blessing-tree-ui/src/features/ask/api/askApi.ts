import { apiFetchJson } from '@/shared/api/client';
import type { AskAction, AskReportResult, AskResponse } from '@/features/ask/model/askTypes';

interface RawAskAction {
  type?: string;
  label?: string;
  route?: string | null;
  prompt?: string | null;
  required_capability?: string | null;
}

interface RawAskReport {
  metric_key?: string;
  summary?: { label?: string; value?: number };
  columns?: Array<{ key?: string; label?: string }>;
  rows?: Record<string, unknown>[];
  totals?: { row_count?: number; limited?: boolean } | null;
}

interface RawAskResponse {
  kind?: AskResponse['kind'];
  answer?: string;
  confidence?: number;
  title?: string;
  steps?: string[];
  actions?: RawAskAction[];
  report?: RawAskReport;
  interpreted_as?: {
    intent?: string | null;
    subject?: string | null;
    filters?: Record<string, unknown>;
    filter_chips?: string[];
  } | null;
  warnings?: string[];
  suggestions?: string[];
}

export async function askBlessingTree(campaignId: string, prompt: string): Promise<AskResponse> {
  const response = await apiFetchJson<RawAskResponse>(`/api/v1/campaigns/${campaignId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return normalizeAskResponse(response);
}

function normalizeAskResponse(response: RawAskResponse): AskResponse {
  return {
    kind: response.kind ?? 'error',
    answer: response.answer ?? 'Unable to answer that request.',
    confidence: Number(response.confidence ?? 0),
    title: response.title,
    steps: Array.isArray(response.steps) ? response.steps : [],
    actions: (response.actions ?? []).map(normalizeAction),
    report: response.report ? normalizeReport(response.report) : undefined,
    interpretedAs: response.interpreted_as
      ? {
          intent: response.interpreted_as.intent ?? null,
          subject: response.interpreted_as.subject ?? null,
          filters: response.interpreted_as.filters ?? {},
          filterChips: response.interpreted_as.filter_chips ?? [],
        }
      : null,
    warnings: response.warnings ?? [],
    suggestions: response.suggestions ?? [],
  };
}

function normalizeAction(action: RawAskAction): AskAction {
  const type = action.type === 'prompt' || action.type === 'external' ? action.type : 'route';
  return {
    type,
    label: action.label ?? 'Open',
    route: action.route ?? null,
    prompt: action.prompt ?? null,
    requiredCapability: action.required_capability ?? null,
  };
}

function normalizeReport(report: RawAskReport): AskReportResult {
  return {
    metricKey: report.metric_key ?? '',
    summary: {
      label: report.summary?.label ?? 'Results',
      value: Number(report.summary?.value ?? 0),
    },
    columns: (report.columns ?? []).map((column) => ({
      key: column.key ?? '',
      label: column.label ?? column.key ?? '',
    })),
    rows: report.rows ?? [],
    totals: report.totals
      ? {
          rowCount: Number(report.totals.row_count ?? 0),
          limited: Boolean(report.totals.limited),
        }
      : null,
  };
}
