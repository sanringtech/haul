import type { CalendarSize } from './calendar.type';

export const CALENDAR_DAY_SIZE_CLASSES: Record<CalendarSize, string> = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-11 text-base',
};
export const CALENDAR_WEEKDAY_TEXT_CLASS = 'text-xs font-medium text-[var(--sanring-muted)]';
