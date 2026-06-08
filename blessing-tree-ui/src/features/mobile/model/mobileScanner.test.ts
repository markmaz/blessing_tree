import { describe, expect, it } from 'vitest';
import { resolveMobileScanDestination } from './mobileScanner';

describe('mobileScanner', () => {
  it('routes sponsor drop-off QR URLs into the mobile drop-off page', () => {
    expect(
      resolveMobileScanDestination('https://app.example.test/mobile/receive/dropoff/abc123')
    ).toEqual({
      type: 'dropoff',
      path: '/mobile/receive/dropoff/abc123',
    });
  });

  it('rejects sponsor drop-off URLs with no token', () => {
    expect(resolveMobileScanDestination('https://app.example.test/mobile/receive/dropoff')).toEqual({
      type: 'unknown',
      value: 'https://app.example.test/mobile/receive/dropoff',
      reason: 'missing-dropoff-token',
    });
  });

  it('preserves campaign context from sponsor drop-off QR URLs', () => {
    expect(
      resolveMobileScanDestination('https://app.example.test/mobile/receive/dropoff/abc123?campaignId=campaign-123')
    ).toEqual({
      type: 'dropoff',
      path: '/mobile/receive/dropoff/abc123?campaignId=campaign-123',
    });
  });

  it('routes gift label QR URLs to the existing scan page', () => {
    expect(resolveMobileScanDestination('/public/gifts/scan/LABEL-1')).toEqual({
      type: 'gift-label',
      path: '/public/gifts/scan/LABEL-1',
    });
  });

  it('routes typed recipient IDs back to the receive workflow', () => {
    expect(resolveMobileScanDestination('bt-001')).toEqual({
      type: 'recipient-id',
      recipientId: 'BT-001',
      path: '/mobile/receive',
    });
  });

  it('rejects unrelated scan content', () => {
    expect(resolveMobileScanDestination('not a blessing tree code')).toEqual({
      type: 'unknown',
      value: 'not a blessing tree code',
      reason: 'unsupported-text',
    });
  });

  it('rejects unsupported QR URLs with a URL-specific reason', () => {
    expect(resolveMobileScanDestination('https://example.test/not-blessing-tree')).toEqual({
      type: 'unknown',
      value: 'https://example.test/not-blessing-tree',
      reason: 'unsupported-url',
    });
  });

  it('rejects blank manual scan input', () => {
    expect(resolveMobileScanDestination('   ')).toEqual({
      type: 'unknown',
      value: '',
      reason: 'empty',
    });
  });
});
