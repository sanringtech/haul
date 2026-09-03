import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-popover-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClass()' },
  template: `<ng-content></ng-content>`,
})
export class PopoverHeaderComponent {
  readonly class = input<string | undefined>();
  protected readonly hostClass = computed(() =>
    cn('flex flex-col gap-1 pb-2', this.class()),
  );
}
