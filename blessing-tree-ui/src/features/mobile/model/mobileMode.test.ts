import { describe, expect, it, beforeEach } from 'vitest';
import {
  MOBILE_FULL_SITE_PREFERENCE_KEY,
  getPrefersFullSite,
  isMobilePhoneDevice,
  setPrefersFullSite,
  type MobileDeviceSignals,
} from './mobileMode';

const phoneSignals: MobileDeviceSignals = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  viewportWidth: 390,
  maxTouchPoints: 5,
  hasCoarsePointer: true,
  hasHoverNone: true,
};

describe('mobileMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('detects iPhone-sized touch browsers as mobile operator mode candidates', () => {
    expect(isMobilePhoneDevice(phoneSignals)).toBe(true);
  });

  it('detects Android phone browsers as mobile operator mode candidates', () => {
    expect(
      isMobilePhoneDevice({
        ...phoneSignals,
        userAgent:
          'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
      })
    ).toBe(true);
  });

  it('does not classify narrow desktop browsers as phones', () => {
    expect(
      isMobilePhoneDevice({
        ...phoneSignals,
        userAgent:
          'Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
        maxTouchPoints: 0,
        hasCoarsePointer: false,
        hasHoverNone: false,
      })
    ).toBe(false);
  });

  it('does not classify tablet-width mobile browsers as phones', () => {
    expect(
      isMobilePhoneDevice({
        ...phoneSignals,
        userAgent:
          'Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
        viewportWidth: 1024,
      })
    ).toBe(false);
  });

  it('stores and clears the full-site preference', () => {
    expect(getPrefersFullSite()).toBe(false);

    setPrefersFullSite(true);
    expect(window.localStorage.getItem(MOBILE_FULL_SITE_PREFERENCE_KEY)).toBe('true');
    expect(getPrefersFullSite()).toBe(true);

    setPrefersFullSite(false);
    expect(window.localStorage.getItem(MOBILE_FULL_SITE_PREFERENCE_KEY)).toBeNull();
    expect(getPrefersFullSite()).toBe(false);
  });
});
