import type {
  CampaignScheduleEventType,
  CampaignScheduleItem,
} from '@/features/campaigns/model/campaignStudioTypes';

export type CampaignScheduleViewId = 'timeline' | 'calendar' | 'milestones';

export const campaignScheduleViewOptions: Array<{
  id: CampaignScheduleViewId;
  label: string;
  description: string;
}> = [
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Chronological view of milestones, communications, and manual planning events.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Month layout for spotting clusters, gaps, and overlaps.',
  },
  {
    id: 'milestones',
    label: 'Milestones',
    description: 'Structured editing for named campaign checkpoints.',
  },
];

export const manualCampaignEventTypeOptions: Array<{
  value: CampaignScheduleEventType;
  label: string;
}> = [
  { value: 'GENERAL', label: 'General' },
  { value: 'VOLUNTEER', label: 'Volunteer' },
  { value: 'SPONSOR', label: 'Sponsor' },
  { value: 'DONATION', label: 'Donation' },
  { value: 'RECIPIENT', label: 'Recipient' },
  { value: 'GIFT', label: 'Gift' },
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'COMMUNICATION', label: 'Communication' },
];

export function getScheduleItemDate(item: CampaignScheduleItem): Date | null {
  return item.startAt ? new Date(item.startAt) : null;
}

export function getInitialScheduleMonth(items: CampaignScheduleItem[]): string {
  const startItem = items.find((item) => item.startAt);
  return formatMonthKey(startItem?.startAt ? new Date(startItem.startAt) : new Date());
}

export function formatScheduleDateRange(item: CampaignScheduleItem): string {
  if (!item.startAt) {
    return 'Unscheduled';
  }

  const startDate = new Date(item.startAt);
  const endDate = item.endAt ? new Date(item.endAt) : null;
  if (item.allDay) {
    const startLabel = formatDateOnly(startDate);
    if (!endDate || sameDay(startDate, endDate)) {
      return startLabel;
    }
    return `${startLabel} - ${formatDateOnly(endDate)}`;
  }

  const startLabel = formatDateTime(startDate);
  if (!endDate) {
    return startLabel;
  }
  if (sameDay(startDate, endDate)) {
    return `${startLabel} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `${startLabel} - ${formatDateTime(endDate)}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });
}

export function buildCalendarWeeks(
  items: CampaignScheduleItem[],
  monthKey: string
): CalendarWeek[] {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 6 }, (_, weekIndex) => ({
    id: `${monthKey}:week:${weekIndex}`,
    days: Array.from({ length: 7 }, (_, dayIndex) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex);
      return {
        key: formatDayKey(day),
        date: day,
        inMonth: day.getMonth() === firstDay.getMonth(),
        items: items.filter((item) => formatDayKey(getItemDisplayDate(item)) === formatDayKey(day)),
      };
    }),
  }));
}

export function stepMonth(monthKey: string, direction: -1 | 1): string {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(year, month - 1 + direction, 1);
  return formatMonthKey(next);
}

export function toDateInputValue(value: string | null): string {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
}

export function toDateTimeInputValue(value: string | null): string {
  if (!value) {
    return '';
  }
  return value.slice(0, 16);
}

export function sourceLabel(sourceType: CampaignScheduleItem['sourceType']): string {
  if (sourceType === 'manual') {
    return 'Manual';
  }
  if (sourceType === 'milestone') {
    return 'Milestone';
  }
  return 'Communication';
}

export function eventTypeLabel(eventType: CampaignScheduleEventType): string {
  return eventType
    .toLowerCase()
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export interface CalendarDay {
  key: string;
  date: Date;
  inMonth: boolean;
  items: CampaignScheduleItem[];
}

export interface CalendarWeek {
  id: string;
  days: CalendarDay[];
}

function formatDateOnly(value: Date): string {
  return value.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: Date): string {
  return value.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMonthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function formatDayKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate()
  ).padStart(2, '0')}`;
}

function sameDay(left: Date, right: Date): boolean {
  return formatDayKey(left) === formatDayKey(right);
}

function getItemDisplayDate(item: CampaignScheduleItem): Date {
  return item.startAt ? new Date(item.startAt) : new Date(0);
}
