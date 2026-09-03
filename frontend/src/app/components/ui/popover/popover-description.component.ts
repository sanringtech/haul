import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { cn } from '../shared/utils';
import { DESCRIPTION_TEXT_CLASS } from '../shared/component-styles';
import { PopoverComponent } from './popover.component';

@Component({
  selector: 'sanring-popover-description',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[id]': 'popover?.descId',
  },
  template: `<ng-content></ng-content>`,
})
export class PopoverDescriptionComponent {
  protected readonly popover = inject(PopoverComponent, { optional: true });
  readonly class = input<string | undefined>();
  protected readonly hostClass = computed(() =>
    cn(DESCRIPTION_TEXT_CLASS, this.class()),
  );
}
