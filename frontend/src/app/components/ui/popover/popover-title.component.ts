import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { cn } from '../shared/utils';
import { COMPACT_TITLE_TEXT_CLASS } from './popover.styles';
import { PopoverComponent } from './popover.component';

@Component({
  selector: 'sanring-popover-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[id]': 'popover?.titleId',
  },
  template: `<ng-content></ng-content>`,
})
export class PopoverTitleComponent {
  protected readonly popover = inject(PopoverComponent, { optional: true });
  readonly class = input<string | undefined>();
  protected readonly hostClass = computed(() =>
    cn(COMPACT_TITLE_TEXT_CLASS, this.class()),
  );
}
