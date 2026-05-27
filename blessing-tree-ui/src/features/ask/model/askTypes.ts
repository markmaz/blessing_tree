export type AskResultKind = 'app_help' | 'navigation_result' | 'report_result' | 'clarification' | 'error';

export interface AskAction {
  type: 'route' | 'prompt' | 'external';
  label: string;
  route: string | null;
  prompt: string | null;
  requiredCapability: string | null;
}

export interface AskInterpretation {
  intent: string | null;
  subject: string | null;
  filters: Record<string, unknown>;
  filterChips: string[];
}

export interface AskReportColumn {
  key: string;
  label: string;
}

export interface AskReportSummary {
  label: string;
  value: number;
}

export interface AskReportResult {
  metricKey: string;
  summary: AskReportSummary;
  columns: AskReportColumn[];
  rows: Record<string, unknown>[];
  totals: {
    rowCount: number;
    limited: boolean;
  } | null;
}

export interface AskResponse {
  kind: AskResultKind;
  answer: string;
  confidence: number;
  title?: string;
  steps?: string[];
  actions: AskAction[];
  report?: AskReportResult;
  interpretedAs: AskInterpretation | null;
  warnings: string[];
  suggestions: string[];
}
