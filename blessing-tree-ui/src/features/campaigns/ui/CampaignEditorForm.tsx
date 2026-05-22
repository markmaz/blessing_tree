import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
          Year
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
          Status
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
          Season Theme
          <input
            className={`form-control ${errors.seasonTheme ? 'is-invalid' : ''}`}
            placeholder="Grace & Renewal"
            {...register('seasonTheme', {
              validate: (value) =>
                value.trim().length <= 120 || 'Season theme must be 120 characters or fewer',
            })}
          />
          {errors.seasonTheme ? (
            <div className="invalid-feedback d-block">{errors.seasonTheme.message}</div>
          ) : (
            <div className="form-text">
              Used in the app shell devotional modal and other campaign-specific seasonal touches.
            </div>
          )}
        </label>

        <label className="form-label">
          Start Date
          <input type="date" className="form-control" {...register('startDate')} />
        </label>

        <label className="form-label">
          End Date
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
