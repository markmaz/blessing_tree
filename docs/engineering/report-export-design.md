# Report Export Design

Last updated: 2026-06-01

## Status

Implemented for the shared frontend report export path and Admin Activity Log.

The current implementation generates:

- real PDF files through the shared PDF export helper
- true Excel `.xlsx` workbooks through the shared Excel export helper

Related files:

- `blessing-tree-ui/src/features/reports/model/reportExport.ts`
- `blessing-tree-ui/src/features/reports/ui/ReportExportActions.tsx`
- `blessing-tree-ui/src/pages/AdminActivityLogPage.tsx`
- report pages under `blessing-tree-ui/src/pages/`
- `docs/user-guide/build_blessing_tree_user_guide.py`
- `docs/user-guide/build_blessing_tree_user_guide_pdf.py`

## Purpose

Users need to save and share report results without relying on browser print or
CSV files masquerading as spreadsheets.

The export behavior should be predictable for non-technical staff:

- PDF means a readable snapshot that can be shared or printed.
- Excel means a real workbook that opens in Excel and can be filtered/sorted.

## Current Behavior

Report screens use shared frontend helpers to export the data currently loaded
by the screen.

Admin Activity Log also uses the same helpers. Its exports respect the current
filters and loaded page size.

The exported files include:

- report title
- generated timestamp
- column headers
- row data
- basic formatting appropriate for PDF or Excel

## Export Scope

Current scope is screen-loaded data, not a hidden server-side export of every
matching database row.

This is intentional for the current release because:

- it matches what users are looking at
- it avoids long-running export jobs
- it keeps permissions and filters straightforward
- the current expected row counts are manageable

If users later need "export all matching rows" across many pages, add a
server-side export endpoint per report rather than overloading the current
frontend helper.

## Design Rules

1. Do not produce CSV files with `.xlsx` names.
2. Do not rely on browser print for report PDFs.
3. Keep export buttons visually consistent across report screens.
4. Disable or clearly handle export when there are no rows.
5. Keep file names human-readable and report-specific.
6. Keep export code shared unless a report has a strong reason for custom
   layout.
7. Document when exports use visible/loaded rows instead of all possible rows.

## Testing Expectations

Frontend:

- export buttons render on each report surface that supports export
- empty states do not crash export actions
- Activity Log export buttons call the shared export helpers
- build catches dependency/package-lock drift

Manual smoke:

- export one report PDF and open it
- export one report Excel file and open it in Excel/Numbers/LibreOffice
- export Activity Log PDF and Excel after applying filters

## Future Enhancements

- Server-side export for very large reports.
- Audit logging of report export events if users need traceability.
- Richer PDF formatting for specific executive reports.
- Optional organization logo/header on exports.
- Direct "download guide/report" links from Ask Blessing Tree answers when
  useful.
