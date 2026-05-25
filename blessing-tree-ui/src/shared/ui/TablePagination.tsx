const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  return (
    <div className="campaign-team-table-pagination">
      <div className="campaign-team-table-pagination__summary">
        Showing {start}-{end} of {totalItems} {itemLabel}
      </div>
      <div className="campaign-team-table-pagination__controls">
        <label className="campaign-team-table-pagination__size">
          Rows
          <select
            className="form-select form-select-sm"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="btn-group btn-group-sm" role="group" aria-label={`${itemLabel} pagination`}>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            <i className="bi bi-chevron-left" aria-hidden="true" />
            <span className="visually-hidden">Previous page</span>
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled>
            Page {safePage} of {totalPages}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            <i className="bi bi-chevron-right" aria-hidden="true" />
            <span className="visually-hidden">Next page</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function clampTablePage(page: number, totalItems: number, pageSize: number): number {
  return Math.min(Math.max(page, 1), Math.max(1, Math.ceil(totalItems / pageSize)));
}
