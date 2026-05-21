import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStudioReadinessSection } from '@/features/campaigns/ui/CampaignStudioReadinessSection';
import type { CampaignReadiness } from '@/features/campaigns/model/campaignStudioTypes';

const readiness: CampaignReadiness = {
  campaignId: 'campaign-123',
  status: 'BLOCKED',
  overallStatus: 'BLOCKED',
  phaseStatus: {
    draft: 'NEEDS_ATTENTION',
    activate: 'BLOCKED',
    operations: 'NEEDS_ATTENTION',
    close: 'READY',
  },
  items: [
    {
      severity: 'error',
      category: 'blockers',
      code: 'missing_manager',
      section: 'team',
      message: 'Assign at least one campaign manager.',
      actionLabel: 'Open Team',
      blockingFor: ['activate', 'operations'],
      details: {},
    },
    {
      severity: 'warning',
      category: 'planning_gaps',
      code: 'missing_description',
      section: 'settings',
      message: 'Add a campaign description.',
      actionLabel: 'Open Settings',
      blockingFor: ['activate'],
      details: {},
    },
  ],
  groups: {
    blockers: [
      {
        severity: 'error',
        category: 'blockers',
        code: 'missing_manager',
        section: 'team',
        message: 'Assign at least one campaign manager.',
        actionLabel: 'Open Team',
        blockingFor: ['activate', 'operations'],
        details: {},
      },
    ],
    launch_checks: [],
    planning_gaps: [
      {
        severity: 'warning',
        category: 'planning_gaps',
        code: 'missing_description',
        section: 'settings',
        message: 'Add a campaign description.',
        actionLabel: 'Open Settings',
        blockingFor: ['activate'],
        details: {},
      },
    ],
    operational_health: [],
  },
  counts: {
    errors: 1,
    warnings: 1,
    infos: 0,
  },
  categoryCounts: {
    blockers: 1,
    launch_checks: 0,
    planning_gaps: 1,
    operational_health: 0,
  },
};

describe('CampaignStudioReadinessSection', () => {
  it('renders grouped readiness sections and phase statuses', () => {
    render(
      <CampaignStudioReadinessSection readiness={readiness} onSelectSection={vi.fn()} />
    );

    expect(screen.getByText('Launch and Setup Gaps')).toBeInTheDocument();
    expect(screen.getAllByText('Blockers')).toHaveLength(2);
    expect(screen.getAllByText('Launch Checks')).toHaveLength(2);
    expect(screen.getAllByText('Planning Gaps')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Operational Health' })).toBeInTheDocument();
    expect(screen.getByText('Activate')).toBeInTheDocument();
    expect(screen.getAllByText('Blocked')).toHaveLength(2);
    expect(screen.getByText('Assign at least one campaign manager.')).toBeInTheDocument();
    expect(screen.getByText('Blocks Activate, Operations')).toBeInTheDocument();
  });

  it('routes action buttons to the matching studio section', async () => {
    const user = userEvent.setup();
    const onSelectSection = vi.fn();

    render(
      <CampaignStudioReadinessSection
        readiness={readiness}
        onSelectSection={onSelectSection}
      />
    );

    await user.click(screen.getByRole('button', { name: /open team/i }));

    expect(onSelectSection).toHaveBeenCalledWith('team');
  });
});
