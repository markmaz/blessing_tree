export interface ReportExportColumn {
  key: string;
  label: string;
}

export type ReportExportRow = Record<string, unknown>;

export interface ReportExportSheet {
  name: string;
  columns: ReportExportColumn[];
  rows: ReportExportRow[];
}

export interface ReportExportPayload {
  title: string;
  subtitle?: string;
  fileName: string;
  sheets: ReportExportSheet[];
}

export function exportReportToExcel(payload: ReportExportPayload): void {
  const workbookHtml = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">',
    '<head><meta charset="utf-8" /></head><body>',
    `<h1>${escapeHtml(payload.title)}</h1>`,
    payload.subtitle ? `<p>${escapeHtml(payload.subtitle)}</p>` : '',
    ...payload.sheets.map(sheetToHtml),
    '</body></html>',
  ].join('');
  const blob = new Blob([workbookHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(payload.fileName)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function printReportToPdf(payload: ReportExportPayload): void {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    window.alert('Unable to open the print view. Please allow pop-ups and try again.');
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(payload.title)}</title>
        <style>
          body { color: #17231d; font-family: Arial, sans-serif; margin: 24px; }
          h1 { font-size: 22px; margin: 0 0 4px; }
          h2 { font-size: 16px; margin: 24px 0 8px; }
          p { color: #5f6b63; margin: 0 0 16px; }
          table { border-collapse: collapse; font-size: 12px; width: 100%; }
          th, td { border: 1px solid #cfd8d2; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { background: #eef4f0; }
          tr:nth-child(even) td { background: #f8faf9; }
          @media print { body { margin: 16px; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(payload.title)}</h1>
        ${payload.subtitle ? `<p>${escapeHtml(payload.subtitle)}</p>` : ''}
        ${payload.sheets.map(sheetToHtml).join('')}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 150);
}

function sheetToHtml(sheet: ReportExportSheet): string {
  return `
    <h2>${escapeHtml(sheet.name)}</h2>
    <table>
      <thead>
        <tr>${sheet.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${
          sheet.rows.length
            ? sheet.rows
                .map(
                  (row) =>
                    `<tr>${sheet.columns.map((column) => `<td>${escapeHtml(formatExportCell(row[column.key]))}</td>`).join('')}</tr>`
                )
                .join('')
            : `<tr><td colspan="${sheet.columns.length || 1}">No rows</td></tr>`
        }
      </tbody>
    </table>
  `;
}

function formatExportCell(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value).replaceAll('_', ' ');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeFileName(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'report-export';
}
