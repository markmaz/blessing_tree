import { createPortal } from 'react-dom';

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'secondary';
  isSubmitting?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmationModal({
  open,
  title,
  message,
  details = [],
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  isSubmitting = false,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="confirmation-modal__backdrop" role="presentation" onClick={onClose}>
      <div
        className="confirmation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirmation-modal__header">
          <div>
            <div className="confirmation-modal__eyebrow">
              <i className={`bi ${tone === 'danger' ? 'bi-exclamation-triangle' : 'bi-question-circle'}`} aria-hidden="true" />
              <span>Confirm Action</span>
            </div>
            <h3 id="confirmation-modal-title" className="h5 mb-1">
              {title}
            </h3>
            <p className="mb-0 text-muted">{message}</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
            <span className="ms-2">{cancelLabel}</span>
          </button>
        </div>

        {details.length ? (
          <div className="confirmation-modal__body">
            <div className="confirmation-modal__card">
              <div className="confirmation-modal__card-heading">
                <i className="bi bi-list-check" aria-hidden="true" />
                <span>This will delete</span>
              </div>
              <ul className="confirmation-modal__list mb-0">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="campaign-team-drawer__actions mt-3">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <i className="bi bi-x-circle me-2" aria-hidden="true" />
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn btn-${tone} btn-sm`}
            onClick={() => {
              void onConfirm();
            }}
            disabled={isSubmitting}
          >
            <i className={`bi ${tone === 'danger' ? 'bi-trash3-fill' : 'bi-check2-circle'} me-2`} aria-hidden="true" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
