import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminFeatureFlagsCard } from '@/features/admin/ui/AdminFeatureFlagsCard';
import { updateFeatureFlag } from '@/features/admin/api/adminApi';
import { useAppFeatures } from '@/features/admin/model/appFeaturesContext';

vi.mock('@/features/admin/api/adminApi', () => ({
  updateFeatureFlag: vi.fn(),
}));

vi.mock('@/features/admin/model/appFeaturesContext', () => ({
  useAppFeatures: vi.fn(),
}));

describe('AdminFeatureFlagsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppFeatures).mockReturnValue({
      features: [
        {
          featureKey: 'people',
          label: 'People',
          description: 'Show the campaign-aware People workspace in the main application navigation.',
          isEnabled: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      isLoading: false,
      isFeatureEnabled: vi.fn(),
      refreshFeatures: vi.fn(),
      updateFeatureInState: vi.fn(),
    });
    vi.mocked(updateFeatureFlag).mockResolvedValue({
      featureKey: 'people',
      label: 'People',
      description: 'Show the campaign-aware People workspace in the main application navigation.',
      isEnabled: false,
      createdAt: '',
      updatedAt: '',
    });
  });

  it('toggles a feature flag and updates local state', async () => {
    const user = userEvent.setup();
    const updateFeatureInState = vi.fn();
    vi.mocked(useAppFeatures).mockReturnValue({
      features: [
        {
          featureKey: 'people',
          label: 'People',
          description: 'Show the campaign-aware People workspace in the main application navigation.',
          isEnabled: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      isLoading: false,
      isFeatureEnabled: vi.fn(),
      refreshFeatures: vi.fn(),
      updateFeatureInState,
    });

    render(<AdminFeatureFlagsCard />);

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(updateFeatureFlag).toHaveBeenCalledWith('people', false);
      expect(updateFeatureInState).toHaveBeenCalledWith(
        expect.objectContaining({ featureKey: 'people', isEnabled: false })
      );
    });
  });
});
