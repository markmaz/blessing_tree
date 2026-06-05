export const MOBILE_FULL_SITE_PREFERENCE_KEY = 'bt-mobile-full-site';

const PHONE_WIDTH_MAX = 767;

export type MobileDeviceSignals = {
  userAgent: string;
  viewportWidth: number;
  maxTouchPoints: number;
  hasCoarsePointer: boolean;
  hasHoverNone: boolean;
};

export function isMobilePhoneDevice({
  userAgent,
  viewportWidth,
  maxTouchPoints,
  hasCoarsePointer,
  hasHoverNone,
}: MobileDeviceSignals): boolean {
  const normalizedUserAgent = userAgent.toLowerCase();
  const hasPhoneUserAgent =
    /iphone|ipod|windows phone|iemobile|blackberry/.test(normalizedUserAgent) ||
    /android/.test(normalizedUserAgent) && /mobile/.test(normalizedUserAgent);

  return (
    hasPhoneUserAgent &&
    viewportWidth <= PHONE_WIDTH_MAX &&
    maxTouchPoints > 0 &&
    hasCoarsePointer &&
    hasHoverNone
  );
}

export function getBrowserMobileDeviceSignals(): MobileDeviceSignals {
  return {
    userAgent: window.navigator.userAgent,
    viewportWidth: window.innerWidth,
    maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
    hasCoarsePointer: window.matchMedia('(pointer: coarse)').matches,
    hasHoverNone: window.matchMedia('(hover: none)').matches,
  };
}

export function shouldUseMobileOperatorMode(): boolean {
  return isMobilePhoneDevice(getBrowserMobileDeviceSignals());
}

export function getPrefersFullSite(): boolean {
  try {
    return window.localStorage.getItem(MOBILE_FULL_SITE_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPrefersFullSite(value: boolean): void {
  try {
    if (value) {
      window.localStorage.setItem(MOBILE_FULL_SITE_PREFERENCE_KEY, 'true');
    } else {
      window.localStorage.removeItem(MOBILE_FULL_SITE_PREFERENCE_KEY);
    }
  } catch {
    // Ignore storage failures. Routing still works for the current click.
  }
}
