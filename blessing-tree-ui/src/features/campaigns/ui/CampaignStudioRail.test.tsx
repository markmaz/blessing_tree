import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStudioRail } from '@/features/campaigns/ui/CampaignStudioRail';
import type { CampaignStudioSection } from '@/features/campaigns/model/campaignStudio';

const sections: CampaignStudioSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'See the full campaign shape.',
    icon: 'bi-grid-1x2',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    description: 'Plan campaign dates and operations.',
    icon: 'bi-calendar3',
  },
];

describe('CampaignStudioRail', () => {
  it('keeps section buttons accessible by label and routes selection clicks', async () => {
    const user = userEvent.setup();
    const onSelectSection = vi.fn();

    render(
      <CampaignStudioRail
        sections={sections}
        selectedSection="overview"
        onSelectSection={onSelectSection}
      />
    );

    await user.click(screen.getByRole('button', { name: /schedule/i }));

    expect(onSelectSection).toHaveBeenCalledWith('schedule');
    expect(screen.getByRole('button', { name: /overview/i })).toHaveAttribute(
      'title',
      'Overview'
    );
  });
});
