interface ExpandCollapseControlsProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  disabled?: boolean;
  className?: string;
}

export function ExpandCollapseControls({
  onExpandAll,
  onCollapseAll,
  disabled = false,
  className,
}: ExpandCollapseControlsProps) {
  return (
    <div className={['app-expand-collapse-controls', className].filter(Boolean).join(' ')}>
      <button type="button" className="btn btn-outline-secondary btn-sm" disabled={disabled} onClick={onExpandAll}>
        <i className="bi bi-arrows-expand me-2" aria-hidden="true" />
        Expand All
      </button>
      <button type="button" className="btn btn-outline-secondary btn-sm" disabled={disabled} onClick={onCollapseAll}>
        <i className="bi bi-arrows-collapse me-2" aria-hidden="true" />
        Collapse All
      </button>
    </div>
  );
}
