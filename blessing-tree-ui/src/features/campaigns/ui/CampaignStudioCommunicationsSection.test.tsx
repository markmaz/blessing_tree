import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStudioCommunicationsSection } from '@/features/campaigns/ui/CampaignStudioCommunicationsSection';
import type { CommunicationTemplate } from '@/features/campaigns/model/campaignStudioTypes';

const templates: CommunicationTemplate[] = [
  {
    id: 'template-1',
    templateKey: 'volunteer_reminder',
    name: 'Volunteer Reminder',
    audience: 'VOLUNTEER',
    channel: 'EMAIL',
    subjectTemplate: 'Reminder for {{campaign.name}}',
    bodyTemplate: 'Hello {{volunteer.first_name}},\n\nPlease arrive by {{event.start_at}}.',
    isActive: true,
    createdByUserId: null,
    createdAt: null,
    updatedAt: null,
  },
];

describe('CampaignStudioCommunicationsSection', () => {
  it('creates a new template from the builder workspace', async () => {
    const user = userEvent.setup();
    const onCreateTemplate = vi.fn().mockResolvedValue({
      ...templates[0],
      id: 'template-2',
      templateKey: 'sponsor_welcome',
      name: 'Sponsor Welcome',
      audience: 'SPONSOR',
      subjectTemplate: 'Welcome to {{campaign.name}}',
      bodyTemplate: 'Hi {{sponsor.first_name}},\n\nThank you for joining.',
    });

    render(
      <CampaignStudioCommunicationsSection
        templates={[]}
        isSaving={false}
        onCreateTemplate={onCreateTemplate}
        onUpdateTemplate={vi.fn().mockResolvedValue(true)}
      />
    );

    await user.type(screen.getByLabelText(/template name/i), 'Sponsor Welcome');
    expect(screen.getByLabelText(/template key/i)).toHaveValue('sponsor_welcome');
    await user.selectOptions(screen.getByLabelText(/audience/i), 'SPONSOR');
    await user.click(screen.getByRole('button', { name: /content/i }));
    await user.click(screen.getByLabelText(/^subject$/i));
    await user.paste('Welcome to {{campaign.name}}');
    await user.click(screen.getByLabelText(/^body$/i));
    await user.paste('Hi {{sponsor.first_name}},\n\nThank you for joining.');
    await user.click(screen.getByRole('button', { name: /create template/i }));

    expect(onCreateTemplate).toHaveBeenCalledWith({
      templateKey: 'sponsor_welcome',
      name: 'Sponsor Welcome',
      audience: 'SPONSOR',
      subjectTemplate: 'Welcome to {{campaign.name}}',
      bodyTemplate: 'Hi {{sponsor.first_name}},\n\nThank you for joining.',
      isActive: true,
    });
  });

  it('loads an existing template and saves updates without schedule controls', async () => {
    const user = userEvent.setup();
    const onUpdateTemplate = vi.fn().mockResolvedValue({
      ...templates[0],
      name: 'Volunteer Reminder Updated',
    });

    render(
      <CampaignStudioCommunicationsSection
        templates={templates}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={onUpdateTemplate}
      />
    );

    expect(screen.queryByText(/schedule a communication/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volunteer reminder/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/template name/i), ' Updated');
    await user.click(screen.getByRole('button', { name: /save template/i }));

    expect(onUpdateTemplate).toHaveBeenCalledWith('template-1', {
      templateKey: 'volunteer_reminder',
      name: 'Volunteer Reminder Updated',
      audience: 'VOLUNTEER',
      subjectTemplate: 'Reminder for {{campaign.name}}',
      bodyTemplate: 'Hello {{volunteer.first_name}},\n\nPlease arrive by {{event.start_at}}.',
      isActive: true,
    });
  });
});
