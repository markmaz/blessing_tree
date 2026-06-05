import {
  exportReportToCsv,
  exportReportToExcel,
  printReportToPdf,
  type ReportExportPayload,
} from '@/features/reports/model/reportExport';

type ReportExportFormat = 'pdf' | 'excel' | 'csv';

export function ReportExportActions({
  payload,
  disabled = false,
  formats = ['pdf', 'excel'],
}: {
  payload: ReportExportPayload;
  disabled?: boolean;
  formats?: ReportExportFormat[];
}) {
  const hasRows = payload.sheets.some((sheet) => sheet.rows.length > 0);
  const isDisabled = disabled || !hasRows;
  return (
    <div className="d-flex flex-wrap gap-2">
      {formats.includes('pdf') ? (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isDisabled}
          onClick={() => printReportToPdf(payload)}
        >
          <i className="bi bi-file-earmark-pdf me-2" aria-hidden="true" />
          PDF
        </button>
      ) : null}
      {formats.includes('excel') ? (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isDisabled}
          onClick={() => exportReportToExcel(payload)}
        >
          <i className="bi bi-file-earmark-spreadsheet me-2" aria-hidden="true" />
          Excel
        </button>
      ) : null}
      {formats.includes('csv') ? (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isDisabled}
          onClick={() => exportReportToCsv(payload)}
        >
          <i className="bi bi-filetype-csv me-2" aria-hidden="true" />
          CSV
        </button>
      ) : null}
    </div>
  );
}
