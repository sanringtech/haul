import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-select-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group', // 💡 W3C 標準：宣告這是一個選項群組
    '[class]': 'groupClass()',
  },
  template: `<ng-content></ng-content>`, // 💡 供 SelectLabel 和 SelectItem 投影
})
export class SelectGroupComponent {
  readonly class = input<string | undefined>();

  protected readonly groupClass = computed(() => cn('py-1', this.class()));
}
