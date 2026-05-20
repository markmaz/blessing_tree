import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import {
  eventTypeLabel,
  formatScheduleDateRange,
  sourceLabel,
} from '@/features/campaigns/model/campaignSchedule';
import type { CampaignScheduleItem } from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignStudioScheduleTimelineProps {
  items: CampaignScheduleItem[];
  onEditManualEvent: (item: CampaignScheduleItem) => void;
  onDeleteManualEvent: (item: CampaignScheduleItem) => void;
  onOpenMilestones: () => void;
  onOpenCommunications: () => void;
}

export function CampaignStudioScheduleTimeline({
  items,
  onEditManualEvent,
  onDeleteManualEvent,
  onOpenMilestones,
  onOpenCommunications,
}: CampaignStudioScheduleTimelineProps) {
  return (
    <CampaignStudioSectionCard
      eyebrow="Schedule"
      title="Timeline"
      description="See milestones, communications, and manual planning events in one chronological plan."
    >
      <div className="campaign-studio__timeline-list">
        {items.length === 0 ? (
          <div className="campaign-studio__empty-note">
            No schedule items exist yet. Add milestone dates or manual planning events to start shaping the campaign.
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="campaign-studio__timeline-item">
              <div className="campaign-studio__timeline-header">
                <div>
                  <div className="campaign-chip-row mb-2">
                    <span className="campaign-chip">{sourceLabel(item.sourceType)}</span>
                    <span className="campaign-chip campaign-chip-muted">
                      {eventTypeLabel(item.eventType)}
                    </span>
                  </div>
                  <h3 className="h6 mb-1">{item.title}</h3>
                  <div className="campaign-studio__timeline-date">
                    {formatScheduleDateRange(item)}
                  </div>
                </div>

                <div className="campaign-studio__timeline-actions">
                  {item.sourceType === 'manual' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => onEditManualEvent(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => onDeleteManualEvent(item)}
                      >
                        Delete
                      </button>
                    </>
                  ) : item.sourceType === 'milestone' ? (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={onOpenMilestones}
                    >
                      Edit milestone
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={onOpenCommunications}
                    >
                      Open communications
                    </button>
                  )}
                </div>
              </div>

              {item.notes ? <p className="text-muted small mb-0 mt-3">{item.notes}</p> : null}
            </article>
          ))
        )}
      </div>
    </CampaignStudioSectionCard>
  );
}
