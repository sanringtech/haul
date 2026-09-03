import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { ButtonDirective } from '../button/button.directive';
import { PopoverTriggerDirective } from '../popover/popover-trigger.directive';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-calendar-header',
  standalone: true,
  imports: [ButtonDirective, LucideChevronLeft, LucideChevronRight, PopoverTriggerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'headerClass()',
  },
  template: `
    @if (showPrev()) {
      <button
        sanringBtn
        variant="ghost"
        size="icon"
        type="button"
        class="active:brightness-90"
        [attr.aria-label]="prevMonthLabel()"
        (click)="prev.emit()"
      >
        <svg lucideChevronLeft [size]="18"></svg>
      </button>
    } @else {
      <span class="size-9"></span>
    }

    @if (labelClickable()) {
      <button
        type="button"
        sanringPopoverTrigger
        class="rounded-[var(--sanring-radius)] px-2 py-1 font-semibold text-[var(--sanring-foreground)] transition-colors hover:bg-[var(--sanring-surface-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sanring-border-strong)]"
      >
        {{ label() }}
      </button>
    } @else {
      <span class="font-semibold text-[var(--sanring-foreground)]">{{ label() }}</span>
    }

    @if (showNext()) {
      <button
        sanringBtn
        variant="ghost"
        size="icon"
        type="button"
        class="active:brightness-90"
        [attr.aria-label]="nextMonthLabel()"
        (click)="next.emit()"
      >
        <svg lucideChevronRight [size]="18"></svg>
      </button>
    } @else {
      <span class="size-9"></span>
    }
  `,
})
export class CalendarHeaderComponent {
  readonly label = input.required<string>();
  readonly showPrev = input(true);
  readonly showNext = input(true);
  readonly labelClickable = input(false);
  readonly prevMonthLabel = input('上一月');
  readonly nextMonthLabel = input('下一月');
  readonly class = input<string | undefined>();

  readonly prev = output<void>();
  readonly next = output<void>();

  protected readonly headerClass = computed(() =>
    cn('mb-4 flex items-center justify-between', this.class()),
  );
}
