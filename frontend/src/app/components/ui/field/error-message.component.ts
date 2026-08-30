import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { cn, uniqueId } from '../shared/utils';
import { SanringFieldComponent } from './field.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-error-message', // 正名為 error-message
  standalone: true,
  host: {
    '[class]': 'errorClass()',
    '[id]': 'id',
    // 讓螢幕閱讀器能自動朗讀錯誤訊息
    'aria-live': 'polite',
    // 根據 Field 狀態自動隱藏
    '[class.hidden]': '!shouldShow()',
    '[attr.aria-hidden]': 'shouldShow() ? null : "true"',
  },
  template: `<ng-content></ng-content>`,
})
export class ErrorMessageComponent {
  readonly class = input<string>('');

  readonly id = uniqueId('sanring-error-message');

  // 注入外層的 Field 容器（使用 optional: true 允許它在 Field 外獨立使用）
  private readonly field = inject(SanringFieldComponent, { optional: true });

  /**
   * 智慧顯示邏輯：
   * 1. 如果有被包裝在 <sanring-field> 內，就根據 Field 的 hasError 狀態決定是否顯示。
   * 2. 如果沒有被包裝，就預設顯示（讓開發者自己用 @if 控制）。
   */
  protected readonly shouldShow = computed(() => {
    return this.field ? this.field.hasError() : true;
  });

  constructor() {
    // 只有顯示中的錯誤訊息才該出現在 aria-describedby：隱藏元素被 aria-describedby 引用時，
    // 不同瀏覽器/AT 組合的朗讀行為並不一致，不能依賴 display:none 保證不會被讀到
    effect((onCleanup) => {
      if (!this.shouldShow()) return;
      this.field?.registerDescribedBy(this.id);
      onCleanup(() => this.field?.unregisterDescribedBy(this.id));
    });
  }

  protected readonly errorClass = computed(() =>
    cn(
      // shadcn 風格的錯誤文字樣式 (text-destructive)
      'text-[0.8rem] font-medium text-[var(--sanring-error-40)]',
      this.class(),
    ),
  );
}
