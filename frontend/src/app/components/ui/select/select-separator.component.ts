import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-select-separator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'separator',
    'aria-hidden': 'true',
    'aria-orientation': 'horizontal',
    '[class]': 'separatorClass()',
  },
  template: ``,
})
export class SelectSeparatorComponent {
  readonly class = input<string | undefined>();

  protected readonly separatorClass = computed(() =>
    cn('block -mx-1.5 my-1.5 h-px bg-[var(--sanring-border)]', this.class()),
  );
}
