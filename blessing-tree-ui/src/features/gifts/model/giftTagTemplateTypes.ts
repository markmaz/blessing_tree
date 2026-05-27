export type GiftTagOrientation = 'PORTRAIT' | 'LANDSCAPE';

export interface GiftTagTemplate {
  id: string;
  campaignId: string;
  templateKey: string;
  name: string;
  tagWidthIn: number;
  tagHeightIn: number;
  orientation: GiftTagOrientation;
  layoutJson: Record<string, unknown>;
  giftTagMessage: string | null;
  includeCutLinesDefault: boolean;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GiftTagTemplateInput {
  templateKey?: string;
  name?: string;
  tagWidthIn?: number;
  tagHeightIn?: number;
  orientation?: GiftTagOrientation;
  layoutJson?: Record<string, unknown>;
  giftTagMessage?: string | null;
  includeCutLinesDefault?: boolean;
  isActive?: boolean;
}
