import { type FormEvent, useEffect, useState } from 'react';
import type {
  CampaignGiftPolicy,
  RecipientCoverageRule,
  UpdateCampaignGiftPolicyInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import { FieldHelpButton } from '@/features/ask/ui/FieldHelpButton';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';

interface CampaignStudioGiftRulesSectionProps {
  campaignId?: string | null;
  policy: CampaignGiftPolicy;
  isSaving: boolean;
  canEdit: boolean;
  onSavePolicy: (input: UpdateCampaignGiftPolicyInput) => Promise<boolean>;
}

export function CampaignStudioGiftRulesSection({
  campaignId,
  policy,
  isSaving,
  canEdit,
  onSavePolicy,
}: CampaignStudioGiftRulesSectionProps) {
  const [draft, setDraft] = useState(() => policyToDraft(policy));

  useEffect(() => {
    setDraft(policyToDraft(policy));
  }, [policy]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSavePolicy({
      maxGiftsPerSponsor: toInt(draft.maxGiftsPerSponsor),
      maxWishlistItemsPerRecipient: toInt(draft.maxWishlistItemsPerRecipient),
      recipientCoverageRule: draft.recipientCoverageRule,
      recipientCoverageRequiredCount: toInt(draft.recipientCoverageRequiredCount),
      allowPartialSponsorCommitments: draft.allowPartialSponsorCommitments,
      reservationHoldMinutes: toInt(draft.reservationHoldMinutes),
    });
  };

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Gift Rules"
        title="Campaign Gift Policy"
        description="Set campaign-level limits for sponsor commitments, wishlist size, reservation holds, and recipient coverage."
      >
        <form className="campaign-team-form-grid" onSubmit={handleSubmit}>
          <label className="form-label">
            <span className="d-inline-flex align-items-center gap-1">
              <span>Gifts per Sponsor</span>
              <FieldHelpButton campaignId={campaignId} screen="Gift Rules" fieldName="Sponsor Gift Limit" />
            </span>
            <input
              className="form-control mt-2"
              type="number"
              min={1}
              max={100}
              value={draft.maxGiftsPerSponsor}
              onChange={(event) => setDraft((currentValue) => ({ ...currentValue, maxGiftsPerSponsor: event.target.value }))}
              disabled={!canEdit || isSaving}
            />
          </label>

          <label className="form-label">
            <span className="d-inline-flex align-items-center gap-1">
              <span>Wishlist Gifts per Person</span>
              <FieldHelpButton campaignId={campaignId} screen="Gift Rules" fieldName="Wishlist Gift Limit" />
            </span>
            <input
              className="form-control mt-2"
              type="number"
              min={1}
              max={100}
              value={draft.maxWishlistItemsPerRecipient}
              onChange={(event) => setDraft((currentValue) => ({ ...currentValue, maxWishlistItemsPerRecipient: event.target.value }))}
              disabled={!canEdit || isSaving}
            />
          </label>

          <label className="form-label">
            <span className="d-inline-flex align-items-center gap-1">
              <span>Recipient Coverage Rule</span>
              <FieldHelpButton campaignId={campaignId} screen="Gift Rules" fieldName="Fulfillment Rule" />
            </span>
            <select
              className="form-select mt-2"
              value={draft.recipientCoverageRule}
              onChange={(event) =>
                setDraft((currentValue) => ({
                  ...currentValue,
                  recipientCoverageRule: event.target.value as RecipientCoverageRule,
                }))
              }
              disabled={!canEdit || isSaving}
            >
              <option value="ONE_GIFT_SPONSORED">At least one gift sponsored</option>
              <option value="MIN_GIFTS_SPONSORED">Minimum number sponsored</option>
              <option value="ALL_GIFTS_SPONSORED">All gifts sponsored</option>
            </select>
          </label>

          <label className="form-label">
            <span className="d-inline-flex align-items-center gap-1">
              <span>Required Sponsored Gifts</span>
              <FieldHelpButton campaignId={campaignId} screen="Gift Rules" fieldName="Fulfilled Gift Count" />
            </span>
            <input
              className="form-control mt-2"
              type="number"
              min={1}
              max={100}
              value={draft.recipientCoverageRequiredCount}
              onChange={(event) => setDraft((currentValue) => ({ ...currentValue, recipientCoverageRequiredCount: event.target.value }))}
              disabled={!canEdit || isSaving || draft.recipientCoverageRule !== 'MIN_GIFTS_SPONSORED'}
            />
          </label>

          <label className="form-label">
            <span className="d-inline-flex align-items-center gap-1">
              <span>Reservation Hold Minutes</span>
              <FieldHelpButton campaignId={campaignId} screen="Gift Rules" fieldName="Reminder Rules" />
            </span>
            <input
              className="form-control mt-2"
              type="number"
              min={5}
              max={10080}
              value={draft.reservationHoldMinutes}
              onChange={(event) => setDraft((currentValue) => ({ ...currentValue, reservationHoldMinutes: event.target.value }))}
              disabled={!canEdit || isSaving}
            />
          </label>

          <label className="form-check align-self-end">
            <input
              className="form-check-input"
              type="checkbox"
              checked={draft.allowPartialSponsorCommitments}
              onChange={(event) => setDraft((currentValue) => ({ ...currentValue, allowPartialSponsorCommitments: event.target.checked }))}
              disabled={!canEdit || isSaving}
            />
            <span className="form-check-label">Allow partial sponsor commitments</span>
          </label>

          <div className="campaign-team-drawer__actions campaign-team-form-grid__span-2">
            <button type="submit" className="btn btn-secondary btn-sm" disabled={!canEdit || isSaving}>
              <i className={`bi ${isSaving ? 'bi-arrow-repeat' : 'bi-floppy'} me-2`} aria-hidden="true" />
              Save Gift Rules
            </button>
          </div>
        </form>
      </CampaignStudioSectionCard>
    </div>
  );
}

function policyToDraft(policy: CampaignGiftPolicy) {
  return {
    maxGiftsPerSponsor: String(policy.maxGiftsPerSponsor),
    maxWishlistItemsPerRecipient: String(policy.maxWishlistItemsPerRecipient),
    recipientCoverageRule: policy.recipientCoverageRule,
    recipientCoverageRequiredCount: String(policy.recipientCoverageRequiredCount),
    allowPartialSponsorCommitments: policy.allowPartialSponsorCommitments,
    reservationHoldMinutes: String(policy.reservationHoldMinutes),
  };
}

function toInt(value: string) {
  return Number.parseInt(value, 10);
}
