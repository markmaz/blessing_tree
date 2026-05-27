import { apiFetchJson } from '@/shared/api/client';
import type {
  CampaignFlyer,
  CampaignFlyerInput,
  CampaignFlyerQrTargetType,
  CampaignFlyerThemeMode,
  CampaignFlyerType,
} from '@/features/campaigns/model/campaignFlyerTypes';

interface CampaignFlyerResponse {
  id: string;
  campaign_id: string;
  flyer_key: string;
  name: string;
  flyer_type: CampaignFlyerType;
  headline: string;
  subheadline: string | null;
  body_text: string;
  call_to_action: string;
  contact_info: string | null;
  qr_target_type: CampaignFlyerQrTargetType;
  qr_custom_url: string | null;
  theme_mode: CampaignFlyerThemeMode;
  image_prompt: string | null;
  layout_json: Record<string, unknown> | null;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function listCampaignFlyers(campaignId: string): Promise<CampaignFlyer[]> {
  const response = await apiFetchJson<CampaignFlyerResponse[]>(`/api/v1/campaigns/${campaignId}/flyers`);
  return response.map(mapCampaignFlyer);
}

export async function createCampaignFlyer(campaignId: string, input: CampaignFlyerInput): Promise<CampaignFlyer> {
  const response = await apiFetchJson<CampaignFlyerResponse>(`/api/v1/campaigns/${campaignId}/flyers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeCampaignFlyerInput(input)),
  });
  return mapCampaignFlyer(response);
}

export async function updateCampaignFlyer(
  campaignId: string,
  flyerId: string,
  input: Partial<CampaignFlyerInput>
): Promise<CampaignFlyer> {
  const response = await apiFetchJson<CampaignFlyerResponse>(`/api/v1/campaigns/${campaignId}/flyers/${flyerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeCampaignFlyerInput(input)),
  });
  return mapCampaignFlyer(response);
}

export async function deleteCampaignFlyer(campaignId: string, flyerId: string): Promise<void> {
  await apiFetchJson(`/api/v1/campaigns/${campaignId}/flyers/${flyerId}`, {
    method: 'DELETE',
  });
}

function mapCampaignFlyer(response: CampaignFlyerResponse): CampaignFlyer {
  return {
    id: response.id,
    campaignId: response.campaign_id,
    flyerKey: response.flyer_key,
    name: response.name,
    flyerType: response.flyer_type,
    headline: response.headline,
    subheadline: response.subheadline,
    bodyText: response.body_text,
    callToAction: response.call_to_action,
    contactInfo: response.contact_info,
    qrTargetType: response.qr_target_type,
    qrCustomUrl: response.qr_custom_url,
    themeMode: response.theme_mode,
    imagePrompt: response.image_prompt,
    layoutJson: response.layout_json ?? {},
    isActive: response.is_active,
    createdByUserId: response.created_by_user_id,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function serializeCampaignFlyerInput(input: Partial<CampaignFlyerInput>) {
  const payload: Record<string, unknown> = {};
  if ('flyerKey' in input) payload.flyer_key = input.flyerKey;
  if ('name' in input) payload.name = input.name;
  if ('flyerType' in input) payload.flyer_type = input.flyerType;
  if ('headline' in input) payload.headline = input.headline;
  if ('subheadline' in input) payload.subheadline = input.subheadline;
  if ('bodyText' in input) payload.body_text = input.bodyText;
  if ('callToAction' in input) payload.call_to_action = input.callToAction;
  if ('contactInfo' in input) payload.contact_info = input.contactInfo;
  if ('qrTargetType' in input) payload.qr_target_type = input.qrTargetType;
  if ('qrCustomUrl' in input) payload.qr_custom_url = input.qrCustomUrl;
  if ('themeMode' in input) payload.theme_mode = input.themeMode;
  if ('imagePrompt' in input) payload.image_prompt = input.imagePrompt;
  if ('layoutJson' in input) payload.layout_json = input.layoutJson ?? {};
  if ('isActive' in input) payload.is_active = input.isActive;
  return payload;
}
