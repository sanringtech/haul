import { Directive, HostListener, computed, inject, input } from '@angular/core';
import { GranularityCell, GranularityPickerEngine } from '@sanring/date-picker-core';
import { cn } from '../shared/utils';
import { DatePickerComponent } from './date-picker.component';
import { GRANULARITY_CELL_SIZE_CLASSES } from './date-picker.styles';
import { DatePickerSize } from './date-picker.type';

@Directive({
  selector: 'button[sanringDatePickerCell]',
  standalone: true,
  host: {
    '[disabled]': 'isDisabled()',
    '[attr.aria-selected]': "cell().isSelected ? 'true' : null",
    '[attr.aria-disabled]': "isDisabled() ? 'true' : null",
    // role="gridcell" is one of the few roles aria-required is actually valid
    // on — see the host block comment in date-picker.component.ts for why
    // this moved here instead of living on the group host.
    '[attr.aria-required]': 'datePicker.fieldRequired ? "true" : null',
    '[attr.aria-label]': 'label()',
    '[class]': 'cellClass()',
  },
})
export class DatePickerCellDirective {
  private readonly engine = inject(GranularityPickerEngine);
  protected readonly datePicker = inject(DatePickerComponent);

  readonly cell = input.required<GranularityCell>();
  readonly label = input.required<string>();
  readonly size = input<DatePickerSize>('md');
  readonly class = input<string | undefined>();

  protected readonly isDisabled = computed(
    () => this.datePicker.isDisabled() || this.cell().isDisabled,
  );

  protected readonly cellClass = computed(() => {
    const cell = this.cell();
    const isDisabled = this.isDisabled();
    return cn(
      'inline-flex items-center justify-center rounded-[var(--sanring-radius-sm)] transition-colors',
      'disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through',
      GRANULARITY_CELL_SIZE_CLASSES[this.size()],
      !cell.isSelected && !cell.isInRange && 'text-[var(--sanring-foreground)]',
      cell.isSelected && 'bg-[var(--sanring-primary)] text-[var(--sanring-primary-fg)]',
      cell.isInRange &&
        !cell.isSelected &&
        'bg-[color-mix(in_srgb,var(--sanring-primary)_20%,transparent)]',
      cell.isFocused && 'ring-2 ring-[var(--sanring-primary)]',
      cell.isCurrentPeriod && !cell.isSelected && 'font-bold',
      !cell.isSelected &&
        !isDisabled &&
        !cell.isInRange &&
        'hover:bg-[var(--sanring-surface-strong)]',
      (cell.isSelected || cell.isInRange) && !isDisabled && 'hover:brightness-95',
      !isDisabled && 'active:brightness-90',
      this.class(),
    );
  });

  @HostListener('click')
  protected onClick(): void {
    if (this.isDisabled()) return;
    this.engine.selectDate(this.cell().date);
  }
}
