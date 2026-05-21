import { apiFetchJson } from '@/shared/api/client';
import type {
  CampaignScheduleItem,
  CreateCampaignEventInput,
  UpdateCampaignEventInput,
} from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignScheduleItemResponse {
  id: string;
  title: string;
  event_type: CampaignScheduleItem['eventType'];
  source_type: CampaignScheduleItem['sourceType'];
  source_id: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  notes: string | null;
  is_editable: boolean;
}

interface CampaignEventResponse {
  id: string;
  campaign_id: string;
  title: string;
  event_type: CampaignScheduleItem['eventType'];
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  notes: string | null;
  source_type: CampaignScheduleItem['sourceType'];
  source_id: string | null;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function mapCampaignScheduleItem(
  item: CampaignScheduleItemResponse
): CampaignScheduleItem {
  return {
    id: item.id,
    title: item.title,
    eventType: item.event_type,
    sourceType: item.source_type,
    sourceId: item.source_id,
    startAt: item.start_at,
    endAt: item.end_at,
    allDay: item.all_day,
    notes: item.notes,
    isEditable: item.is_editable,
  };
}

export async function createCampaignEvent(
  campaignId: string,
  input: CreateCampaignEventInput
): Promise<void> {
  await apiFetchJson<CampaignEventResponse>(`/api/v1/campaigns/${campaignId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      event_type: input.eventType,
      start_at: input.startAt,
      end_at: input.endAt ?? null,
      all_day: input.allDay ?? false,
      notes: input.notes ?? null,
    }),
  });
}

export async function updateCampaignEvent(
  campaignId: string,
  eventId: string,
  input: UpdateCampaignEventInput
): Promise<void> {
  await apiFetchJson<CampaignEventResponse>(
    `/api/v1/campaigns/${campaignId}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        event_type: input.eventType,
        start_at: input.startAt,
        end_at: input.endAt ?? null,
        all_day: input.allDay,
        notes: input.notes ?? null,
      }),
    }
  );
}

export async function deleteCampaignEvent(
  campaignId: string,
  eventId: string
): Promise<void> {
  await apiFetchJson(`/api/v1/campaigns/${campaignId}/events/${eventId}`, {
    method: 'DELETE',
  });
}
