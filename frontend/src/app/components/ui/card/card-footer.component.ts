import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-card-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'cardFooterClass()',
  },
})
export class CardFooterComponent {
  readonly class = input<string | undefined>();

  protected readonly cardFooterClass = computed(() =>
    cn('flex items-center p-6 pt-0', this.class()),
  );
}
