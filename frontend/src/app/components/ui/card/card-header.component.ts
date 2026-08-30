import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-card-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'cardHeaderClass()',
  },
})
export class CardHeaderComponent {
  readonly class = input<string | undefined>();

  protected readonly cardHeaderClass = computed(() =>
    cn('flex flex-col space-y-1.5 p-6', this.class()),
  );
}
