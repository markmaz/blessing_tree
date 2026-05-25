import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMilestoneDefinition,
  createReadinessRule,
  updateMilestoneDefinition,
  updateReadinessRule,
} from '@/features/admin/api/campaignOperationsApi';
import { AdminCampaignOperationsWorkspace } from '@/features/admin/ui/AdminCampaignOperationsWorkspace';
import type {
  CampaignOperationMilestoneDefinition,
  CampaignOperationReadinessRule,
  CampaignOperationRuleOptions,
} from '@/features/admin/model/campaignOperationsTypes';

vi.mock('@/features/admin/api/campaignOperationsApi', () => ({
  createMilestoneDefinition: vi.fn(),
  createReadinessRule: vi.fn(),
  updateMilestoneDefinition: vi.fn(),
  updateReadinessRule: vi.fn(),
}));

const milestoneDefinitions: CampaignOperationMilestoneDefinition[] = [
  {
    id: 'definition-1',
    milestoneKey: 'registration_open',
    label: 'Registration Opens',
    description: null,
    featureArea: 'GENERAL',
    defaultSortOrder: 1,
    isActive: true,
    isSystem: true,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  },
  {
    id: 'definition-2',
    milestoneKey: 'gift_intake_end',
    label: 'Gift Intake Ends',
    description: null,
    featureArea: 'GIFTS',
    defaultSortOrder: 7,
    isActive: true,
    isSystem: true,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  },
];

const readinessRules: CampaignOperationReadinessRule[] = [
  {
    id: 'rule-1',
    ruleKey: 'missing_gift_intake_end',
    name: 'Missing Gift Intake End Date',
    description: null,
    ruleType: 'MISSING_MILESTONE',
    featureArea: 'GIFTS',
    conditionType: 'ALWAYS',
    conditionConfig: null,
    milestoneKey: 'gift_intake_end',
    severity: 'error',
    category: 'blockers',
    blockingFor: ['activate'],
    section: 'schedule',
    actionLabel: 'Open Schedule',
    message: 'Gift intake end date is required.',
    isActive: true,
    isSystem: true,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  },
];

const options: CampaignOperationRuleOptions = {
  featureAreas: ['GENERAL', 'SPONSORS', 'GIFTS'],
  ruleTypes: ['MISSING_MILESTONE'],
  conditionTypes: ['ALWAYS', 'CAMPAIGN_FIELD_TRUE'],
  allowedCampaignFields: ['public_sponsor_signup_enabled'],
  severities: ['error', 'warning', 'info'],
  categories: ['blockers', 'launch_checks', 'planning_gaps', 'operational_health'],
  phases: ['draft', 'activate', 'operations', 'close'],
  sections: ['settings', 'schedule', 'readiness'],
  milestoneDefinitions,
};

describe('AdminCampaignOperationsWorkspace', () => {
  beforeEach(() => {
    vi.mocked(createMilestoneDefinition).mockReset();
    vi.mocked(updateMilestoneDefinition).mockReset();
    vi.mocked(createReadinessRule).mockReset();
    vi.mocked(updateReadinessRule).mockReset();
    vi.mocked(createMilestoneDefinition).mockResolvedValue(milestoneDefinitions[0]);
    vi.mocked(createReadinessRule).mockResolvedValue({
      id: 'rule-created',
      ruleKey: 'missing_custom_gate',
      name: 'Missing Custom Gate',
      description: null,
      ruleType: 'MISSING_MILESTONE',
      featureArea: 'SPONSORS',
      conditionType: 'ALWAYS',
      conditionConfig: null,
      milestoneKey: 'gift_intake_end',
      severity: 'error',
      category: 'blockers',
      blockingFor: ['activate'],
      section: 'schedule',
      actionLabel: 'Open Schedule',
      message: 'Custom gate missing.',
      isActive: true,
      isSystem: false,
      createdAt: '2026-01-01T00:00:00',
      updatedAt: '2026-01-01T00:00:00',
    });
  });

  it('creates a milestone definition', async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminCampaignOperationsWorkspace
        milestoneDefinitions={milestoneDefinitions}
        readinessRules={[]}
        options={options}
        onDataChanged={onDataChanged}
      />
    );

    await user.click(screen.getByRole('button', { name: /new milestone/i }));
    await user.type(screen.getByLabelText(/^key$/i), 'custom_gate');
    await user.clear(screen.getByLabelText(/^label$/i));
    await user.type(screen.getByLabelText(/^label$/i), 'Custom Gate');
    await user.selectOptions(screen.getByLabelText(/feature area/i), 'SPONSORS');
    await user.clear(screen.getByLabelText(/sort order/i));
    await user.type(screen.getByLabelText(/sort order/i), '42');
    await user.click(screen.getByRole('button', { name: /create milestone/i }));

    expect(createMilestoneDefinition).toHaveBeenCalledWith({
      milestoneKey: 'custom_gate',
      label: 'Custom Gate',
      description: null,
      featureArea: 'SPONSORS',
      defaultSortOrder: 42,
      isActive: true,
    });
    expect(onDataChanged).toHaveBeenCalled();
  });

  it('creates a readiness rule with blocking phases and condition config', async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminCampaignOperationsWorkspace
        milestoneDefinitions={milestoneDefinitions}
        readinessRules={[]}
        options={options}
        onDataChanged={onDataChanged}
      />
    );

    await user.click(screen.getByRole('button', { name: /readiness rules/i }));
    await user.click(screen.getByRole('button', { name: /new rule/i }));
    await user.type(screen.getByLabelText(/rule key/i), 'missing_custom_gate');
    await user.type(screen.getByLabelText(/^name$/i), 'Missing Custom Gate');
    await user.selectOptions(screen.getByLabelText(/^milestone$/i), 'gift_intake_end');
    await user.selectOptions(screen.getByLabelText(/^condition$/i), 'CAMPAIGN_FIELD_TRUE');
    await user.selectOptions(screen.getByLabelText(/campaign field/i), 'public_sponsor_signup_enabled');
    await user.selectOptions(screen.getByLabelText(/^severity$/i), 'error');
    await user.selectOptions(screen.getByLabelText(/^category$/i), 'blockers');
    await user.click(within(screen.getByRole('group', { name: /blocking phases/i })).getByLabelText(/activate/i));
    await user.type(screen.getByLabelText(/^message$/i), 'Custom gate missing.');

    expect(screen.getByLabelText(/rule impact preview/i)).toHaveTextContent(
      /blocks Activate/i
    );

    await user.click(screen.getByRole('button', { name: /create rule/i }));

    expect(createReadinessRule).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleKey: 'missing_custom_gate',
        name: 'Missing Custom Gate',
        conditionType: 'CAMPAIGN_FIELD_TRUE',
        conditionConfig: { field: 'public_sponsor_signup_enabled' },
        milestoneKey: 'gift_intake_end',
        severity: 'error',
        category: 'blockers',
        blockingFor: ['activate'],
        message: 'Custom gate missing.',
      })
    );
    expect(onDataChanged).toHaveBeenCalled();
  });

  it('shows readiness rules that reference the selected milestone', async () => {
    const user = userEvent.setup();

    render(
      <AdminCampaignOperationsWorkspace
        milestoneDefinitions={milestoneDefinitions}
        readinessRules={readinessRules}
        options={options}
        onDataChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const giftIntakeRow = screen.getByRole('button', { name: /edit milestone gift intake ends/i });
    await user.click(giftIntakeRow);

    expect(screen.getByText(/referenced by/i)).toBeInTheDocument();
    expect(screen.getByText(/missing gift intake end date/i)).toBeInTheDocument();
  });

  it('requires confirmation before deactivating a system milestone definition', async () => {
    const user = userEvent.setup();

    render(
      <AdminCampaignOperationsWorkspace
        milestoneDefinitions={milestoneDefinitions}
        readinessRules={readinessRules}
        options={options}
        onDataChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByRole('button', { name: /edit milestone registration opens/i }));
    await user.click(screen.getByLabelText(/^active$/i));

    const saveButton = screen.getByRole('button', { name: /save milestone/i });
    expect(saveButton).toBeDisabled();
    expect(updateMilestoneDefinition).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(/confirm deactivating this system milestone definition/i));
    await user.click(saveButton);

    expect(updateMilestoneDefinition).toHaveBeenCalledWith(
      'definition-1',
      expect.objectContaining({ isActive: false })
    );
  });

  it('requires confirmation before deactivating a system readiness rule', async () => {
    const user = userEvent.setup();

    render(
      <AdminCampaignOperationsWorkspace
        milestoneDefinitions={milestoneDefinitions}
        readinessRules={readinessRules}
        options={options}
        onDataChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByRole('button', { name: /readiness rules/i }));
    await user.click(screen.getByRole('button', { name: /edit readiness rule missing gift intake end date/i }));
    await user.click(screen.getByLabelText(/^active$/i));

    const saveButton = screen.getByRole('button', { name: /save rule/i });
    expect(saveButton).toBeDisabled();
    expect(updateReadinessRule).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(/confirm deactivating this system readiness rule/i));
    await user.click(saveButton);

    expect(updateReadinessRule).toHaveBeenCalledWith(
      'rule-1',
      expect.objectContaining({ isActive: false })
    );
  });
});
