import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseStoredTemplateBlocks } from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
import { CampaignStudioCommunicationsSection } from '@/features/campaigns/ui/CampaignStudioCommunicationsSection';
import type {
  CommunicationAudienceOption,
  CommunicationTemplate,
} from '@/features/campaigns/model/campaignStudioTypes';

const audienceCatalog: CommunicationAudienceOption[] = [
  {
    key: 'SPONSOR',
    label: 'Sponsors',
    description: 'Sponsors connected to this campaign through active sponsorships.',
  },
  {
    key: 'VOLUNTEER',
    label: 'Volunteers',
    description: 'Campaign roster members marked as volunteers.',
  },
];

const templates: CommunicationTemplate[] = [
  {
    id: 'template-1',
    campaignId: 'campaign-123',
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
    campaignId: 'campaign-123',
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
        audienceCatalog={audienceCatalog}
        templates={[]}
        isSaving={false}
        onCreateTemplate={onCreateTemplate}
        onUpdateTemplate={vi.fn().mockResolvedValue(true)}
        onDeleteTemplate={vi.fn().mockResolvedValue(true)}
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
    await user.click(screen.getByRole('button', { name: /^create template$/i }));

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
        audienceCatalog={audienceCatalog}
        templates={templates}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={onUpdateTemplate}
        onDeleteTemplate={vi.fn().mockResolvedValue(true)}
      />
    );

    expect(screen.queryByText(/schedule a communication/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /open template files/i }));
    expect(
      screen.getByRole('button', { name: /open template volunteer reminder/i })
    ).toBeInTheDocument();

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
        audienceCatalog={audienceCatalog}
        templates={templates}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onDeleteTemplate={vi.fn().mockResolvedValue(true)}
      />
    );

    expect(screen.getByRole('button', { name: /open template files/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open template files/i }));

    expect(screen.getByText(/communication files/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /collapse template files/i }));

    expect(screen.queryByText(/communication files/i)).not.toBeInTheDocument();
  });

  it('loads the selected saved template into the builder draft', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioCommunicationsSection
        audienceCatalog={audienceCatalog}
        templates={templates}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onDeleteTemplate={vi.fn().mockResolvedValue(true)}
      />
    );

    await user.click(screen.getByRole('button', { name: /open template files/i }));
    await user.click(screen.getByRole('button', { name: /open template sponsor map/i }));
    await user.click(screen.getByRole('button', { name: /content blocks/i }));

    expect(screen.getByLabelText(/^subject$/i)).toHaveValue('Directions for {{campaign.name}}');
    expect(screen.getByLabelText(/heading/i)).toHaveValue('Pickup map');
    expect(screen.getByLabelText(/image url/i)).toHaveValue('{{location.map_url}}');
  });

  it('preserves authored line breaks in the rendered preview', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioCommunicationsSection
        audienceCatalog={audienceCatalog}
        templates={templates}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onDeleteTemplate={vi.fn().mockResolvedValue(true)}
      />
    );

    await user.click(screen.getByRole('button', { name: /content blocks/i }));

    const previewSurface = screen.getByText(/rendered output/i).closest('.campaign-template-preview-email');
    expect(previewSurface).not.toBeNull();
    const previewText = (previewSurface as HTMLElement).querySelector('.campaign-template-preview-card__text-block');
    expect(previewText).not.toBeNull();
    expect(previewText).toHaveClass('campaign-template-preview-card__text-block');
    expect(previewText).toHaveTextContent('Hello Chris,');
    expect(previewText?.textContent).toContain('\n\n');
    expect(previewText).toHaveTextContent('Please arrive by November 3, 2026 at 6:00 PM.');
  });

  it('opens the merge field drawer and inserts a field into the focused input', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioCommunicationsSection
        audienceCatalog={audienceCatalog}
        templates={[]}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onDeleteTemplate={vi.fn().mockResolvedValue(true)}
      />
    );

    await user.click(screen.getByRole('button', { name: /content/i }));
    await user.click(screen.getByRole('button', { name: /show merge fields/i }));
    await user.click(screen.getByRole('button', { name: 'campaign.name' }));

    expect(screen.getByLabelText(/^subject$/i)).toHaveValue('{{campaign.name}}');
    expect(screen.getByRole('button', { name: /hide merge fields/i })).toBeInTheDocument();
  });

  it('deletes a template from the file rail', async () => {
    const user = userEvent.setup();
    const onDeleteTemplate = vi.fn().mockResolvedValue(true);

    render(
      <CampaignStudioCommunicationsSection
        audienceCatalog={audienceCatalog}
        templates={templates}
        isSaving={false}
        onCreateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onUpdateTemplate={vi.fn().mockResolvedValue(templates[0])}
        onDeleteTemplate={onDeleteTemplate}
      />
    );

    await user.click(screen.getByRole('button', { name: /open template files/i }));
    await user.click(screen.getByRole('button', { name: /open actions for volunteer reminder/i }));
    await user.click(screen.getByRole('button', { name: /delete template/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(onDeleteTemplate).toHaveBeenCalledWith('template-1');
  });
});
