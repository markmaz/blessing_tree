export interface CampaignOperationMilestoneDefinition {
  id: string;
  milestoneKey: string;
  label: string;
  description: string | null;
  featureArea: string;
  defaultSortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignOperationReadinessRule {
  id: string;
  ruleKey: string;
  name: string;
  description: string | null;
  ruleType: string;
  featureArea: string;
  conditionType: string;
  conditionConfig: Record<string, unknown> | null;
  milestoneKey: string;
  severity: string;
  category: string;
  blockingFor: string[];
  section: string;
  actionLabel: string | null;
  message: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignOperationRuleOptions {
  featureAreas: string[];
  ruleTypes: string[];
  conditionTypes: string[];
  allowedCampaignFields: string[];
  severities: string[];
  categories: string[];
  phases: string[];
  sections: string[];
  milestoneDefinitions: CampaignOperationMilestoneDefinition[];
}

export interface CampaignOperationsPayload {
  milestoneDefinitions: CampaignOperationMilestoneDefinition[];
  readinessRules: CampaignOperationReadinessRule[];
  options: CampaignOperationRuleOptions;
}

export interface SaveCampaignOperationMilestoneDefinitionInput {
  milestoneKey?: string;
  label: string;
  description?: string | null;
  featureArea: string;
  defaultSortOrder: number;
  isActive: boolean;
}

export interface SaveCampaignOperationReadinessRuleInput {
  ruleKey?: string;
  name: string;
  description?: string | null;
  ruleType: string;
  featureArea: string;
  conditionType: string;
  conditionConfig?: Record<string, unknown> | null;
  milestoneKey: string;
  severity: string;
  category: string;
  blockingFor: string[];
  section: string;
  actionLabel?: string | null;
  message: string;
  isActive: boolean;
}
