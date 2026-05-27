import { apiFetchJson } from '@/shared/api/client';
import type { GiftTagOrientation, GiftTagTemplate, GiftTagTemplateInput } from '@/features/gifts/model/giftTagTemplateTypes';

interface GiftTagTemplateResponse {
  id: string;
  campaign_id: string;
  template_key: string;
  name: string;
  tag_width_in: number;
  tag_height_in: number;
  orientation: GiftTagOrientation;
  layout_json: Record<string, unknown>;
  gift_tag_message: string | null;
  include_cut_lines_default: boolean;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface GiftTagTemplateEnvelope {
  template: GiftTagTemplateResponse;
}

export async function getGiftTagTemplate(campaignId: string): Promise<GiftTagTemplate> {
  const response = await apiFetchJson<GiftTagTemplateEnvelope>(`/api/v1/campaigns/${campaignId}/gift-tag-template`);
  return mapGiftTagTemplate(response.template);
}

export async function updateGiftTagTemplate(campaignId: string, input: GiftTagTemplateInput): Promise<GiftTagTemplate> {
  const response = await apiFetchJson<GiftTagTemplateEnvelope>(`/api/v1/campaigns/${campaignId}/gift-tag-template`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeGiftTagTemplateInput(input)),
  });
  return mapGiftTagTemplate(response.template);
}

function mapGiftTagTemplate(response: GiftTagTemplateResponse): GiftTagTemplate {
  return {
    id: response.id,
    campaignId: response.campaign_id,
    templateKey: response.template_key,
    name: response.name,
    tagWidthIn: response.tag_width_in,
    tagHeightIn: response.tag_height_in,
    orientation: response.orientation,
    layoutJson: response.layout_json ?? {},
    giftTagMessage: response.gift_tag_message,
    includeCutLinesDefault: response.include_cut_lines_default,
    isActive: response.is_active,
    createdByUserId: response.created_by_user_id,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function serializeGiftTagTemplateInput(input: GiftTagTemplateInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ('templateKey' in input) payload.template_key = input.templateKey;
  if ('name' in input) payload.name = input.name;
  if ('tagWidthIn' in input) payload.tag_width_in = input.tagWidthIn;
  if ('tagHeightIn' in input) payload.tag_height_in = input.tagHeightIn;
  if ('orientation' in input) payload.orientation = input.orientation;
  if ('layoutJson' in input) payload.layout_json = input.layoutJson ?? {};
  if ('giftTagMessage' in input) payload.gift_tag_message = input.giftTagMessage;
  if ('includeCutLinesDefault' in input) payload.include_cut_lines_default = input.includeCutLinesDefault;
  if ('isActive' in input) payload.is_active = input.isActive;
  return payload;
}
