import {
  buildMobileReceiveDropoffPath,
  buildMobileReceivePath,
} from '@/app/routes';

export type MobileScanDestination =
  | { type: 'dropoff'; path: string }
  | { type: 'gift-label'; path: string }
  | { type: 'recipient-id'; recipientId: string; path: string }
  | {
      type: 'unknown';
      value: string;
      reason: 'empty' | 'missing-dropoff-token' | 'unsupported-url' | 'unsupported-text';
    };

export function resolveMobileScanDestination(value: string): MobileScanDestination {
  const normalized = value.trim();
  if (!normalized) {
    return { type: 'unknown', value: normalized, reason: 'empty' };
  }

  const parsedUrl = parseUrl(normalized);
  if (parsedUrl) {
    const path = parsedUrl.pathname.replace(/\/+$/, '');
    if (path === '/mobile/receive/dropoff') {
      return {
        type: 'unknown',
        value: normalized,
        reason: 'missing-dropoff-token',
      };
    }

    const dropoffMatch = path.match(/\/mobile\/receive\/dropoff\/([^/]+)$/);
    if (dropoffMatch?.[1]) {
      return {
        type: 'dropoff',
        path: buildMobileReceiveDropoffPath(decodeURIComponent(dropoffMatch[1]), parsedUrl.searchParams.get('campaignId')),
      };
    }

    const giftScanMatch = path.match(/\/(?:public\/gifts\/scan|scan\/gifts)\/([^/]+)$/);
    if (giftScanMatch?.[1]) {
      return {
        type: 'gift-label',
        path: `${path}${parsedUrl.search}`,
      };
    }

    if (hasUrlLikeSyntax(normalized)) {
      return { type: 'unknown', value: normalized, reason: 'unsupported-url' };
    }
  }

  if (looksLikeRecipientId(normalized)) {
    return {
      type: 'recipient-id',
      recipientId: normalized.toUpperCase(),
      path: buildMobileReceivePath(),
    };
  }

  return { type: 'unknown', value: normalized, reason: 'unsupported-text' };
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

function hasUrlLikeSyntax(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/');
}
