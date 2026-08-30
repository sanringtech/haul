import { Directive, DestroyRef, computed, inject, input } from '@angular/core';
import { cn, uniqueId } from '../shared/utils';
import { SanringFieldComponent } from './field.component';

@Directive({
  // 將 Selector 改短，開發體驗更好
  selector: '[sanringDescription]',
  standalone: true,
  host: {
    '[class]': 'descriptionClass()',
    '[id]': 'id', // 自動綁上唯一的 ID，為未來的無障礙設計 (a11y) 準備
  },
})
export class DescriptionDirective {
  readonly class = input<string>('');

  // 每個 description 都會自動獲得一個獨一無二的 ID
  readonly id = uniqueId('sanring-description');

  // 注入外層的 Field 容器（使用 optional: true 允許它在 Field 外獨立使用）
  private readonly field = inject(SanringFieldComponent, { optional: true });

  // 預設加上 shadcn 風格的次要文字樣式 (muted)
  protected readonly descriptionClass = computed(() =>
    cn('text-[0.8rem] text-[var(--sanring-muted)]', this.class()),
  );

  constructor() {
    // 把自己的 id 註冊給 Field，讓 Field 可以組合成 control 的 aria-describedby
    this.field?.registerDescribedBy(this.id);
    inject(DestroyRef).onDestroy(() => this.field?.unregisterDescribedBy(this.id));
  }
}
