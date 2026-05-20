import { useMemo, useState } from 'react';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import {
  buildCalendarWeeks,
  formatMonthLabel,
  formatScheduleDateRange,
  getInitialScheduleMonth,
  sourceIcon,
  sourceLabel,
  sourceTone,
  stepMonth,
} from '@/features/campaigns/model/campaignSchedule';
import type { CampaignScheduleItem } from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignStudioScheduleCalendarProps {
  items: CampaignScheduleItem[];
  canManageSchedule: boolean;
  onSelectDate: (dateKey: string) => void;
  onSelectItem: (item: CampaignScheduleItem) => void;
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function CampaignStudioScheduleCalendar({
  items,
  canManageSchedule,
  onSelectDate,
  onSelectItem,
}: CampaignStudioScheduleCalendarProps) {
  const [monthKey, setMonthKey] = useState(() => getInitialScheduleMonth(items));
  const weeks = useMemo(() => buildCalendarWeeks(items, monthKey), [items, monthKey]);

  return (
    <CampaignStudioSectionCard
      eyebrow="Schedule"
      title="Campaign Calendar"
      description="Use the calendar as the main campaign planning surface. Add dates directly from the grid and edit any milestone, communication, or event in place."
    >
      <div className="campaign-studio__calendar-header">
        <div>
          <h3 className="h6 mb-1">{formatMonthLabel(monthKey)}</h3>
          <div className="small text-muted">
            Click a date to add something new. Click any item on the calendar to edit it.
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
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
            onClick={() => setMonthKey(getInitialScheduleMonth(items))}
          >
            Today
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

      <div className="campaign-studio__calendar-legend">
        <span className="campaign-studio__calendar-legend-item tone-manual">
          <i className={`bi ${sourceIcon('manual')}`} aria-hidden="true" />
          <span>{sourceLabel('manual')}</span>
        </span>
        <span className="campaign-studio__calendar-legend-item tone-milestone">
          <i className={`bi ${sourceIcon('milestone')}`} aria-hidden="true" />
          <span>{sourceLabel('milestone')}</span>
        </span>
        <span className="campaign-studio__calendar-legend-item tone-communication">
          <i className={`bi ${sourceIcon('communication')}`} aria-hidden="true" />
          <span>{sourceLabel('communication')}</span>
        </span>
      </div>

      <div className="campaign-studio__calendar-grid" role="grid" aria-label="Campaign calendar">
        {weekdayLabels.map((label) => (
          <div key={label} className="campaign-studio__calendar-weekday">
            {label}
          </div>
        ))}

        {weeks.flatMap((week) =>
          week.days.map((day) => (
            <section
              key={day.key}
              className={`campaign-studio__calendar-day ${day.inMonth ? '' : 'is-outside-month'}`}
            >
              <div className="campaign-studio__calendar-day-top">
                <div className="campaign-studio__calendar-day-number">{day.date.getDate()}</div>
                {day.inMonth && canManageSchedule ? (
                  <button
                    type="button"
                    className="campaign-studio__calendar-add-button"
                    onClick={() => onSelectDate(day.key)}
                    aria-label={`Add a calendar item on ${day.key}`}
                  >
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div className="campaign-studio__calendar-items">
                {day.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`campaign-studio__calendar-item tone-${sourceTone(item.sourceType)}`}
                    onClick={() => onSelectItem(item)}
                    disabled={!canManageSchedule}
                    aria-label={`${item.title}, ${formatScheduleDateRange(item)}`}
                  >
                    <span className="campaign-studio__calendar-item-title">
                      <i className={`bi ${sourceIcon(item.sourceType)}`} aria-hidden="true" />
                      <span>{item.title}</span>
                    </span>
                    <span className="campaign-studio__calendar-item-meta">
                      {formatScheduleDateRange(item)}
                    </span>
                  </button>
                ))}

                {day.items.length === 0 && day.inMonth ? (
                  <button
                    type="button"
                    className="campaign-studio__calendar-empty-slot"
                    onClick={() => onSelectDate(day.key)}
                    disabled={!canManageSchedule}
                  >
                    {canManageSchedule ? 'Add to this day' : 'No items'}
                  </button>
                ) : null}
              </div>
            </section>
          ))
        )}
      </div>
    </CampaignStudioSectionCard>
  );
}
