import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { CALENDAR_LOCALE, CalendarLocale } from '@sanring/date-picker-core';

/** Source: @sanring/date-picker-core CALENDAR_LOCALE — no built-in default; omitting this throws. */
const HAUL_CALENDAR_LOCALE: CalendarLocale = {
  weekStartsOn: 1,
  weekdayLabels: ['日', '一', '二', '三', '四', '五', '六'],
  monthLabels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: CALENDAR_LOCALE, useValue: HAUL_CALENDAR_LOCALE },
  ],
};
