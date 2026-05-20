import { useMemo, useState } from 'react';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import {
  buildCalendarWeeks,
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
  const [selectedYear, selectedMonth] = monthKey.split('-').map(Number);
  const yearOptions = useMemo(() => buildYearOptions(items), [items]);

  return (
    <CampaignStudioSectionCard
      eyebrow=""
      title=""
      showHeader={false}
    >
      <div className="campaign-studio__calendar-header">
        <div className="campaign-studio__calendar-period-picker">
          <label className="campaign-studio__calendar-period-field" htmlFor="campaign-calendar-month">
            <span className="visually-hidden">Month</span>
            <select
              id="campaign-calendar-month"
              className="form-select form-select-lg"
              value={selectedMonth}
              onChange={(event) =>
                setMonthKey(formatMonthKeyParts(selectedYear, Number(event.target.value)))
              }
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="campaign-studio__calendar-period-field year-field" htmlFor="campaign-calendar-year">
            <span className="visually-hidden">Year</span>
            <select
              id="campaign-calendar-year"
              className="form-select form-select-lg"
              value={selectedYear}
              onChange={(event) =>
                setMonthKey(formatMonthKeyParts(Number(event.target.value), selectedMonth))
              }
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
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

function buildYearOptions(items: CampaignScheduleItem[]): number[] {
  const itemYears = items
    .map((item) => item.startAt?.slice(0, 4))
    .filter((year): year is string => Boolean(year))
    .map(Number);
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(currentYear - 1, ...itemYears);
  const maxYear = Math.max(currentYear + 2, ...itemYears);
  return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
}

function formatMonthKeyParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;
