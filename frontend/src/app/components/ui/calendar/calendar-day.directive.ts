import { Directive, HostListener, computed, inject, input } from '@angular/core';
import { CalendarDay, CalendarEngine } from '@sanring/date-picker-core';
import { cn } from '../shared/utils';
import { CalendarComponent } from './calendar.component';
import { CALENDAR_DAY_SIZE_CLASSES } from './calendar.styles';
import { CalendarSize } from './calendar.type';

@Directive({
  selector: 'button[sanringCalendarDay]',
  standalone: true,
  host: {
    '[disabled]': 'day().isDisabled',
    '[attr.aria-selected]': "day().isSelected ? 'true' : null",
    '[attr.aria-disabled]': "day().isDisabled ? 'true' : null",
    // role="gridcell" is one of the few roles aria-required is actually valid
    // on — see the host block comment in calendar.component.ts for why this
    // moved here instead of living on the group host.
    '[attr.aria-required]': 'calendar.fieldRequired ? "true" : null',
    '[attr.aria-label]': 'ariaLabel()',
    '[class]': 'dayClass()',
  },
})
export class CalendarDayDirective {
  private readonly engine = inject(CalendarEngine);
  protected readonly calendar = inject(CalendarComponent);

  readonly day = input.required<CalendarDay>();
  readonly size = input<CalendarSize>('md');
  readonly class = input<string | undefined>();

  protected readonly ariaLabel = computed(() => {
    const { date } = this.day();
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  });

  protected readonly dayClass = computed(() => {
    const day = this.day();
    return cn(
      'aspect-square inline-flex items-center justify-center rounded-[var(--sanring-radius-sm)] transition-colors',
      'disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through',
      CALENDAR_DAY_SIZE_CLASSES[this.size()],
      !day.isCurrentMonth && !day.isSelected && !day.isInRange && 'text-[var(--sanring-muted)]',
      day.isCurrentMonth && !day.isSelected && 'text-[var(--sanring-foreground)]',
      day.isSelected && 'bg-[var(--sanring-primary)] text-[var(--sanring-primary-fg)]',
      day.isInRange &&
        !day.isSelected &&
        'bg-[color-mix(in_srgb,var(--sanring-primary)_20%,transparent)]',
      day.isFocused && 'ring-2 ring-[var(--sanring-primary)]',
      day.isToday && !day.isSelected && 'font-bold',
      !day.isSelected &&
        !day.isDisabled &&
        !day.isInRange &&
        'hover:bg-[var(--sanring-surface-strong)]',
      (day.isSelected || day.isInRange) && !day.isDisabled && 'hover:brightness-95',
      !day.isDisabled && 'active:brightness-90',
      this.class(),
    );
  });

  @HostListener('click')
  protected onClick(): void {
    this.engine.selectDate(this.day().date);
  }
}
