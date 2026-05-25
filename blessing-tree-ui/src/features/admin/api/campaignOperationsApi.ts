import { apiFetchJson } from '@/shared/api/client';
import type {
  CampaignOperationMilestoneDefinition,
  CampaignOperationReadinessRule,
  CampaignOperationRuleOptions,
  CampaignOperationsPayload,
  SaveCampaignOperationMilestoneDefinitionInput,
  SaveCampaignOperationReadinessRuleInput,
} from '@/features/admin/model/campaignOperationsTypes';

interface MilestoneDefinitionResponse {
  id: string;
  milestone_key: string;
  label: string;
  description: string | null;
  feature_area: string;
  default_sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface ReadinessRuleResponse {
  id: string;
  rule_key: string;
  name: string;
  description: string | null;
  rule_type: string;
  feature_area: string;
  condition_type: string;
  condition_config: Record<string, unknown> | null;
  milestone_key: string;
  severity: string;
  category: string;
  blocking_for: string[];
  section: string;
  action_label: string | null;
  message: string;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface RuleOptionsResponse {
  feature_areas: string[];
  rule_types: string[];
  condition_types: string[];
  allowed_campaign_fields: string[];
  severities: string[];
  categories: string[];
  phases: string[];
  sections: string[];
  milestone_definitions: MilestoneDefinitionResponse[];
}

export async function fetchCampaignOperations(): Promise<CampaignOperationsPayload> {
  const [milestonesPayload, rulesPayload, optionsPayload] = await Promise.all([
    apiFetchJson<{ milestone_definitions: MilestoneDefinitionResponse[] }>(
      '/api/v1/admin/campaign-operations/milestone-definitions'
    ),
    apiFetchJson<{ readiness_rules: ReadinessRuleResponse[] }>(
      '/api/v1/admin/campaign-operations/readiness-rules'
    ),
    apiFetchJson<RuleOptionsResponse>('/api/v1/admin/campaign-operations/readiness-rule-options'),
  ]);

  return {
    milestoneDefinitions: milestonesPayload.milestone_definitions.map(mapMilestoneDefinition),
    readinessRules: rulesPayload.readiness_rules.map(mapReadinessRule),
    options: mapRuleOptions(optionsPayload),
  };
}

export async function createMilestoneDefinition(
  input: SaveCampaignOperationMilestoneDefinitionInput
): Promise<CampaignOperationMilestoneDefinition> {
  const payload = await apiFetchJson<{ milestone_definition: MilestoneDefinitionResponse }>(
    '/api/v1/admin/campaign-operations/milestone-definitions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toMilestoneDefinitionPayload(input, true)),
    }
  );
  return mapMilestoneDefinition(payload.milestone_definition);
}

export async function updateMilestoneDefinition(
  definitionId: string,
  input: SaveCampaignOperationMilestoneDefinitionInput
): Promise<CampaignOperationMilestoneDefinition> {
  const payload = await apiFetchJson<{ milestone_definition: MilestoneDefinitionResponse }>(
    `/api/v1/admin/campaign-operations/milestone-definitions/${definitionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toMilestoneDefinitionPayload(input, false)),
    }
  );
  return mapMilestoneDefinition(payload.milestone_definition);
}

export async function createReadinessRule(
  input: SaveCampaignOperationReadinessRuleInput
): Promise<CampaignOperationReadinessRule> {
  const payload = await apiFetchJson<{ readiness_rule: ReadinessRuleResponse }>(
    '/api/v1/admin/campaign-operations/readiness-rules',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toReadinessRulePayload(input, true)),
    }
  );
  return mapReadinessRule(payload.readiness_rule);
}

export async function updateReadinessRule(
  ruleId: string,
  input: SaveCampaignOperationReadinessRuleInput
): Promise<CampaignOperationReadinessRule> {
  const payload = await apiFetchJson<{ readiness_rule: ReadinessRuleResponse }>(
    `/api/v1/admin/campaign-operations/readiness-rules/${ruleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toReadinessRulePayload(input, false)),
    }
  );
  return mapReadinessRule(payload.readiness_rule);
}

function mapMilestoneDefinition(
  definition: MilestoneDefinitionResponse
): CampaignOperationMilestoneDefinition {
  return {
    id: definition.id,
    milestoneKey: definition.milestone_key,
    label: definition.label,
    description: definition.description,
    featureArea: definition.feature_area,
    defaultSortOrder: definition.default_sort_order,
    isActive: definition.is_active,
    isSystem: definition.is_system,
    createdAt: definition.created_at,
    updatedAt: definition.updated_at,
  };
}

function mapReadinessRule(rule: ReadinessRuleResponse): CampaignOperationReadinessRule {
  return {
    id: rule.id,
    ruleKey: rule.rule_key,
    name: rule.name,
    description: rule.description,
    ruleType: rule.rule_type,
    featureArea: rule.feature_area,
    conditionType: rule.condition_type,
    conditionConfig: rule.condition_config,
    milestoneKey: rule.milestone_key,
    severity: rule.severity,
    category: rule.category,
    blockingFor: rule.blocking_for,
    section: rule.section,
    actionLabel: rule.action_label,
    message: rule.message,
    isActive: rule.is_active,
    isSystem: rule.is_system,
    createdAt: rule.created_at,
    updatedAt: rule.updated_at,
  };
}

function mapRuleOptions(options: RuleOptionsResponse): CampaignOperationRuleOptions {
  return {
    featureAreas: options.feature_areas,
    ruleTypes: options.rule_types,
    conditionTypes: options.condition_types,
    allowedCampaignFields: options.allowed_campaign_fields,
    severities: options.severities,
    categories: options.categories,
    phases: options.phases,
    sections: options.sections,
    milestoneDefinitions: options.milestone_definitions.map(mapMilestoneDefinition),
  };
}

function toMilestoneDefinitionPayload(
  input: SaveCampaignOperationMilestoneDefinitionInput,
  includeKey: boolean
) {
  return {
    ...(includeKey ? { milestone_key: input.milestoneKey } : {}),
    label: input.label,
    description: input.description ?? null,
    feature_area: input.featureArea,
    default_sort_order: input.defaultSortOrder,
    is_active: input.isActive,
  };
}

function toReadinessRulePayload(
  input: SaveCampaignOperationReadinessRuleInput,
  includeKey: boolean
) {
  return {
    ...(includeKey ? { rule_key: input.ruleKey } : {}),
    name: input.name,
    description: input.description ?? null,
    rule_type: input.ruleType,
    feature_area: input.featureArea,
    condition_type: input.conditionType,
    condition_config: input.conditionConfig ?? null,
    milestone_key: input.milestoneKey,
    severity: input.severity,
    category: input.category,
    blocking_for: input.blockingFor,
    section: input.section,
    action_label: input.actionLabel ?? null,
    message: input.message,
    is_active: input.isActive,
  };
}
