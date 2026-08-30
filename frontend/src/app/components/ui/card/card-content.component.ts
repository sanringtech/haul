import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-card-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'cardContentClass()',
  },
})
export class CardContentComponent {
  readonly class = input<string | undefined>();

  protected readonly cardContentClass = computed(() =>
    cn('block p-6 pt-0', this.class()),
  );
}
