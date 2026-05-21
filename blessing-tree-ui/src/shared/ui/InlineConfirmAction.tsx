import { useState } from 'react';

interface InlineConfirmActionProps {
  buttonLabel: string;
  confirmLabel: string;
  cancelLabel?: string;
  message: string;
  tone?: 'danger' | 'secondary';
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function InlineConfirmAction({
  buttonLabel,
  confirmLabel,
  cancelLabel = 'Cancel',
  message,
  tone = 'danger',
  disabled = false,
  onConfirm,
}: InlineConfirmActionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      setIsConfirming(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConfirming) {
    return (
      <button
        type="button"
        className={`btn btn-outline-${tone} btn-sm`}
        onClick={() => setIsConfirming(true)}
        disabled={disabled}
      >
        <i
          className={`bi ${tone === 'danger' ? 'bi-trash3' : 'bi-exclamation-circle'} me-2`}
          aria-hidden="true"
        />
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="campaign-studio__inline-confirm">
      <div className="small text-muted">{message}</div>
      <div className="d-flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-${tone} btn-sm`}
          onClick={() => {
            void handleConfirm();
          }}
          disabled={disabled || isSubmitting}
        >
          <i
            className={`bi ${tone === 'danger' ? 'bi-trash3-fill' : 'bi-check2-circle'} me-2`}
            aria-hidden="true"
          />
          {confirmLabel}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setIsConfirming(false)}
          disabled={disabled || isSubmitting}
        >
          <i className="bi bi-x-lg me-2" aria-hidden="true" />
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
