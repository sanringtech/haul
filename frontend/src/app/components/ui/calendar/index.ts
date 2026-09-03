export * from './calendar.component';
export * from './calendar-day.directive';
export * from './calendar-header.component';
export * from './calendar.type';

import { CalendarDayDirective } from './calendar-day.directive';
import { CalendarHeaderComponent } from './calendar-header.component';
import { CalendarComponent } from './calendar.component';

export const SANRING_CALENDAR_IMPORTS = [
  CalendarComponent,
  CalendarHeaderComponent,
  CalendarDayDirective,
];
