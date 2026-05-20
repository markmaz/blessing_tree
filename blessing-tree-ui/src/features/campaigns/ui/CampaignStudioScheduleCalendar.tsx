import { useMemo, useState } from 'react';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import {
  buildCalendarWeeks,
  eventTypeLabel,
  formatMonthLabel,
  formatScheduleDateRange,
  getInitialScheduleMonth,
  sourceLabel,
  stepMonth,
} from '@/features/campaigns/model/campaignSchedule';
import type { CampaignScheduleItem } from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignStudioScheduleCalendarProps {
  items: CampaignScheduleItem[];
  onEditManualEvent: (item: CampaignScheduleItem) => void;
  onDeleteManualEvent: (item: CampaignScheduleItem) => void;
  onOpenMilestones: () => void;
  onOpenCommunications: () => void;
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function CampaignStudioScheduleCalendar({
  items,
  onEditManualEvent,
  onDeleteManualEvent,
  onOpenMilestones,
  onOpenCommunications,
}: CampaignStudioScheduleCalendarProps) {
  const [monthKey, setMonthKey] = useState(() => getInitialScheduleMonth(items));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id ?? null);

  const weeks = useMemo(() => buildCalendarWeeks(items, monthKey), [items, monthKey]);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Schedule"
        title="Calendar"
        description="See the campaign as a month plan and inspect each milestone, communication, and manual event in place."
      >
        <div className="campaign-studio__calendar-header">
          <div>
            <h3 className="h6 mb-1">{formatMonthLabel(monthKey)}</h3>
            <div className="small text-muted">
              Click an item to inspect it and route edits back to the right source.
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setMonthKey((currentKey) => stepMonth(currentKey, -1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setMonthKey((currentKey) => stepMonth(currentKey, 1))}
            >
              Next
            </button>
          </div>
        </div>

        <div className="campaign-studio__calendar-grid" role="grid" aria-label="Campaign schedule calendar">
          {weekdayLabels.map((label) => (
            <div key={label} className="campaign-studio__calendar-weekday">
              {label}
            </div>
          ))}

          {weeks.flatMap((week) =>
            week.days.map((day) => (
              <section
                key={day.key}
                className={`campaign-studio__calendar-day ${
                  day.inMonth ? '' : 'is-outside-month'
                }`}
              >
                <div className="campaign-studio__calendar-day-number">{day.date.getDate()}</div>
                <div className="campaign-studio__calendar-items">
                  {day.items.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`campaign-studio__calendar-item ${
                        selectedItemId === item.id ? 'is-selected' : ''
                      }`}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <span>{item.title}</span>
                      <span className="campaign-studio__calendar-item-meta">
                        {sourceLabel(item.sourceType)}
                      </span>
                    </button>
                  ))}
                  {day.items.length > 3 ? (
                    <div className="campaign-studio__calendar-more">
                      +{day.items.length - 3} more
                    </div>
                  ) : null}
                </div>
              </section>
            ))
          )}
        </div>
      </CampaignStudioSectionCard>

      <CampaignStudioSectionCard
        eyebrow="Selected Item"
        title={selectedItem?.title ?? 'No Scheduled Item Selected'}
        description={
          selectedItem
            ? 'Inspect the selected schedule item and jump to the correct edit surface.'
            : 'Select a schedule item from the calendar to inspect its details.'
        }
      >
        {selectedItem ? (
          <>
            <div className="campaign-chip-row mb-3">
              <span className="campaign-chip">{sourceLabel(selectedItem.sourceType)}</span>
              <span className="campaign-chip campaign-chip-muted">
                {eventTypeLabel(selectedItem.eventType)}
              </span>
            </div>
            <div className="small text-muted mb-3">
              {formatScheduleDateRange(selectedItem)}
            </div>
            {selectedItem.notes ? (
              <p className="text-muted small mb-3">{selectedItem.notes}</p>
            ) : null}
            <div className="campaign-studio__timeline-actions">
              {selectedItem.sourceType === 'manual' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => onEditManualEvent(selectedItem)}
                  >
                    Edit event
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => onDeleteManualEvent(selectedItem)}
                  >
                    Delete event
                  </button>
                </>
              ) : selectedItem.sourceType === 'milestone' ? (
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
          </>
        ) : (
          <div className="campaign-studio__empty-note">
            This month does not have any schedule items yet.
          </div>
        )}
      </CampaignStudioSectionCard>
    </div>
  );
}
