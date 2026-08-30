import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-select-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'presentation',
    '[class]': 'labelClass()',
  },
  template: `
    <span class="block truncate">
      <ng-content></ng-content>
    </span>
  `,
})
export class SelectLabelComponent {
  readonly class = input<string | undefined>();

  protected readonly labelClass = computed(() =>
    cn(
      'pointer-events-none block px-2 py-1 text-xs font-medium text-[var(--sanring-muted)]',
      this.class(),
    ),
  );
}
