import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { buildCampaignSponsorFlyerPath, buildCampaignStudioPath, buildPublicCampaignSponsorPath } from '@/app/routes';
import { FieldHelpButton } from '@/features/ask/ui/FieldHelpButton';
import {
  buildCampaignEditorValues,
  campaignStatusOptions,
  toCampaignUpsertInput,
  type CampaignEditorValues,
} from '@/features/campaigns/model/campaignEditor';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';

interface CampaignEditorFormProps {
  campaign?: Campaign | null;
  title: string;
  description: string;
  submitLabel: string;
  isSaving: boolean;
  showHeader?: boolean;
  sourceCampaignOptions?: Campaign[];
  onSubmit: (values: ReturnType<typeof toCampaignUpsertInput>) => Promise<boolean>;
}

export function CampaignEditorForm({
  campaign,
  title,
  description,
  submitLabel,
  isSaving,
  showHeader = true,
  sourceCampaignOptions = [],
  onSubmit,
}: CampaignEditorFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CampaignEditorValues>({
    defaultValues: buildCampaignEditorValues(campaign),
  });

  useEffect(() => {
    reset(buildCampaignEditorValues(campaign));
  }, [campaign, reset]);

  const handleFormSubmit = handleSubmit(async (values) => {
    const didSave = await onSubmit(toCampaignUpsertInput(values));
    if (didSave && !campaign) {
      reset(buildCampaignEditorValues(null));
    }
  });

  const watchedPublicSponsorSlug = useWatch({
    control,
    name: 'publicSponsorSlug',
  }) ?? '';
  const publicSponsorPreviewUrl =
    watchedPublicSponsorSlug.trim().length > 0
      ? `${window.location.origin}${buildPublicCampaignSponsorPath(watchedPublicSponsorSlug.trim().toLowerCase())}`
      : null;

  return (
    <form className="campaign-editor-form" onSubmit={handleFormSubmit}>
      {showHeader ? (
        <>
          <div className="campaign-studio__card-eyebrow">Campaign Admin</div>
          <h2 className="h5 mb-2">{title}</h2>
          <p className="text-muted mb-4">{description}</p>
        </>
      ) : null}

      <div className="campaign-studio__form-grid">
        <label className="form-label campaign-studio__form-span-2">
          Campaign Name
          <input
            className={`form-control ${errors.name ? 'is-invalid' : ''}`}
            {...register('name', { required: 'Campaign name is required' })}
          />
          {errors.name ? (
            <div className="invalid-feedback d-block">{errors.name.message}</div>
          ) : null}
        </label>

        <label className="form-label">
          <span className="d-inline-flex align-items-center gap-1">
            <span>Year</span>
            <FieldHelpButton
              campaignId={campaign?.id}
              screen="Campaign Settings"
              fieldName="Year"
              route={campaign ? buildCampaignStudioPath(campaign.id) : undefined}
            />
          </span>
          <input
            type="number"
            className={`form-control ${errors.year ? 'is-invalid' : ''}`}
            {...register('year', {
              required: 'Campaign year is required',
              validate: (value) => {
                const year = Number(value);
                if (Number.isNaN(year)) {
                  return 'Campaign year is required';
                }
                if (year < 1900 || year > 3000) {
                  return 'Campaign year must be between 1900 and 3000';
                }
                return true;
              },
            })}
          />
          {errors.year ? (
            <div className="invalid-feedback d-block">{errors.year.message}</div>
          ) : null}
        </label>

        <label className="form-label">
          <span className="d-inline-flex align-items-center gap-1">
            <span>Status</span>
            <FieldHelpButton
              campaignId={campaign?.id}
              screen="Campaign Settings"
              fieldName="Status"
              route={campaign ? buildCampaignStudioPath(campaign.id) : undefined}
            />
          </span>
          <select
            className={`form-select ${errors.status ? 'is-invalid' : ''}`}
            {...register('status', { required: 'Campaign status is required' })}
          >
            {campaignStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="form-label campaign-studio__form-span-2">
          <span className="d-inline-flex align-items-center gap-1">
            <span>Campaign Purpose</span>
            <FieldHelpButton
              campaignId={campaign?.id}
              screen="Campaign Settings"
              fieldName="Campaign Purpose"
              route={campaign ? buildCampaignStudioPath(campaign.id) : undefined}
            />
          </span>
          <input
            className={`form-control ${errors.seasonTheme ? 'is-invalid' : ''}`}
            placeholder="Christmas giving, Easter baskets, winter coats"
            {...register('seasonTheme', {
              validate: (value) =>
                value.trim().length <= 120 || 'Campaign purpose must be 120 characters or fewer',
            })}
          />
          {errors.seasonTheme ? (
            <div className="invalid-feedback d-block">{errors.seasonTheme.message}</div>
          ) : (
            <div className="form-text">
              Drives campaign-specific touches, including the gift tag image/icon treatment.
            </div>
          )}
        </label>

        <label className="form-label campaign-studio__form-span-2">
          <span className="d-inline-flex align-items-center gap-1">
            <span>Public Sponsor Slug</span>
            <FieldHelpButton
              campaignId={campaign?.id}
              screen="Campaign Settings"
              fieldName="Public Sponsor Slug"
              route={campaign ? buildCampaignStudioPath(campaign.id) : undefined}
            />
          </span>
          <input
            className={`form-control ${errors.publicSponsorSlug ? 'is-invalid' : ''}`}
            placeholder="blessing-tree-2026-sponsors"
            {...register('publicSponsorSlug', {
              validate: (value) => {
                if (!value.trim()) {
                  return true;
                }
                return (
                  /^[a-z0-9-]+$/i.test(value.trim()) ||
                  'Public sponsor slug may only contain letters, numbers, and hyphens'
                );
              },
            })}
          />
          {errors.publicSponsorSlug ? (
            <div className="invalid-feedback d-block">{errors.publicSponsorSlug.message}</div>
          ) : (
            <div className="form-text">
              Used for the public sponsor signup link and QR flyer.
            </div>
          )}
        </label>

        <label className="form-label campaign-studio__form-span-2">
          <span className="d-flex align-items-center gap-2">
            <input type="checkbox" {...register('publicSponsorSignupEnabled')} />
            <span>Enable Public Sponsor Signup</span>
          </span>
          <div className="form-text">
            Requires sponsor registration start/end milestones and the gift deadline milestone to be set.
          </div>
        </label>

        {publicSponsorPreviewUrl ? (
          <div className="campaign-studio__form-span-2">
            <div className="campaign-studio__inline-note">
              <strong>Public Sponsor Link</strong>
              <div className="text-muted small">{publicSponsorPreviewUrl}</div>
              <div className="d-flex flex-wrap gap-2 mt-3">
                <a
                  href={publicSponsorPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline-secondary btn-sm"
                >
                  <i className="bi bi-box-arrow-up-right me-2" aria-hidden="true" />
                  Open Public Page
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {campaign ? (
          <div className="campaign-studio__form-span-2">
            <a
              href={buildCampaignSponsorFlyerPath(campaign.id)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline-secondary btn-sm"
            >
              <i className="bi bi-qr-code-scan me-2" aria-hidden="true" />
              Open Flyer Builder
            </a>
            <div className="form-text mt-2">
              Flyer QR codes can use this campaign setup and will show a warning until the public sponsor slug is set.
            </div>
          </div>
        ) : null}

        <label className="form-label">
          <span className="d-inline-flex align-items-center gap-1">
            <span>Start Date</span>
            <FieldHelpButton
              campaignId={campaign?.id}
              screen="Campaign Settings"
              fieldName="Start Date"
              route={campaign ? buildCampaignStudioPath(campaign.id) : undefined}
            />
          </span>
          <input type="date" className="form-control" {...register('startDate')} />
        </label>

        <label className="form-label">
          <span className="d-inline-flex align-items-center gap-1">
            <span>End Date</span>
            <FieldHelpButton
              campaignId={campaign?.id}
              screen="Campaign Settings"
              fieldName="End Date"
              route={campaign ? buildCampaignStudioPath(campaign.id) : undefined}
            />
          </span>
          <input type="date" className="form-control" {...register('endDate')} />
        </label>

        {!campaign && sourceCampaignOptions.length > 0 ? (
          <label className="form-label campaign-studio__form-span-2">
            Start From Previous Campaign
            <select className="form-select" {...register('sourceCampaignId')}>
              <option value="">Start from scratch</option>
              {sourceCampaignOptions.map((sourceCampaign) => (
                <option key={sourceCampaign.id} value={sourceCampaign.id}>
                  {sourceCampaign.name} ({sourceCampaign.year})
                </option>
              ))}
            </select>
            <div className="form-text">
              Copies campaign setup into the new campaign, including roster, teams, communications, milestones, and manual schedule events.
            </div>
          </label>
        ) : null}

        <label className="form-label campaign-studio__form-span-2">
          Description
          <textarea
            className="form-control"
            rows={5}
            {...register('description')}
          />
        </label>
      </div>

      <div className="campaign-studio__form-actions mt-4">
        <button type="submit" className="btn btn-secondary btn-sm" disabled={isSaving}>
          <i className="bi bi-floppy me-2" aria-hidden="true" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
