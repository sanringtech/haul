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
  CALENDAR_QUARTER_STARTS_ON,
  CalendarLocale,
  DateRange,
  DisabledInput,
  GranularityCell,
  GranularityGridDirective,
  GranularityPickerEngine,
  PickerGranularity,
  QuarterStartMonth,
  RangePeriodCountLimit,
} from '@sanring/date-picker-core';
import { CalendarHeaderComponent } from '../calendar/calendar-header.component';
import { cn } from '../shared/utils';
import { SanringCvaBase, SanringFieldControlAdapter } from '../shared/cva-base';
import { FieldType, SANRING_FIELD_CONTROL } from '../field/field.type';
import { DatePickerCellDirective } from './date-picker-cell.directive';
import { DatePickerSize, DatePickerValue } from './date-picker.type';

const DEFAULT_GRID_COLUMNS: Record<PickerGranularity, number> = {
  month: 3,
  quarter: 4,
  year: 3,
};

type DatePickerDisabled = DisabledInput | boolean | undefined;
type DatePickerDisabledBinding = DatePickerDisabled | string;

function transformDatePickerDisabled(value: DatePickerDisabledBinding): DatePickerDisabled {
  return typeof value === 'string' ? booleanAttribute(value) : value;
}

function quarterIndexOf(date: Date, quarterStartMonth: QuarterStartMonth): number {
  return Math.floor(((date.getMonth() - quarterStartMonth + 12) % 12) / 3);
}

@Component({
  selector: 'sanring-date-picker',
  standalone: true,
  exportAs: 'sanringDatePicker',
  imports: [CalendarHeaderComponent, DatePickerCellDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [GranularityGridDirective],
  providers: [
    GranularityPickerEngine,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
    {
      provide: SANRING_FIELD_CONTROL,
      useFactory: (host: DatePickerComponent) =>
        new SanringFieldControlAdapter(FieldType.datePicker, host),
      deps: [forwardRef(() => DatePickerComponent)],
    },
  ],
  host: {
    '[attr.tabindex]': 'isDisabled() ? "-1" : "0"',
    // role="group": a bare div (role="generic") doesn't support aria-invalid/
    // aria-describedby, so this still needs a real role — "group" is a plain,
    // unopinionated container that both attributes are valid on (verified
    // against axe-core's aria-allowed-attr rule). It deliberately does NOT
    // carry aria-required: axe-core rejects aria-required on "group" (and on
    // "grid", and on the previously-used "radiogroup", which is also invalid
    // here since this element's real children are role="grid"/"row", not
    // role="radio" — radiogroup requires owning radio elements directly, and
    // this picker supports range/multi modes where several cells can be
    // simultaneously selected, which radio's single-checked semantics can't
    // represent anyway). aria-required is instead applied per-cell in
    // date-picker-cell.directive.ts, on role="gridcell" — one of the few
    // roles that legitimately supports it.
    role: 'group',
    '[id]': 'id()',
    '[class]': 'datePickerClass()',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-labelledby]': 'ariaLabelledBy()',
    '[attr.aria-disabled]': 'isDisabled() ? "true" : null',
    '[attr.aria-invalid]': "errorState ? 'true' : null",
    '[attr.aria-describedby]': 'computedAriaDescribedBy()',
    '[attr.inert]': 'isDisabled() ? "" : null',
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()',
  },
  template: `
    <sanring-calendar-header
      [label]="headerLabel()"
      [prevMonthLabel]="prevYearLabel()"
      [nextMonthLabel]="nextYearLabel()"
      (prev)="navigateYear(-1)"
      (next)="navigateYear(1)"
    />

    <div
      class="grid gap-1"
      role="grid"
      [style.grid-template-columns]="'repeat(' + resolvedGridColumns() + ', minmax(0, 1fr))'"
      [attr.aria-label]="headerLabel()"
    >
      @for (row of gridRows(); track $index) {
        <!-- display:contents keeps this row grouping invisible to CSS Grid layout
             (cells still line up in the parent's grid tracks) while satisfying
             the ARIA grid pattern's requirement that gridcells sit inside a row. -->
        <div role="row" class="contents">
          @for (cell of row; track cell.date.getTime()) {
            <button
              type="button"
              role="gridcell"
              sanringDatePickerCell
              [cell]="cell"
              [size]="size()"
              [label]="cellLabel(cell)"
            >
              {{ cellLabel(cell) }}
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class DatePickerComponent extends SanringCvaBase<DatePickerValue> {
  protected readonly engine = inject(GranularityPickerEngine);
  private readonly injectedLocale = inject(CALENDAR_LOCALE, { optional: true });
  private readonly injectedQuarterStartsOn = inject(CALENDAR_QUARTER_STARTS_ON, { optional: true });
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly class = input<string | undefined>();
  readonly id = input(inject(_IdGenerator).getId('sanring-date-picker-', true));
  readonly size = input<DatePickerSize>('md');
  readonly locale = input<CalendarLocale | undefined>(undefined);
  readonly granularity = input<PickerGranularity>('month');
  readonly mode = input<'single' | 'range' | 'multi'>('single');
  readonly quarterLabels = input<readonly [string, string, string, string]>([
    'Q1',
    'Q2',
    'Q3',
    'Q4',
  ]);
  readonly yearsToDisplay = input<number>(12);
  readonly gridColumns = input<number | undefined>(undefined);
  /** A matcher disables individual periods; a boolean disables the entire control. */
  readonly disabled = input<DatePickerDisabled, DatePickerDisabledBinding>(undefined, {
    transform: transformDatePickerDisabled,
  });
  readonly allowDeselect = input<boolean>(true);
  readonly required = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | undefined>();
  readonly ariaLabelledBy = input<string | undefined>();
  readonly ariaDescribedBy = input<string | undefined>();
  readonly rangePeriodCountLimit = input<RangePeriodCountLimit | undefined>(undefined);
  readonly prevYearLabel = input('上一年');
  readonly nextYearLabel = input('下一年');

  readonly selectedDateChange = output<Date | null>();
  readonly selectedRangeChange = output<DateRange>();
  readonly selectedDatesChange = output<Date[]>();

  protected readonly datePickerClass = computed(() =>
    cn(
      'block outline-none focus-visible:ring-2 focus-visible:ring-[var(--sanring-border-strong)]',
      this.isDisabled() && 'cursor-not-allowed opacity-50',
      this.class(),
    ),
  );

  private readonly resolvedLocale = computed(() => this.locale() ?? this.injectedLocale);
  private readonly resolvedQuarterStartsOn = computed(
    () => this.injectedQuarterStartsOn ?? (0 as QuarterStartMonth),
  );

  protected readonly resolvedGridColumns = computed(
    () => this.gridColumns() ?? DEFAULT_GRID_COLUMNS[this.granularity()],
  );

  // Chunked into ARIA "row" groups (see template) — engine.granularityGrids()
  // itself is a flat cell list, since the CSS grid layout doesn't need rows.
  protected readonly gridRows = computed(() => {
    const cells = this.engine.granularityGrids();
    const columns = this.resolvedGridColumns();
    const rows: GranularityCell[][] = [];
    for (let i = 0; i < cells.length; i += columns) {
      rows.push(cells.slice(i, i + columns));
    }
    return rows;
  });

  readonly isDisabled = computed(() => this.disabledState() || this.disabled() === true);

  // Keep the established per-period matcher API compatible while also accepting the natural
  // `[disabled]="true"` whole-control form. A boolean is consumed at the control layer; matcher
  // values continue to flow to date-picker-core unchanged. Whole-control disabled deliberately
  // does not become an "all dates" matcher: date-picker-core removes selections that newly
  // violate a matcher, whereas disabling a form control must preserve its value.
  private readonly effectiveDisabled = computed<DisabledInput | undefined>(() => {
    const disabled = this.disabled();
    return typeof disabled === 'boolean' ? undefined : disabled;
  });

  protected readonly computedAriaDescribedBy = this.makeComputedAriaDescribedBy(
    this.ariaDescribedBy,
  );

  get fieldValue(): DatePickerValue {
    switch (this.mode()) {
      case 'range':
        return this.engine.selectedRange();
      case 'multi':
        return this.engine.selectedDates();
      default:
        return this.engine.selectedDate();
    }
  }

  get fieldEmpty(): boolean {
    switch (this.mode()) {
      case 'range':
        return this.engine.selectedRange().start === null;
      case 'multi':
        return this.engine.selectedDates().length === 0;
      default:
        return this.engine.selectedDate() === null;
    }
  }

  get fieldDisabled(): boolean {
    return this.isDisabled();
  }

  protected override hasInputRequired(): boolean {
    return this.required();
  }

  constructor() {
    super();
    effect(() => this.engine.setSelectionGranularity(this.granularity()));
    effect(() => this.engine.setSelectionMode(this.mode()));
    effect(() => this.engine.setYearsToDisplay(this.yearsToDisplay()));
    effect(() => this.engine.setGridColumns(this.resolvedGridColumns()));
    effect(() => this.engine.setDisabled(this.effectiveDisabled()));
    effect(() => this.engine.setAllowDeselect(this.allowDeselect()));
    effect(() => this.engine.setRangePeriodCountLimit(this.rangePeriodCountLimit()));
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
    effect(() => {
      const dates = this.engine.selectedDates();
      this.selectedDatesChange.emit(dates);
      if (this.mode() === 'multi') {
        this.onChange(dates);
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

  removeDate(date: Date): void {
    this.engine.removeDate(date);
  }

  focus(options?: FocusOptions): void {
    this.elementRef.nativeElement.focus(options);
  }

  override writeValue(value: DatePickerValue): void {
    switch (this.mode()) {
      case 'range':
        if (value && typeof value === 'object' && 'start' in value) {
          this.engine.setSelectedRange(value as DateRange);
        } else {
          this.engine.clearSelection();
        }
        break;
      case 'multi':
        this.engine.setSelectedDates(Array.isArray(value) ? value : []);
        break;
      default:
        if (value instanceof Date) this.engine.setSelectedDate(value);
        else this.engine.clearSelection();
    }
  }

  protected headerLabel(): string {
    const grid = this.engine.granularityGrids();
    if (grid.length === 0) return '';
    if (this.granularity() === 'year') {
      return `${grid[0].date.getFullYear()}–${grid[grid.length - 1].date.getFullYear()}`;
    }
    return `${grid[0].date.getFullYear()}`;
  }

  protected cellLabel(cell: GranularityCell): string {
    switch (this.granularity()) {
      case 'month': {
        const locale = this.resolvedLocale();
        return locale ? locale.monthLabels[cell.date.getMonth()] : `${cell.date.getMonth() + 1}`;
      }
      case 'quarter': {
        const index = quarterIndexOf(cell.date, this.resolvedQuarterStartsOn());
        return this.quarterLabels()[index];
      }
      case 'year':
        return `${cell.date.getFullYear()}`;
    }
  }

  protected navigateYear(delta: -1 | 1): void {
    if (this.isDisabled()) return;
    if (delta === -1) this.engine.prevYear();
    else this.engine.nextYear();
  }
}
