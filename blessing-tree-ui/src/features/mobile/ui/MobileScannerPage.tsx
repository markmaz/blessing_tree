import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { IScannerControls } from '@zxing/browser';
import { buildMobileReceivePath } from '@/app/routes';
import { resolveMobileScanDestination } from '@/features/mobile/model/mobileScanner';

type ReceiveRouteState = {
  recipientId?: string;
  autoLookup?: boolean;
};

export function MobileScannerPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledResultRef = useRef(false);
  const [manualValue, setManualValue] = useState('');
  const [status, setStatus] = useState('Starting camera...');
  const [error, setError] = useState<string | null>(null);

  const stopActiveScanner = useCallback((controls?: IScannerControls) => {
    (controls ?? controlsRef.current)?.stop();
    controlsRef.current = null;
  }, []);

  const routeScanResult = useCallback((value: string, controls?: IScannerControls) => {
    const destination = resolveMobileScanDestination(value);
    if (destination.type === 'dropoff' || destination.type === 'gift-label') {
      stopActiveScanner(controls);
      navigate(destination.path);
      return;
    }
    if (destination.type === 'recipient-id') {
      const state: ReceiveRouteState = {
        recipientId: destination.recipientId,
        autoLookup: true,
      };
      stopActiveScanner(controls);
      navigate(destination.path, { state });
      return;
    }

    handledResultRef.current = false;
    setError(scanErrorMessage(destination.reason));
  }, [navigate, stopActiveScanner]);

  useEffect(() => {
    let isMounted = true;

    async function startScanner() {
      if (!videoRef.current) {
        return;
      }
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (!isMounted || !videoRef.current) {
          return;
        }
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 500,
        });
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, scanError, callbackControls) => {
          if (result && !handledResultRef.current) {
            handledResultRef.current = true;
            routeScanResult(result.getText(), callbackControls);
            return;
          }

          if (scanError && isMounted) {
            setStatus('Point the camera at a QR code.');
          }
        });
        if (!isMounted) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus('Point the camera at a sponsor QR code or gift label.');
      } catch (startError) {
        if (!isMounted) {
          return;
        }
        setError(startError instanceof Error ? startError.message : 'Unable to start the camera.');
        setStatus('Use manual entry below.');
      }
    }

    void startScanner();

    return () => {
      isMounted = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [routeScanResult]);

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualValue.trim()) {
      return;
    }
    routeScanResult(manualValue);
  }

  return (
    <section className="mobile-page mobile-scanner-page">
      <div className="mobile-page__hero">
        <span className="mobile-page__eyebrow">Scanner</span>
        <h1>Scan a QR code</h1>
        <p>Use this for sponsor drop-off emails now. Recipient IDs can be typed below if the camera is unavailable.</p>
      </div>

      {error ? <div className="mobile-alert mobile-alert--danger">{error}</div> : null}

      <section className="mobile-scanner-card" aria-label="QR scanner">
        <div className="mobile-scanner-card__viewport">
          <video ref={videoRef} muted playsInline aria-label="QR scanner camera preview" />
          <div className="mobile-scanner-card__frame" aria-hidden="true" />
        </div>
        <div className="mobile-scanner-card__status">
          <i className="bi bi-qr-code-scan" aria-hidden="true" />
          <span>{status}</span>
        </div>
      </section>

      <form className="mobile-search-card" onSubmit={handleManualSubmit}>
        <label className="mobile-search-card__label" htmlFor="mobile-manual-scan">
          Manual Entry
        </label>
        <div className="mobile-search-card__input-wrap">
          <i className="bi bi-keyboard" aria-hidden="true" />
          <input
            id="mobile-manual-scan"
            className="mobile-search-card__input"
            type="search"
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="BT-001 or QR URL"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="mobile-primary-action" disabled={!manualValue.trim()}>
          Open
        </button>
      </form>

      <Link to={buildMobileReceivePath()} className="mobile-secondary-action mobile-scanner-page__back">
        Back to Receive
      </Link>
    </section>
  );
}

function scanErrorMessage(reason: 'empty' | 'missing-dropoff-token' | 'unsupported-url' | 'unsupported-text'): string {
  if (reason === 'missing-dropoff-token') {
    return 'That sponsor QR is missing its secure drop-off token. Use the latest sponsor email or ask a campaign manager to resend it.';
  }
  if (reason === 'unsupported-url') {
    return 'That QR opens a page Blessing Tree cannot receive from. Scan a sponsor drop-off QR, gift label, or type a recipient ID.';
  }
  if (reason === 'empty') {
    return 'Enter a recipient ID or paste the full QR link.';
  }
  return 'That code is not a Blessing Tree sponsor QR, gift label, or recipient ID.';
}
