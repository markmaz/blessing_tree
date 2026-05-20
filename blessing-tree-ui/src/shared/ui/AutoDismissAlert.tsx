import { useEffect, useRef, useState } from 'react';

interface AutoDismissAlertProps {
  message: string;
  onDismiss: () => void;
  variant?: 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  durationMs?: number;
  fadeDurationMs?: number;
  showDismissButton?: boolean;
}

export function AutoDismissAlert({
  message,
  onDismiss,
  variant = 'success',
  className = '',
  durationMs = 12000,
  fadeDurationMs = 500,
  showDismissButton = true,
}: AutoDismissAlertProps) {
  const [isExiting, setIsExiting] = useState(false);
  const exitTimeoutRef = useRef<number | null>(null);
  const dismissTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const visibleDuration = Math.max(durationMs - fadeDurationMs, 0);
    exitTimeoutRef.current = window.setTimeout(() => {
      setIsExiting(true);
      dismissTimeoutRef.current = window.setTimeout(onDismiss, fadeDurationMs);
    }, visibleDuration);

    return () => {
      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current);
      }
      if (dismissTimeoutRef.current !== null) {
        window.clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [durationMs, fadeDurationMs, message, onDismiss]);

  const handleManualDismiss = () => {
    if (exitTimeoutRef.current !== null) {
      window.clearTimeout(exitTimeoutRef.current);
    }
    setIsExiting(true);
    if (dismissTimeoutRef.current !== null) {
      window.clearTimeout(dismissTimeoutRef.current);
    }
    dismissTimeoutRef.current = window.setTimeout(onDismiss, fadeDurationMs);
  };

  return (
    <div
      className={`alert alert-${variant} app-auto-dismiss-alert ${
        isExiting ? 'is-exiting' : ''
      } ${className}`.trim()}
      role="alert"
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <span>{message}</span>
        {showDismissButton ? (
          <button
            type="button"
            className={`btn btn-sm btn-outline-${variant}`}
            onClick={handleManualDismiss}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
