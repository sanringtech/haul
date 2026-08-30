import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'cardClass()',
  },
})
export class CardComponent {
  readonly class = input<string | undefined>();

  protected readonly cardClass = computed(() =>
    cn(
      'block rounded-[var(--sanring-radius-lg)] border border-[var(--sanring-border)] bg-[var(--sanring-surface)] text-[var(--sanring-foreground)] shadow-sm',
      this.class(),
    ),
  );
}
