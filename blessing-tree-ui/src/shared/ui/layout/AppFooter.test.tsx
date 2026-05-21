import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppFooter } from '@/shared/ui/layout/AppFooter';

vi.mock('@/shared/api/metaApi', () => ({
  getBackendVersion: vi.fn(),
}));

describe('AppFooter', () => {
  it('renders the copyright line and version numbers', async () => {
    const { getBackendVersion } = await import('@/shared/api/metaApi');
    vi.mocked(getBackendVersion).mockResolvedValue('0.1.9');

    render(<AppFooter />);

    expect(screen.getByText(/queryforge, llc/i)).toBeInTheDocument();
    expect(screen.getByText(/frontend v0\.0\.25/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/backend v0\.1\.9/i)).toBeInTheDocument();
    });
  });

  it('shows an unavailable backend version when the request fails', async () => {
    const { getBackendVersion } = await import('@/shared/api/metaApi');
    vi.mocked(getBackendVersion).mockRejectedValue(new Error('failed'));

    render(<AppFooter />);

    await waitFor(() => {
      expect(screen.getByText(/backend unavailable/i)).toBeInTheDocument();
    });
  });
});
