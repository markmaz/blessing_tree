import QRCode from 'qrcode';

const printQrSize = 2048;

export async function createPrintQrDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: printQrSize,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

export function downloadQrDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function copyQrDataUrl(dataUrl: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('This browser cannot copy images. Use Download QR instead.');
  }

  const imageBlob = dataUrlToBlob(dataUrl);
  await navigator.clipboard.write([
    new ClipboardItem({
      'image/png': imageBlob,
    }),
  ]);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [metadata, encodedData] = dataUrl.split(',', 2);
  if (!metadata || !encodedData || !metadata.includes(';base64')) {
    throw new Error('Unable to prepare the QR code image.');
  }

  const mimeType = metadata.match(/^data:([^;]+)/)?.[1] ?? 'image/png';
  const binaryData = atob(encodedData);
  const bytes = new Uint8Array(binaryData.length);
  for (let index = 0; index < binaryData.length; index += 1) {
    bytes[index] = binaryData.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}
