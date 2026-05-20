import { useMemo, useState } from 'react';
import '@/features/campaigns/ui/campaignStudioSchedule.css';
import {
  campaignScheduleViewOptions,
  formatScheduleDateRange,
  sourceLabel,
  type CampaignScheduleViewId,
} from '@/features/campaigns/model/campaignSchedule';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import type {
  CampaignAccess,
} from '@/features/campaigns/model/campaignTypes';
import type {
  CampaignMilestone,
  CampaignScheduleItem,
  CreateCampaignEventInput,
  SaveCampaignMilestoneInput,
  UpdateCampaignEventInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import { CampaignStudioMilestonesEditor } from '@/features/campaigns/ui/CampaignStudioMilestonesEditor';
import { CampaignStudioScheduleCalendar } from '@/features/campaigns/ui/CampaignStudioScheduleCalendar';
import { CampaignStudioScheduleEventForm } from '@/features/campaigns/ui/CampaignStudioScheduleEventForm';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import { CampaignStudioScheduleTimeline } from '@/features/campaigns/ui/CampaignStudioScheduleTimeline';

interface CampaignStudioScheduleSectionProps {
  access: CampaignAccess;
  items: CampaignScheduleItem[];
  milestones: CampaignMilestone[];
  isSaving: boolean;
  onSaveMilestones: (milestones: SaveCampaignMilestoneInput[]) => Promise<boolean>;
  onCreateEvent: (input: CreateCampaignEventInput) => Promise<boolean>;
  onUpdateEvent: (eventId: string, input: UpdateCampaignEventInput) => Promise<boolean>;
  onDeleteEvent: (eventId: string) => Promise<boolean>;
  onOpenCommunications: () => void;
}

export function CampaignStudioScheduleSection({
  access,
  items,
  milestones,
  isSaving,
  onSaveMilestones,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onOpenCommunications,
}: CampaignStudioScheduleSectionProps) {
  const [selectedView, setSelectedView] =
    useState<CampaignScheduleViewId>('timeline');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const canAdministerSchedule = canManageCampaign(access);
  const editingItem = useMemo(
    () =>
      items.find(
        (item) => item.id === editingItemId && item.sourceType === 'manual'
      ) ?? null,
    [editingItemId, items]
  );
  const summary = useMemo(
    () => ({
      total: items.length,
      manual: items.filter((item) => item.sourceType === 'manual').length,
      next: items.find((item) => item.startAt) ?? null,
    }),
    [items]
  );

  const handleDeleteEvent = async (item: CampaignScheduleItem) => {
    if (!canAdministerSchedule) {
      return;
    }
    const confirmed = window.confirm(`Delete "${item.title}" from the schedule?`);
    if (!confirmed) {
      return;
    }
    const didDelete = await onDeleteEvent(item.id);
    if (didDelete && editingItemId === item.id) {
      setEditingItemId(null);
    }
  };

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Schedule"
        title="Campaign Plan"
        description="Use one visible planning surface for manual events, milestone timing, and communication sequencing."
      >
        <div className="campaign-studio__schedule-header">
          <div>
            <div className="campaign-chip-row mb-2">
              <span className="campaign-chip">{summary.total} items</span>
              <span className="campaign-chip campaign-chip-muted">
                {summary.manual} manual
              </span>
              <span className="campaign-chip campaign-chip-muted">
                {milestones.length} milestones
              </span>
            </div>
            <div className="small text-muted">
              {summary.next
                ? `Next up: ${summary.next.title} · ${formatScheduleDateRange(summary.next)}`
                : 'No upcoming schedule items yet.'}
            </div>
          </div>

          <div className="campaign-studio__schedule-summary">
            {summary.next ? (
              <span className="campaign-chip">
                {sourceLabel(summary.next.sourceType)}
              </span>
            ) : null}
            <span className="campaign-chip campaign-chip-muted">
              {canAdministerSchedule ? 'Manager editing enabled' : 'View only'}
            </span>
          </div>
        </div>

        <div className="campaign-studio__schedule-tab-list" role="tablist" aria-label="Schedule views">
          {campaignScheduleViewOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selectedView === option.id}
              className={`campaign-studio__schedule-tab ${
                selectedView === option.id ? 'is-selected' : ''
              }`}
              onClick={() => setSelectedView(option.id)}
            >
              <span className="campaign-studio__schedule-tab-label">{option.label}</span>
              <span className="campaign-studio__schedule-tab-description">
                {option.description}
              </span>
            </button>
          ))}
        </div>
      </CampaignStudioSectionCard>

      {selectedView === 'timeline' ? (
        <CampaignStudioScheduleTimeline
          items={items}
          onEditManualEvent={(item) => setEditingItemId(item.id)}
          onDeleteManualEvent={handleDeleteEvent}
          onOpenMilestones={() => setSelectedView('milestones')}
          onOpenCommunications={onOpenCommunications}
        />
      ) : null}

      {selectedView === 'calendar' ? (
        <CampaignStudioScheduleCalendar
          key={items.map((item) => `${item.id}:${item.startAt ?? ''}:${item.endAt ?? ''}`).join('|')}
          items={items}
          onEditManualEvent={(item) => setEditingItemId(item.id)}
          onDeleteManualEvent={handleDeleteEvent}
          onOpenMilestones={() => setSelectedView('milestones')}
          onOpenCommunications={onOpenCommunications}
        />
      ) : null}

      {selectedView === 'milestones' ? (
        <CampaignStudioMilestonesEditor
          key={milestones
            .map(
              (milestone) =>
                `${milestone.milestoneKey}:${milestone.occursOn ?? ''}:${milestone.updatedAt ?? ''}`
            )
            .join('|')}
          milestones={milestones}
          isSaving={isSaving}
          onSave={onSaveMilestones}
        />
      ) : null}

      {selectedView !== 'milestones' ? (
        canAdministerSchedule ? (
          <CampaignStudioScheduleEventForm
            key={editingItem?.id ?? 'new-event'}
            isSaving={isSaving}
            editingItem={editingItem}
            onCreateEvent={onCreateEvent}
            onUpdateEvent={onUpdateEvent}
            onCancelEdit={() => setEditingItemId(null)}
          />
        ) : (
          <CampaignStudioSectionCard
            eyebrow="Manual Event"
            title="Planning Events"
            description="Manual event edits are restricted to campaign managers and app admins."
          >
            <div className="campaign-studio__empty-note">
              You currently have read-only schedule access for this campaign.
            </div>
          </CampaignStudioSectionCard>
        )
      ) : null}
    </div>
  );
}
