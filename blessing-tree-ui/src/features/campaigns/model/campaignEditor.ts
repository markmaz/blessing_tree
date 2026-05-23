import type {
  Campaign,
  CampaignStatus,
  CampaignUpsertInput,
} from '@/features/campaigns/model/campaignTypes';

export interface CampaignEditorValues {
  name: string;
  year: string;
  description: string;
  seasonTheme: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  sourceCampaignId: string;
}

export const campaignStatusOptions: CampaignStatus[] = [
  'DRAFT',
  'ACTIVE',
  'CLOSED',
  'ARCHIVED',
];

export function buildCampaignEditorValues(
  campaign?: Campaign | null
): CampaignEditorValues {
  return {
    name: campaign?.name ?? '',
    year: campaign?.year ? String(campaign.year) : '',
    description: campaign?.description ?? '',
    seasonTheme: campaign?.seasonTheme ?? '',
    status: campaign?.status ?? 'DRAFT',
    startDate: campaign?.startDate ?? '',
    endDate: campaign?.endDate ?? '',
    sourceCampaignId: '',
  };
}

export function toCampaignUpsertInput(
  values: CampaignEditorValues
): CampaignUpsertInput {
  return {
    name: values.name.trim(),
    year: Number(values.year),
    description: values.description.trim() || null,
    seasonTheme: values.seasonTheme.trim() || null,
    status: values.status,
    startDate: values.startDate || null,
    endDate: values.endDate || null,
    sourceCampaignId: values.sourceCampaignId || null,
  };
}
