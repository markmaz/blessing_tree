import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { MobileScannerPage } from './MobileScannerPage';

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: vi.fn(function BrowserQRCodeReader() {
    return {
    decodeFromVideoDevice: vi.fn().mockRejectedValue(new Error('Camera unavailable in test')),
    };
  }),
}));

describe('MobileScannerPage', () => {
  it('shows a specific message for unsupported QR URLs', async () => {
    const user = userEvent.setup();

    renderScanner();

    await user.type(screen.getByLabelText(/manual entry/i), 'https://example.test/not-blessing-tree');
    await user.click(screen.getByRole('button', { name: /^open$/i }));

    expect(
      await screen.findByText(/that qr opens a page blessing tree cannot receive from/i)
    ).toBeInTheDocument();
  });

  it('shows a specific message for sponsor drop-off links missing a token', async () => {
    const user = userEvent.setup();

    renderScanner();

    await user.type(screen.getByLabelText(/manual entry/i), 'https://app.example.test/mobile/receive/dropoff');
    await user.click(screen.getByRole('button', { name: /^open$/i }));

    expect(
      await screen.findByText(/missing its secure drop-off token/i)
    ).toBeInTheDocument();
  });

  it('routes manual recipient IDs to mobile receive with lookup state', async () => {
    const user = userEvent.setup();

    renderScanner();

    await user.type(screen.getByLabelText(/manual entry/i), 'bt-001');
    await user.click(screen.getByRole('button', { name: /^open$/i }));

    expect(await screen.findByText('/mobile/receive')).toBeInTheDocument();
    expect(screen.getByText(/"recipientId":"BT-001"/)).toBeInTheDocument();
    expect(screen.getByText(/"autoLookup":true/)).toBeInTheDocument();
  });

  it('routes sponsor drop-off QR URLs to the drop-off page', async () => {
    const user = userEvent.setup();

    renderScanner();

    await user.type(
      screen.getByLabelText(/manual entry/i),
      'https://app.example.test/mobile/receive/dropoff/token-123?campaignId=campaign-123'
    );
    await user.click(screen.getByRole('button', { name: /^open$/i }));

    expect(await screen.findByText('/mobile/receive/dropoff/token-123?campaignId=campaign-123')).toBeInTheDocument();
  });
});

function renderScanner() {
  render(
    <MemoryRouter initialEntries={['/mobile/scan']}>
      <Routes>
        <Route path="/mobile/scan" element={<MobileScannerPage />} />
        <Route path="/mobile/receive" element={<LocationProbe />} />
        <Route path="/mobile/receive/dropoff/:token" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div>
      <div>{`${location.pathname}${location.search}`}</div>
      <pre>{JSON.stringify(location.state)}</pre>
    </div>
  );
}
