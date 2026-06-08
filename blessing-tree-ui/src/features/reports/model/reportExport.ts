import type { jsPDF as JsPdf } from 'jspdf';

export interface ReportExportColumn {
  key: string;
  label: string;
  pdfWidthWeight?: number;
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

export async function exportReportToExcel(payload: ReportExportPayload): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  for (const sheet of payload.sheets) {
    const columns = sheet.columns.length ? sheet.columns : [{ key: 'value', label: 'Value' }];
    const rows = sheet.rows.length ? sheet.rows : [{ value: 'No rows' }];
    const sheetData = [
      [payload.title],
      ...(payload.subtitle ? [[payload.subtitle]] : []),
      [],
      columns.map((column) => column.label),
      ...rows.map((row) => columns.map((column) => formatExcelCell(row[column.key]))),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!cols'] = columns.map((column, columnIndex) => ({
      wch: excelColumnWidth(column.label, rows.map((row) => formatExcelCell(row[column.key])), columnIndex),
    }));
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheet.name));
  }
  XLSX.writeFile(workbook, `${safeFileName(payload.fileName)}.xlsx`, { bookType: 'xlsx' });
}

export function exportReportToCsv(payload: ReportExportPayload): void {
  const csvRows: string[] = [
    csvLine([payload.title]),
    ...(payload.subtitle ? [csvLine([payload.subtitle])] : []),
  ];

  for (const sheet of payload.sheets) {
    const columns = sheet.columns.length ? sheet.columns : [{ key: 'value', label: 'Value' }];
    const rows = sheet.rows.length ? sheet.rows : [{ value: 'No rows' }];
    csvRows.push('', csvLine([sheet.name]), csvLine(columns.map((column) => column.label)));
    rows.forEach((row) => {
      csvRows.push(csvLine(columns.map((column) => formatExportCell(row[column.key]))));
    });
  }

  const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(payload.fileName)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function printReportToPdf(payload: ReportExportPayload): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const margin = 24;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  pdf.setTextColor(23, 35, 29);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  y = drawWrappedText(pdf, payload.title, margin, y, contentWidth, 18);

  if (payload.subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(95, 107, 99);
    pdf.setFontSize(8);
    y = drawWrappedText(pdf, payload.subtitle, margin, y + 1, contentWidth, 10);
  }

  for (const sheet of payload.sheets) {
    y = ensureSpace(pdf, y + 12, 40, margin, pageHeight);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(23, 35, 29);
    pdf.setFontSize(10);
    pdf.text(sheet.name, margin, y);
    y += 12;
    y = drawPdfTable(pdf, sheet, margin, y, contentWidth, pageHeight);
  }

  pdf.save(`${safeFileName(payload.fileName)}.pdf`);
}

function csvLine(values: unknown[]): string {
  return values
    .map((value) => {
      const cell = formatExportCell(value);
      return `"${cell.replaceAll('"', '""')}"`;
    })
    .join(',');
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

function formatExcelCell(value: unknown): string | number | boolean | Date {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (value instanceof Date || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value).replaceAll('_', ' ');
}

function safeFileName(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'report-export';
}

function safeSheetName(value: string): string {
  const cleaned = value.replace(/[\\/*[\]?:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31);
  return cleaned || 'Report';
}

function excelColumnWidth(
  header: string,
  values: Array<string | number | boolean | Date>,
  columnIndex: number
): number {
  const sample = [header, ...values.slice(0, 100)].map((value) => String(value ?? ''));
  const maxLength = Math.max(...sample.map((value) => value.length), 10);
  const baseWidth = columnIndex === 0 ? 22 : 14;
  return Math.min(Math.max(maxLength + 2, baseWidth), 48);
}

function drawPdfTable(
  pdf: JsPdf,
  sheet: ReportExportSheet,
  margin: number,
  startY: number,
  contentWidth: number,
  pageHeight: number
): number {
  const columns = sheet.columns.length ? sheet.columns : [{ key: 'value', label: 'Value' }];
  const rows = sheet.rows.length ? sheet.rows : [{ value: 'No rows' }];
  const isCompact = columns.length >= 9;
  const rowPadding = isCompact ? 2.4 : 4;
  const lineHeight = isCompact ? 7.2 : 9;
  const minRowHeight = isCompact ? 13 : 20;
  const bodyFontSize = isCompact ? 6.1 : 7.5;
  const headerFontSize = isCompact ? 6.4 : 7.8;
  const columnWidths = getPdfColumnWidths(columns, contentWidth);
  const hasSectionHeaders = rows.some((row) => isSectionHeaderRow(row.__rowType));
  let y = hasSectionHeaders
    ? startY
    : drawPdfHeaderRow(pdf, columns, margin, startY, columnWidths, rowPadding, lineHeight, headerFontSize);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(bodyFontSize);
  rows.forEach((row, rowIndex) => {
    const rowType = row.__rowType;
    if (isSectionHeaderRow(rowType) || rowType === 'spacer') {
      const rowText = formatExportCell(row[columns[0].key]);
      const isPrimaryHeader = rowType === 'organizationHeader' || rowType === 'sponsorHeader';
      const rowPaddingForHeader = isPrimaryHeader ? 6 : 5;
      const sectionFontSize = isPrimaryHeader ? 9 : 7.4;
      const sectionLineHeight = isPrimaryHeader ? 10.5 : 8.5;
      const sectionLines = rowText
        ? (pdf.splitTextToSize(rowText, Math.max(contentWidth - rowPaddingForHeader * 2, 20)) as string[])
        : [];
      const rowHeight = rowType === 'spacer'
        ? 10
        : Math.max(isPrimaryHeader ? 38 : 26, sectionLines.length * sectionLineHeight + rowPaddingForHeader * 2);
      const headerHeightEstimate = rowType === 'spacer' ? 0 : 18;
      y = ensureSpace(pdf, y, rowHeight + headerHeightEstimate + 18, margin, pageHeight);

      if (rowType === 'spacer') {
        y += rowHeight;
        return;
      }

      if (rowType === 'sponsorHeader') {
        pdf.setFillColor(238, 238, 238);
      } else {
        pdf.setFillColor(255, 255, 255);
      }
      pdf.rect(margin, y, contentWidth, rowHeight, 'F');
      pdf.setDrawColor(0, 0, 0);
      pdf.rect(margin, y, contentWidth, rowHeight);
      pdf.setFont('helvetica', isPrimaryHeader ? 'bold' : 'normal');
      pdf.setFontSize(sectionFontSize);
      pdf.setTextColor(0, 0, 0);
      pdf.text(sectionLines, margin + rowPaddingForHeader, y + rowPaddingForHeader + 7, {
        maxWidth: contentWidth - rowPaddingForHeader * 2,
      });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(bodyFontSize);
      y += rowHeight;
      y = drawPdfHeaderRow(pdf, columns, margin, y, columnWidths, rowPadding, lineHeight, headerFontSize, hasSectionHeaders);
      return;
    }

    const cellLines = columns.map((column, columnIndex) =>
      pdf.splitTextToSize(formatExportCell(row[column.key]), Math.max(columnWidths[columnIndex] - rowPadding * 2, 16)) as string[]
    );
    const rowHeight = Math.max(minRowHeight, Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + rowPadding * 2);
    y = ensureSpace(pdf, y, rowHeight + 18, margin, pageHeight, () =>
      drawPdfHeaderRow(pdf, columns, margin, margin, columnWidths, rowPadding, lineHeight, headerFontSize, hasSectionHeaders)
    );
    if (hasSectionHeaders) {
      if (rowType === 'group') {
        pdf.setFillColor(235, 235, 235);
      } else {
        const shade = rowIndex % 2 === 0 ? 255 : 246;
        pdf.setFillColor(shade, shade, shade);
      }
    } else if (rowType === 'group') {
      pdf.setFillColor(245, 247, 246);
    } else {
      pdf.setFillColor(rowIndex % 2 === 0 ? 255 : 248, rowIndex % 2 === 0 ? 255 : 250, rowIndex % 2 === 0 ? 255 : 249);
    }
    pdf.rect(margin, y, contentWidth, rowHeight, 'F');
    if (hasSectionHeaders) {
      pdf.setDrawColor(0, 0, 0);
    } else {
      pdf.setDrawColor(207, 216, 210);
    }
    pdf.rect(margin, y, contentWidth, rowHeight);
    pdf.setFont('helvetica', rowType === 'group' ? 'bold' : 'normal');
    let x = margin;
    columns.forEach((_, columnIndex) => {
      const columnWidth = columnWidths[columnIndex];
      if (columnIndex > 0) {
        pdf.line(x, y, x, y + rowHeight);
      }
      pdf.setTextColor(hasSectionHeaders ? 0 : 23, hasSectionHeaders ? 0 : 35, hasSectionHeaders ? 0 : 29);
      pdf.text(cellLines[columnIndex], x + rowPadding, y + rowPadding + 8, {
        maxWidth: columnWidth - rowPadding * 2,
      });
      x += columnWidth;
    });
    y += rowHeight;
  });
  return y;
}

function isSectionHeaderRow(rowType: unknown): boolean {
  return rowType === 'organizationHeader' || rowType === 'familyHeader' || rowType === 'sponsorHeader';
}

function drawPdfHeaderRow(
  pdf: JsPdf,
  columns: ReportExportColumn[],
  margin: number,
  y: number,
  columnWidths: number[],
  rowPadding: number,
  lineHeight: number,
  fontSize: number,
  monochrome = false
): number {
  const contentWidth = columnWidths.reduce((total, width) => total + width, 0);
  const headerLines = columns.map((column, columnIndex) =>
    pdf.splitTextToSize(column.label, Math.max(columnWidths[columnIndex] - rowPadding * 2, 16)) as string[]
  );
  const headerHeight = Math.max(14, Math.max(...headerLines.map((lines) => lines.length)) * lineHeight + rowPadding * 2);
  pdf.setFillColor(monochrome ? 242 : 255, monochrome ? 242 : 255, monochrome ? 242 : 255);
  if (monochrome) {
    pdf.setDrawColor(0, 0, 0);
  } else {
    pdf.setDrawColor(207, 216, 210);
  }
  pdf.rect(margin, y, contentWidth, headerHeight, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(monochrome ? 0 : 23, monochrome ? 0 : 35, monochrome ? 0 : 29);
  let x = margin;
  columns.forEach((_, columnIndex) => {
    const columnWidth = columnWidths[columnIndex];
    if (columnIndex > 0) {
      pdf.line(x, y, x, y + headerHeight);
    }
    pdf.text(headerLines[columnIndex], x + rowPadding, y + rowPadding + 6, {
      maxWidth: columnWidth - rowPadding * 2,
    });
    x += columnWidth;
  });
  pdf.setFont('helvetica', 'normal');
  return y + headerHeight;
}

function getPdfColumnWidths(columns: ReportExportColumn[], contentWidth: number): number[] {
  const weights = columns.map((column) => column.pdfWidthWeight ?? 1);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0) || 1;
  return weights.map((weight) => (contentWidth * weight) / totalWeight);
}

function drawWrappedText(
  pdf: JsPdf,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = pdf.splitTextToSize(text, maxWidth) as string[];
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensureSpace(
  pdf: JsPdf,
  y: number,
  requiredHeight: number,
  margin: number,
  pageHeight: number,
  afterPageAdded?: () => number
): number {
  if (y + requiredHeight <= pageHeight - margin) {
    return y;
  }
  pdf.addPage();
  return afterPageAdded?.() ?? margin;
}
