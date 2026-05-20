import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseStoredTemplateBlocks } from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
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
  {
    id: 'template-2',
    templateKey: 'sponsor_map',
    name: 'Sponsor Map',
    audience: 'SPONSOR',
    channel: 'EMAIL',
    subjectTemplate: 'Directions for {{campaign.name}}',
    bodyTemplate:
      '__bt_template_blocks_v1__::{"version":1,"blocks":[{"id":"block-1","type":"heading","content":"Pickup map"},{"id":"block-2","type":"image","src":"{{location.map_url}}","altText":"Map image","caption":"Warehouse route"}]}',
    isActive: true,
    createdByUserId: null,
    createdAt: null,
    updatedAt: null,
  },
];

describe('CampaignStudioCommunicationsSection', () => {
  it('creates a new template from the builder workspace', async () => {
    const user = userEvent.setup();
    const imageFile = new File(['map'], 'pickup-map.png', { type: 'image/png' });
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
    await user.click(screen.getByLabelText(/^Text$/i));
    await user.paste('Hi {{sponsor.first_name}},\n\nThank you for joining.');
    await user.click(screen.getByRole('button', { name: /add image/i }));
    await user.upload(screen.getByLabelText(/upload image/i), imageFile);
    await waitFor(() =>
      expect(screen.getByLabelText(/image url/i)).toHaveValue(
        'data:image/png;base64,bWFw'
      )
    );
    await user.click(screen.getByRole('button', { name: /create template/i }));

    expect(onCreateTemplate).toHaveBeenCalledTimes(1);
    const createCall = onCreateTemplate.mock.calls[0]?.[0];
    expect(createCall).toMatchObject({
      templateKey: 'sponsor_welcome',
      name: 'Sponsor Welcome',
      audience: 'SPONSOR',
      subjectTemplate: 'Welcome to {{campaign.name}}',
      isActive: true,
    });
    expect(parseStoredTemplateBlocks(createCall.bodyTemplate)).toEqual([
      expect.objectContaining({
        type: 'text',
        content: 'Hi {{sponsor.first_name}},\n\nThank you for joining.',
      }),
      expect.objectContaining({
        type: 'image',
        src: 'data:image/png;base64,bWFw',
        altText: 'pickup map',
        caption: '',
      }),
    ]);
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

    expect(onUpdateTemplate).toHaveBeenCalledTimes(1);
    const updateCall = onUpdateTemplate.mock.calls[0];
    expect(updateCall?.[0]).toBe('template-1');
    expect(updateCall?.[1]).toMatchObject({
      templateKey: 'volunteer_reminder',
      name: 'Volunteer Reminder Updated',
      audience: 'VOLUNTEER',
      subjectTemplate: 'Reminder for {{campaign.name}}',
      isActive: true,
    });
    expect(parseStoredTemplateBlocks(updateCall?.[1].bodyTemplate as string)).toEqual([
      expect.objectContaining({
        type: 'text',
        content: 'Hello {{volunteer.first_name}},\n\nPlease arrive by {{event.start_at}}.',
      }),
    ]);
  });

  it('collapses the saved template rail to free editor space', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioCommunicationsSection
        templates={templates}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={vi.fn().mockResolvedValue(templates[0])}
      />
    );

    await user.click(screen.getByRole('button', { name: /collapse saved templates/i }));

    expect(screen.queryByText(/saved templates/i)).not.toBeInTheDocument();
    expect(screen.getByText(String(templates.length))).toBeInTheDocument();
  });

  it('loads the selected saved template into the builder draft', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioCommunicationsSection
        templates={templates}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={vi.fn().mockResolvedValue(templates[0])}
      />
    );

    await user.click(screen.getByRole('button', { name: /sponsor map/i }));
    await user.click(screen.getByRole('button', { name: /content blocks/i }));

    expect(screen.getByLabelText(/^subject$/i)).toHaveValue('Directions for {{campaign.name}}');
    expect(screen.getByLabelText(/heading/i)).toHaveValue('Pickup map');
    expect(screen.getByLabelText(/image url/i)).toHaveValue('{{location.map_url}}');
  });

  it('opens the merge field drawer and inserts a field into the focused input', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioCommunicationsSection
        templates={[]}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={vi.fn().mockResolvedValue(templates[0])}
      />
    );

    await user.click(screen.getByRole('button', { name: /content/i }));
    await user.click(screen.getByRole('button', { name: /show merge fields/i }));
    await user.click(screen.getByRole('button', { name: 'campaign.name' }));

    expect(screen.getByLabelText(/^subject$/i)).toHaveValue('{{campaign.name}}');
    expect(screen.getByRole('button', { name: /hide merge fields/i })).toBeInTheDocument();
  });
});
