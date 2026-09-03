import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
} from '@angular/core';
import { _IdGenerator } from '@angular/cdk/a11y';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  CALENDAR_LOCALE,
  CalendarDay,
  CalendarEngine,
  CalendarGridDirective,
  CalendarLocale,
  DateRange,
  DisabledInput,
} from '@sanring/date-picker-core';
import { LucideChevronDown } from '@lucide/angular';
import { cn } from '../shared/utils';
import { SanringCvaBase, SanringFieldControlAdapter } from '../shared/cva-base';
import { FieldType, SANRING_FIELD_CONTROL } from '../field/field.type';
import { PopoverComponent } from '../popover/popover.component';
import { PopoverContentComponent } from '../popover/popover-content.component';
import { CalendarDayDirective } from './calendar-day.directive';
import { CalendarHeaderComponent } from './calendar-header.component';
import { CALENDAR_WEEKDAY_TEXT_CLASS } from './calendar.styles';
import { CalendarOrientation, CalendarSize, CalendarValue } from './calendar.type';

const JUMP_YEAR_RANGE_PAST = 100;
const JUMP_YEAR_RANGE_FUTURE = 50;

@Component({
  selector: 'sanring-calendar',
  standalone: true,
  exportAs: 'sanringCalendar',
  imports: [
    CalendarHeaderComponent,
    CalendarDayDirective,
    PopoverComponent,
    PopoverContentComponent,
    LucideChevronDown,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CalendarGridDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CalendarComponent),
      multi: true,
    },
    // Can't `useExisting: CalendarComponent` directly as SanringFieldControl: the interface's
    // `disabled`/`required`/`id` would collide with this component's own same-named @Inputs
    // (and this repo's eslint rules forbid renaming an @Input to dodge that) — so a small
    // adapter class translates between the two, same pattern as Checkbox/Combobox.
    {
      provide: SANRING_FIELD_CONTROL,
      useFactory: (host: CalendarComponent) => new SanringFieldControlAdapter(FieldType.calendar, host),
      deps: [forwardRef(() => CalendarComponent)],
    },
  ],
  host: {
    tabindex: '0',
    // role="group": a bare div (role="generic") doesn't support aria-invalid/
    // aria-describedby, so this still needs a real role — "group" is a plain,
    // unopinionated container that both attributes are valid on (verified
    // against axe-core's aria-allowed-attr rule). It deliberately does NOT
    // carry aria-required: axe-core rejects aria-required on "group" (and on
    // "grid", and on the previously-used "radiogroup", which is also invalid
    // here since this element's real children are role="grid"/"row", not
    // role="radio" — radiogroup requires owning radio elements directly, and
    // calendar supports range mode where multiple cells can be simultaneously
    // "in range", which radio's single-checked semantics can't represent
    // anyway). aria-required is instead applied per-cell in
    // calendar-day.directive.ts, on role="gridcell" — one of the few roles
    // that legitimately supports it.
    role: 'group',
    '[id]': 'id()',
    '[class]': 'calendarClass()',
    '[attr.aria-invalid]': "errorState ? 'true' : null",
    '[attr.aria-describedby]': 'computedAriaDescribedBy()',
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()',
  },
  template: `
    <div [class]="monthsWrapperClass()">
      @for (monthGrid of engine.monthGrids(); track $index) {
        <div class="min-w-60 flex-1">
          <sanring-popover>
            <sanring-calendar-header
              [label]="monthLabel(monthGrid)"
              [showPrev]="$first"
              [showNext]="$last"
              [labelClickable]="$first"
              [prevMonthLabel]="prevMonthLabel()"
              [nextMonthLabel]="nextMonthLabel()"
              (prev)="engine.prevMonth()"
              (next)="engine.nextMonth()"
            />
            @if ($first) {
              <sanring-popover-content
                class="flex items-center gap-3 rounded-[var(--sanring-radius-lg)] p-5"
              >
                <div class="relative flex-1">
                  <select
                    class="w-full appearance-none rounded-[var(--sanring-radius)] border border-[var(--sanring-border-strong)] bg-[var(--sanring-surface)] py-1.5 pl-3 pr-8 text-center text-sm text-[var(--sanring-foreground)]"
                    [attr.aria-label]="jumpMonthLabel()"
                    (change)="onJumpMonthChange($event, monthGrid)"
                  >
                    @for (opt of monthOptions(); track opt.value) {
                      <option [value]="opt.value" [selected]="opt.value === viewMonth(monthGrid)">
                        {{ opt.label }}
                      </option>
                    }
                  </select>
                  <svg
                    lucideChevronDown
                    [size]="14"
                    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sanring-muted)]"
                  ></svg>
                </div>
                <div class="relative flex-1">
                  <select
                    class="w-full appearance-none rounded-[var(--sanring-radius)] border border-[var(--sanring-border-strong)] bg-[var(--sanring-surface)] py-1.5 pl-3 pr-8 text-center text-sm text-[var(--sanring-foreground)]"
                    [attr.aria-label]="jumpYearLabel()"
                    (change)="onJumpYearChange($event, monthGrid)"
                  >
                    @for (y of yearOptions(); track y) {
                      <option [value]="y" [selected]="y === viewYear(monthGrid)">{{ y }}</option>
                    }
                  </select>
                  <svg
                    lucideChevronDown
                    [size]="14"
                    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sanring-muted)]"
                  ></svg>
                </div>
              </sanring-popover-content>
            }
          </sanring-popover>

          <div class="mb-1 grid grid-cols-7 gap-1 text-center" role="row" aria-hidden="true">
            @for (label of weekdayLabels(); track $index) {
              <span [class]="weekdayTextClass">{{ label }}</span>
            }
          </div>

          <div class="grid grid-cols-7 gap-1" role="grid" [attr.aria-label]="monthLabel(monthGrid)">
            @for (week of toWeeks(monthGrid); track $index) {
              <div role="row" class="contents">
                @for (day of week; track day.date.getTime()) {
                  <button
                    type="button"
                    role="gridcell"
                    sanringCalendarDay
                    [day]="day"
                    [size]="size()"
                  >
                    {{ day.date.getDate() }}
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CalendarComponent extends SanringCvaBase<CalendarValue> {
  protected readonly engine = inject(CalendarEngine);
  private readonly injectedLocale = inject(CALENDAR_LOCALE, { optional: true });
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly class = input<string | undefined>();
  readonly id = input(inject(_IdGenerator).getId('sanring-calendar-', true));
  readonly size = input<CalendarSize>('md');
  readonly locale = input<CalendarLocale | undefined>(undefined);
  readonly mode = input<'single' | 'range'>('single');
  readonly monthsToDisplay = input<number>(1);
  readonly orientation = input<CalendarOrientation>('horizontal');
  readonly disabled = input<DisabledInput | undefined>(undefined);
  readonly allowDeselect = input<boolean>(true);
  readonly required = input(false, { transform: booleanAttribute });
  readonly ariaDescribedBy = input<string | undefined>();
  readonly prevMonthLabel = input('上一月');
  readonly nextMonthLabel = input('下一月');
  readonly jumpMonthLabel = input('選擇月份');
  readonly jumpYearLabel = input('選擇年份');

  readonly selectedDateChange = output<Date | null>();
  readonly selectedRangeChange = output<DateRange>();

  protected readonly calendarClass = computed(() =>
    cn(
      'block outline-none focus-visible:ring-2 focus-visible:ring-[var(--sanring-border-strong)]',
      this.class(),
    ),
  );

  /** Purely presentational: engine.monthGrids() stays an ordered array, this only decides flex-direction. */
  protected readonly monthsWrapperClass = computed(() => {
    if (this.engine.monthGrids().length <= 1) return 'block';
    return this.orientation() === 'vertical' ? 'flex flex-col gap-6' : 'flex gap-6';
  });

  protected readonly weekdayTextClass = CALENDAR_WEEKDAY_TEXT_CLASS;

  private readonly resolvedLocale = computed(() => this.locale() ?? this.injectedLocale);

  protected readonly weekdayLabels = computed(() => {
    const locale = this.resolvedLocale();
    if (!locale) return [];
    return [
      ...locale.weekdayLabels.slice(locale.weekStartsOn),
      ...locale.weekdayLabels.slice(0, locale.weekStartsOn),
    ];
  });

  // 表單層級的「整個控制項停用」跟既有的 disabled（哪些日期不可選）是兩件事——停用時額外疊一個
  // 永遠回傳 true 的 matcher，讓所有日期都不可選，而不是動到使用者自己傳入的 disabled matcher。
  private readonly effectiveDisabled = computed<DisabledInput | undefined>(() =>
    this.disabledState() ? () => true : this.disabled(),
  );

  protected readonly computedAriaDescribedBy = this.makeComputedAriaDescribedBy(this.ariaDescribedBy);

  get fieldValue(): CalendarValue {
    return this.mode() === 'range' ? this.engine.selectedRange() : this.engine.selectedDate();
  }

  get fieldEmpty(): boolean {
    if (this.mode() === 'range') return this.engine.selectedRange().start === null;
    return this.engine.selectedDate() === null;
  }

  get fieldDisabled(): boolean {
    return this.disabledState();
  }

  protected override hasInputRequired(): boolean {
    return this.required();
  }

  constructor() {
    super();
    effect(() => {
      const locale = this.locale();
      if (locale) this.engine.setLocale(locale);
    });
    effect(() => this.engine.setSelectionMode(this.mode()));
    effect(() => this.engine.setMonthsToDisplay(this.monthsToDisplay()));
    effect(() => this.engine.setDisabled(this.effectiveDisabled()));
    effect(() => this.engine.setAllowDeselect(this.allowDeselect()));
    effect(() => {
      const date = this.engine.selectedDate();
      this.selectedDateChange.emit(date);
      if (this.mode() === 'single') {
        this.onChange(date);
        this.emitStateChanges();
      }
    });
    effect(() => {
      const range = this.engine.selectedRange();
      this.selectedRangeChange.emit(range);
      if (this.mode() === 'range') {
        this.onChange(range);
        this.emitStateChanges();
      }
    });
  }

  readonly isDraftActive = computed(() => this.engine.isDraftActive());

  clear(): void {
    this.engine.clearSelection();
  }

  abortRangeDraft(): void {
    this.engine.abortRangeDraft();
  }

  focus(options?: FocusOptions): void {
    this.elementRef.nativeElement.focus(options);
  }

  override writeValue(value: CalendarValue): void {
    if (this.mode() === 'range') {
      if (value && typeof value === 'object' && 'start' in value) {
        const range = value as DateRange;
        this.engine.setSelectedRange(range);
        if (range.start) this.engine.setViewDate(range.start);
      } else {
        this.engine.clearSelection();
      }
    } else if (value instanceof Date) {
      this.engine.setSelectedDate(value);
      this.engine.setViewDate(value);
    } else {
      this.engine.clearSelection();
    }
  }

  protected monthLabel(days: readonly CalendarDay[]): string {
    const locale = this.resolvedLocale();
    if (!locale) return '';
    const current = days[7];
    return `${current.date.getFullYear()} ${locale.monthLabels[current.date.getMonth()]}`;
  }

  protected readonly monthOptions = computed(() => {
    const locale = this.resolvedLocale();
    if (!locale) return [];
    return locale.monthLabels.map((label, value) => ({ value, label }));
  });

  protected readonly yearOptions = computed(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (
      let y = currentYear - JUMP_YEAR_RANGE_PAST;
      y <= currentYear + JUMP_YEAR_RANGE_FUTURE;
      y++
    ) {
      years.push(y);
    }
    return years;
  });

  protected viewMonth(days: readonly CalendarDay[]): number {
    return days[7].date.getMonth();
  }

  protected viewYear(days: readonly CalendarDay[]): number {
    return days[7].date.getFullYear();
  }

  protected onJumpMonthChange(event: Event, days: readonly CalendarDay[]): void {
    const month = Number((event.target as HTMLSelectElement).value);
    this.engine.setViewDate(new Date(this.viewYear(days), month, 1));
  }

  protected onJumpYearChange(event: Event, days: readonly CalendarDay[]): void {
    const year = Number((event.target as HTMLSelectElement).value);
    this.engine.setViewDate(new Date(year, this.viewMonth(days), 1));
  }

  protected toWeeks(grid: readonly CalendarDay[]): CalendarDay[][] {
    const rows: CalendarDay[][] = [];
    for (let i = 0; i < 42; i += 7) rows.push(grid.slice(i, i + 7) as CalendarDay[]);
    return rows;
  }
}
