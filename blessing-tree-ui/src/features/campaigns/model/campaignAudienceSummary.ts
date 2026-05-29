import type {
  CommunicationAudienceOption,
  CommunicationAudienceRecipientSummary,
} from '@/features/campaigns/model/campaignStudioTypes';

export function audienceLabelForSummary(
  audienceCatalog: CommunicationAudienceOption[],
  summary: CommunicationAudienceRecipientSummary | null,
  fallbackAudience: string | null
): string {
  const key = summary?.audience ?? fallbackAudience;
  const option = key ? audienceCatalog.find((item) => item.key === key) : null;
  return option?.label ?? String(key ?? 'Audience').replaceAll('_', ' ').toLowerCase();
}
