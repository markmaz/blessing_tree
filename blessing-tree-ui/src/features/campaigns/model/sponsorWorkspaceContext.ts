import { useOutletContext } from 'react-router-dom';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import type {
  CampaignSponsor,
  CampaignSponsorInteraction,
  CampaignSponsorWorkspaceData,
  PendingSponsorRegistration,
  SponsorCommunicationPreview,
  SponsorCommunicationSendResult,
  SponsorInteractionUpsertInput,
  SponsorUpsertInput,
  SponsorshipUpsertInput,
} from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import type { CommunicationTemplate } from '@/features/campaigns/model/campaignStudioTypes';

export interface SponsorWorkspaceOutletContext {
  campaignId: string;
  campaignName: string;
  access: CampaignAccess | null;
  workspace: CampaignSponsorWorkspaceData | null;
  pendingRegistrations: PendingSponsorRegistration[];
  pendingRegistrationError: string | null;
  communicationTemplates: CommunicationTemplate[];
  communicationTemplateError: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveMessage: string | null;
  interactionsBySponsor: Record<
    string,
    {
      items: CampaignSponsorInteraction[];
      isLoading: boolean;
      error: string | null;
      loaded: boolean;
    }
  >;
  onLoadSponsorInteractions: (sponsorId: string) => Promise<CampaignSponsorInteraction[]>;
  onPreviewCommunication: (
    sponsorId: string,
    templateId: string
  ) => Promise<SponsorCommunicationPreview | null>;
  onSendCommunication: (
    sponsorId: string,
    templateId: string
  ) => Promise<SponsorCommunicationSendResult | null>;
  onSaveSponsor: (
    sponsor: SponsorUpsertInput,
    participation: SponsorshipUpsertInput,
    sponsorId?: string
  ) => Promise<CampaignSponsor | null>;
  onDeleteSponsor: (sponsorId: string) => Promise<boolean>;
  onSaveInteraction: (
    sponsorId: string,
    input: SponsorInteractionUpsertInput,
    interactionId?: string
  ) => Promise<CampaignSponsorInteraction | null>;
  onDeleteInteraction: (sponsorId: string, interactionId: string) => Promise<boolean>;
  onResendPendingRegistration: (registrationId: string) => Promise<boolean>;
  onCancelPendingRegistration: (registrationId: string) => Promise<boolean>;
  onVerifyPendingRegistration: (registrationId: string) => Promise<boolean>;
  onClearSaveMessage: () => void;
  onClearError: () => void;
}

export function useSponsorWorkspaceContext() {
  return useOutletContext<SponsorWorkspaceOutletContext>();
}
