import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

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

export function printReportToPdf(payload: ReportExportPayload): void {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const margin = 36;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  pdf.setTextColor(23, 35, 29);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  y = drawWrappedText(pdf, payload.title, margin, y, contentWidth, 22);

  if (payload.subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(95, 107, 99);
    pdf.setFontSize(10);
    y = drawWrappedText(pdf, payload.subtitle, margin, y + 2, contentWidth, 14);
  }

  for (const sheet of payload.sheets) {
    y = ensureSpace(pdf, y + 18, 56, margin, pageHeight);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(23, 35, 29);
    pdf.setFontSize(13);
    pdf.text(sheet.name, margin, y);
    y += 18;
    y = drawPdfTable(pdf, sheet, margin, y, contentWidth, pageHeight);
  }

  pdf.save(`${safeFileName(payload.fileName)}.pdf`);
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
  pdf: jsPDF,
  sheet: ReportExportSheet,
  margin: number,
  startY: number,
  contentWidth: number,
  pageHeight: number
): number {
  const columns = sheet.columns.length ? sheet.columns : [{ key: 'value', label: 'Value' }];
  const rows = sheet.rows.length ? sheet.rows : [{ value: 'No rows' }];
  const rowPadding = 5;
  const lineHeight = 10;
  const minRowHeight = 22;
  const columnWidth = contentWidth / columns.length;
  let y = drawPdfHeaderRow(pdf, columns, margin, startY, columnWidth, rowPadding, lineHeight);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  rows.forEach((row, rowIndex) => {
    const cellLines = columns.map((column) =>
      pdf.splitTextToSize(formatExportCell(row[column.key]), Math.max(columnWidth - rowPadding * 2, 20)) as string[]
    );
    const rowHeight = Math.max(minRowHeight, Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + rowPadding * 2);
    y = ensureSpace(pdf, y, rowHeight + 24, margin, pageHeight, () =>
      drawPdfHeaderRow(pdf, columns, margin, margin, columnWidth, rowPadding, lineHeight)
    );
    pdf.setFillColor(rowIndex % 2 === 0 ? 255 : 248, rowIndex % 2 === 0 ? 255 : 250, rowIndex % 2 === 0 ? 255 : 249);
    pdf.rect(margin, y, contentWidth, rowHeight, 'F');
    pdf.setDrawColor(207, 216, 210);
    pdf.rect(margin, y, contentWidth, rowHeight);
    columns.forEach((_, columnIndex) => {
      const x = margin + columnIndex * columnWidth;
      if (columnIndex > 0) {
        pdf.line(x, y, x, y + rowHeight);
      }
      pdf.setTextColor(23, 35, 29);
      pdf.text(cellLines[columnIndex], x + rowPadding, y + rowPadding + 8, {
        maxWidth: columnWidth - rowPadding * 2,
      });
    });
    y += rowHeight;
  });
  return y;
}

function drawPdfHeaderRow(
  pdf: jsPDF,
  columns: ReportExportColumn[],
  margin: number,
  y: number,
  columnWidth: number,
  rowPadding: number,
  lineHeight: number
): number {
  const contentWidth = columns.length * columnWidth;
  const headerLines = columns.map((column) =>
    pdf.splitTextToSize(column.label, Math.max(columnWidth - rowPadding * 2, 20)) as string[]
  );
  const headerHeight = Math.max(24, Math.max(...headerLines.map((lines) => lines.length)) * lineHeight + rowPadding * 2);
  pdf.setFillColor(238, 244, 240);
  pdf.setDrawColor(207, 216, 210);
  pdf.rect(margin, y, contentWidth, headerHeight, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(23, 35, 29);
  columns.forEach((_, columnIndex) => {
    const x = margin + columnIndex * columnWidth;
    if (columnIndex > 0) {
      pdf.line(x, y, x, y + headerHeight);
    }
    pdf.text(headerLines[columnIndex], x + rowPadding, y + rowPadding + 8, {
      maxWidth: columnWidth - rowPadding * 2,
    });
  });
  pdf.setFont('helvetica', 'normal');
  return y + headerHeight;
}

function drawWrappedText(
  pdf: jsPDF,
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
  pdf: jsPDF,
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
