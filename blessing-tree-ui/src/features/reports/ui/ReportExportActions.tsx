import { useState } from 'react';
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
  const [exportingFormat, setExportingFormat] = useState<ReportExportFormat | null>(null);
  const hasRows = payload.sheets.some((sheet) => sheet.rows.length > 0);
  const isDisabled = disabled || !hasRows || exportingFormat !== null;

  const handleExport = async (format: ReportExportFormat) => {
    setExportingFormat(format);
    try {
      if (format === 'pdf') {
        await printReportToPdf(payload);
      } else if (format === 'excel') {
        await exportReportToExcel(payload);
      } else {
        exportReportToCsv(payload);
      }
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="app-export-actions" aria-label="Report export actions">
      {formats.includes('pdf') ? (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isDisabled}
          onClick={() => void handleExport('pdf')}
        >
          <i className="bi bi-file-earmark-pdf me-2" aria-hidden="true" />
          {exportingFormat === 'pdf' ? 'Preparing...' : 'PDF'}
        </button>
      ) : null}
      {formats.includes('excel') ? (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isDisabled}
          onClick={() => void handleExport('excel')}
        >
          <i className="bi bi-file-earmark-spreadsheet me-2" aria-hidden="true" />
          {exportingFormat === 'excel' ? 'Preparing...' : 'Excel'}
        </button>
      ) : null}
      {formats.includes('csv') ? (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isDisabled}
          onClick={() => void handleExport('csv')}
        >
          <i className="bi bi-filetype-csv me-2" aria-hidden="true" />
          {exportingFormat === 'csv' ? 'Preparing...' : 'CSV'}
        </button>
      ) : null}
    </div>
  );
}
