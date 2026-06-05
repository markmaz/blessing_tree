import {
  buildMobileReceiveDropoffPath,
  buildMobileReceivePath,
} from '@/app/routes';

export type MobileScanDestination =
  | { type: 'dropoff'; path: string }
  | { type: 'gift-label'; path: string }
  | { type: 'recipient-id'; recipientId: string; path: string }
  | { type: 'unknown'; value: string };

export function resolveMobileScanDestination(value: string): MobileScanDestination {
  const normalized = value.trim();
  if (!normalized) {
    return { type: 'unknown', value: normalized };
  }

  const parsedUrl = parseUrl(normalized);
  if (parsedUrl) {
    const path = parsedUrl.pathname.replace(/\/+$/, '');
    const dropoffMatch = path.match(/\/mobile\/receive\/dropoff\/([^/]+)$/);
    if (dropoffMatch?.[1]) {
      return {
        type: 'dropoff',
        path: buildMobileReceiveDropoffPath(decodeURIComponent(dropoffMatch[1])),
      };
    }

    const giftScanMatch = path.match(/\/(?:public\/gifts\/scan|scan\/gifts)\/([^/]+)$/);
    if (giftScanMatch?.[1]) {
      return {
        type: 'gift-label',
        path: `${path}${parsedUrl.search}`,
      };
    }
  }

  if (looksLikeRecipientId(normalized)) {
    return {
      type: 'recipient-id',
      recipientId: normalized.toUpperCase(),
      path: buildMobileReceivePath(),
    };
  }

  return { type: 'unknown', value: normalized };
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value, window.location.origin);
  } catch {
    return null;
  }
}

function looksLikeRecipientId(value: string): boolean {
  return /^[A-Z]{2,6}[-\s]?\d{1,5}$/i.test(value.trim());
}
