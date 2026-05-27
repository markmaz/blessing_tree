export type CampaignFlyerType = 'SPONSOR_RECRUITMENT' | 'CUSTOM';
export type CampaignFlyerQrTargetType = 'PUBLIC_SPONSOR_SIGNUP' | 'CUSTOM_URL' | 'NONE';
export type CampaignFlyerThemeMode = 'CAMPAIGN_PURPOSE' | 'BLESSING_TREE' | 'CUSTOM' | 'NONE';

export interface CampaignFlyer {
  id: string;
  campaignId: string;
  flyerKey: string;
  name: string;
  flyerType: CampaignFlyerType;
  headline: string;
  subheadline: string | null;
  bodyText: string;
  callToAction: string;
  contactInfo: string | null;
  qrTargetType: CampaignFlyerQrTargetType;
  qrCustomUrl: string | null;
  themeMode: CampaignFlyerThemeMode;
  imagePrompt: string | null;
  layoutJson: Record<string, unknown>;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignFlyerInput {
  flyerKey: string;
  name: string;
  flyerType: CampaignFlyerType;
  headline: string;
  subheadline: string | null;
  bodyText: string;
  callToAction: string;
  contactInfo: string | null;
  qrTargetType: CampaignFlyerQrTargetType;
  qrCustomUrl: string | null;
  themeMode: CampaignFlyerThemeMode;
  imagePrompt: string | null;
  layoutJson?: Record<string, unknown>;
  isActive: boolean;
}
