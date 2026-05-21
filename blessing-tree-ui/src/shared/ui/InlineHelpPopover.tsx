import { useId, useState } from 'react';

interface InlineHelpPopoverProps {
  title: string;
  body: string;
  className?: string;
}

export function InlineHelpPopover({
  title,
  body,
  className,
}: InlineHelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <span className={`inline-help ${className ?? ''}`.trim()}>
      <button
        type="button"
        className={`inline-help__button ${open ? 'is-open' : ''}`}
        aria-label={`Help: ${title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <i className="bi bi-question-circle" aria-hidden="true" />
      </button>
      {open ? (
        <span id={panelId} className="inline-help__panel" role="note">
          <strong>{title}</strong>
          <span>{body}</span>
        </span>
      ) : null}
    </span>
  );
}
