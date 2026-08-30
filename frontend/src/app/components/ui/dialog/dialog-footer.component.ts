import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-dialog-footer',
  standalone: true,
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'dialogFooterClass()',
  },
})
export class DialogFooterComponent {
  readonly class = input<string | undefined>();

  protected readonly dialogFooterClass = computed(() =>
    cn(
      // 💡 Shadcn 的經典設計：
      // 手機版：按鈕垂直排列，且用 flex-col-reverse 讓「取消」掉到最下面
      // 桌機版 (sm:)：按鈕水平排列、靠右對齊 (justify-end)、按鈕之間留空隙 (space-x-2)
      'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2',
      this.class(),
    ),
  );
}
