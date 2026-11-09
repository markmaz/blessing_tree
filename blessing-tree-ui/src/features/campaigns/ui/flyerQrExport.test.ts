import QRCode from 'qrcode';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  copyQrDataUrl,
  createPrintQrDataUrl,
  downloadQrDataUrl,
} from '@/features/campaigns/ui/flyerQrExport';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

describe('flyer QR export', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a high-resolution print QR code', async () => {
    vi.mocked(QRCode.toDataURL as (value: string, options: object) => Promise<string>).mockResolvedValue(
      'data:image/png;base64,cXJjb2Rl'
    );

    await expect(createPrintQrDataUrl('https://example.test/sponsor')).resolves.toBe(
      'data:image/png;base64,cXJjb2Rl'
    );
    expect(QRCode.toDataURL).toHaveBeenCalledWith('https://example.test/sponsor', {
      errorCorrectionLevel: 'H',
      margin: 4,
      width: 2048,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  });

  it('downloads the generated image with the requested filename', () => {
    const click = vi.fn();
    const link = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    downloadQrDataUrl('data:image/png;base64,cXJjb2Rl', 'sponsor-flyer-qr.png');

    expect(link.href).toBe('data:image/png;base64,cXJjb2Rl');
    expect(link.download).toBe('sponsor-flyer-qr.png');
    expect(click).toHaveBeenCalledOnce();
  });

  it('copies the PNG image to the clipboard', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    class TestClipboardItem {
      readonly items: Record<string, Blob>;

      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    }
    vi.stubGlobal('ClipboardItem', TestClipboardItem);
    vi.stubGlobal('navigator', { clipboard: { write } });

    await copyQrDataUrl('data:image/png;base64,cXJjb2Rl');

    expect(write).toHaveBeenCalledOnce();
    const clipboardItem = write.mock.calls[0][0][0] as TestClipboardItem;
    expect(clipboardItem.items['image/png']).toBeInstanceOf(Blob);
    expect(clipboardItem.items['image/png'].type).toBe('image/png');
  });

  it('directs unsupported browsers to download instead', async () => {
    vi.stubGlobal('navigator', { clipboard: {} });
    vi.stubGlobal('ClipboardItem', undefined);

    await expect(copyQrDataUrl('data:image/png;base64,cXJjb2Rl')).rejects.toThrow(
      'Use Download QR instead.'
    );
  });
});
