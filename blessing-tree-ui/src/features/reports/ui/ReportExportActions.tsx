import {
  exportReportToExcel,
  printReportToPdf,
  type ReportExportPayload,
} from '@/features/reports/model/reportExport';

export function ReportExportActions({
  payload,
  disabled = false,
}: {
  payload: ReportExportPayload;
  disabled?: boolean;
}) {
  const hasRows = payload.sheets.some((sheet) => sheet.rows.length > 0);
  const isDisabled = disabled || !hasRows;
  return (
    <div className="d-flex flex-wrap gap-2">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={isDisabled}
        onClick={() => printReportToPdf(payload)}
      >
        <i className="bi bi-file-earmark-pdf me-2" aria-hidden="true" />
        PDF
      </button>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={isDisabled}
        onClick={() => exportReportToExcel(payload)}
      >
        <i className="bi bi-file-earmark-spreadsheet me-2" aria-hidden="true" />
        Excel
      </button>
    </div>
  );
}
