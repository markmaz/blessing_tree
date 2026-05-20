import { useMemo, useState } from 'react';
import { communicationAudienceOptions, milestoneDefinitions } from '@/features/campaigns/model/campaignStudio';
import type {
  CommunicationSchedule,
  CommunicationTemplate,
  CreateCommunicationScheduleInput,
  CreateCommunicationTemplateInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';

interface CampaignStudioCommunicationsSectionProps {
  templates: CommunicationTemplate[];
  schedules: CommunicationSchedule[];
  isSaving: boolean;
  onCreateTemplate: (input: CreateCommunicationTemplateInput) => Promise<boolean>;
  onCreateSchedule: (input: CreateCommunicationScheduleInput) => Promise<boolean>;
}

const emptyTemplateForm: CreateCommunicationTemplateInput = {
  templateKey: '',
  name: '',
  audience: 'GENERAL',
  subjectTemplate: '',
  bodyTemplate: '',
};

const emptyScheduleForm: CreateCommunicationScheduleInput = {
  templateId: '',
  milestoneKey: 'registration_open',
  scheduledFor: null,
  status: 'DRAFT',
  notes: '',
};

export function CampaignStudioCommunicationsSection({
  templates,
  schedules,
  isSaving,
  onCreateTemplate,
  onCreateSchedule,
}: CampaignStudioCommunicationsSectionProps) {
  const [templateForm, setTemplateForm] =
    useState<CreateCommunicationTemplateInput>(emptyTemplateForm);
  const [scheduleForm, setScheduleForm] =
    useState<CreateCommunicationScheduleInput>(emptyScheduleForm);
  const templateOptions = useMemo(
    () => templates.filter((template) => template.isActive),
    [templates]
  );

  const handleTemplateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const didSave = await onCreateTemplate({
      ...templateForm,
      templateKey: templateForm.templateKey.trim().toLowerCase().replace(/\s+/g, '_'),
      name: templateForm.name.trim(),
      subjectTemplate: templateForm.subjectTemplate.trim(),
      bodyTemplate: templateForm.bodyTemplate.trim(),
    });
    if (didSave) {
      setTemplateForm(emptyTemplateForm);
    }
  };

  const handleScheduleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const didSave = await onCreateSchedule({
      templateId: scheduleForm.templateId,
      milestoneKey: scheduleForm.milestoneKey || null,
      scheduledFor: scheduleForm.scheduledFor || null,
      status: scheduleForm.status,
      notes: scheduleForm.notes?.trim() || null,
    });
    if (didSave) {
      setScheduleForm((currentForm) => ({
        ...emptyScheduleForm,
        templateId: currentForm.templateId,
      }));
    }
  };

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Communications"
        title="Templates and Scheduled Sends"
        description="Create reusable message templates and connect them to milestones or explicit send times."
      >
        <div className="campaign-studio__section-grid">
          <div className="campaign-studio__list-column">
            <h3 className="h6 mb-3">Templates</h3>
            <div className="campaign-studio__section-list">
              {templates.length === 0 ? (
                <div className="campaign-studio__empty-note">
                  No templates yet. Add the first sponsor or volunteer message.
                </div>
              ) : (
                templates.map((template) => (
                  <article key={template.id} className="campaign-studio__list-card">
                    <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                      <div>
                        <h4 className="h6 mb-1">{template.name}</h4>
                        <div className="small text-muted">{template.subjectTemplate}</div>
                      </div>
                      <div className="campaign-chip-row">
                        <span className="campaign-chip">{template.audience}</span>
                        {!template.isActive ? (
                          <span className="campaign-chip campaign-chip-muted">Inactive</span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="campaign-studio__list-column">
            <h3 className="h6 mb-3">Schedules</h3>
            <div className="campaign-studio__section-list">
              {schedules.length === 0 ? (
                <div className="campaign-studio__empty-note">
                  No communication schedules yet.
                </div>
              ) : (
                schedules.map((schedule) => (
                  <article key={schedule.id} className="campaign-studio__list-card">
                    <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                      <div>
                        <h4 className="h6 mb-1">{schedule.template.name}</h4>
                        <div className="small text-muted">
                          {schedule.milestoneKey
                            ? milestoneDefinitions.find((item) => item.key === schedule.milestoneKey)?.label ??
                              schedule.milestoneKey
                            : schedule.scheduledFor || 'No timing set'}
                        </div>
                      </div>
                      <span className="campaign-chip">{schedule.status}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </CampaignStudioSectionCard>

      <div className="campaign-studio__section-grid">
        <CampaignStudioSectionCard
          eyebrow="Add Template"
          title="Create a Message Template"
          description="Templates are global, reusable building blocks that can later be bound to this campaign."
        >
          <form className="campaign-studio__form-grid" onSubmit={handleTemplateSubmit}>
            <label className="form-label">
              Template Name
              <input
                className="form-control"
                value={templateForm.name}
                onChange={(event) =>
                  setTemplateForm((currentForm) => ({
                    ...currentForm,
                    name: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="form-label">
              Template Key
              <input
                className="form-control"
                value={templateForm.templateKey}
                onChange={(event) =>
                  setTemplateForm((currentForm) => ({
                    ...currentForm,
                    templateKey: event.target.value,
                  }))
                }
                placeholder="sponsor_reminder"
                required
              />
            </label>
            <label className="form-label">
              Audience
              <select
                className="form-select"
                value={templateForm.audience}
                onChange={(event) =>
                  setTemplateForm((currentForm) => ({
                    ...currentForm,
                    audience: event.target.value,
                  }))
                }
              >
                {communicationAudienceOptions.map((audience) => (
                  <option key={audience} value={audience}>
                    {audience}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label campaign-studio__form-span-2">
              Subject
              <input
                className="form-control"
                value={templateForm.subjectTemplate}
                onChange={(event) =>
                  setTemplateForm((currentForm) => ({
                    ...currentForm,
                    subjectTemplate: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="form-label campaign-studio__form-span-2">
              Body
              <textarea
                className="form-control"
                rows={6}
                value={templateForm.bodyTemplate}
                onChange={(event) =>
                  setTemplateForm((currentForm) => ({
                    ...currentForm,
                    bodyTemplate: event.target.value,
                  }))
                }
                required
              />
            </label>
            <div className="campaign-studio__form-actions">
              <button type="submit" className="btn btn-secondary btn-sm" disabled={isSaving}>
                Add Template
              </button>
            </div>
          </form>
        </CampaignStudioSectionCard>

        <CampaignStudioSectionCard
          eyebrow="Add Schedule"
          title="Schedule a Communication"
          description="Attach a template to a milestone or a specific send time."
        >
          <form className="campaign-studio__form-grid" onSubmit={handleScheduleSubmit}>
            <label className="form-label campaign-studio__form-span-2">
              Template
              <select
                className="form-select"
                value={scheduleForm.templateId}
                onChange={(event) =>
                  setScheduleForm((currentForm) => ({
                    ...currentForm,
                    templateId: event.target.value,
                  }))
                }
                required
              >
                <option value="">Select a template</option>
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Milestone
              <select
                className="form-select"
                value={scheduleForm.milestoneKey ?? ''}
                onChange={(event) =>
                  setScheduleForm((currentForm) => ({
                    ...currentForm,
                    milestoneKey: event.target.value || null,
                  }))
                }
              >
                <option value="">No milestone</option>
                {milestoneDefinitions.map((milestone) => (
                  <option key={milestone.key} value={milestone.key}>
                    {milestone.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Status
              <select
                className="form-select"
                value={scheduleForm.status}
                onChange={(event) =>
                  setScheduleForm((currentForm) => ({
                    ...currentForm,
                    status: event.target.value as CreateCommunicationScheduleInput['status'],
                  }))
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </label>
            <label className="form-label campaign-studio__form-span-2">
              Specific Send Time
              <input
                type="datetime-local"
                className="form-control"
                value={scheduleForm.scheduledFor ?? ''}
                onChange={(event) =>
                  setScheduleForm((currentForm) => ({
                    ...currentForm,
                    scheduledFor: event.target.value || null,
                  }))
                }
              />
            </label>
            <label className="form-label campaign-studio__form-span-2">
              Notes
              <textarea
                className="form-control"
                rows={4}
                value={scheduleForm.notes ?? ''}
                onChange={(event) =>
                  setScheduleForm((currentForm) => ({
                    ...currentForm,
                    notes: event.target.value,
                  }))
                }
              />
            </label>
            <div className="campaign-studio__form-actions">
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                disabled={isSaving || templateOptions.length === 0}
              >
                Add Schedule
              </button>
            </div>
          </form>
        </CampaignStudioSectionCard>
      </div>
    </div>
  );
}
