import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-dialog-header',
  standalone: true,
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'dialogHeaderClass()',
  },
})
export class DialogHeaderComponent {
  readonly class = input<string | undefined>();

  protected readonly dialogHeaderClass = computed(() =>
    cn(
      // 垂直排列、預設置中 (手機版常見)、桌機版靠左對齊
      'flex flex-col space-y-1.5 text-center sm:text-left',
      this.class(),
    ),
  );
}
