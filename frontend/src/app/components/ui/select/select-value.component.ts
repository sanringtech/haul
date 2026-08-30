import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SelectComponent } from './select.component';
import { cn } from '../shared/utils';

@Component({
  selector: 'sanring-select-value',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'valueClass()',
    // 💡 確保樣式行為表現像一個純粹的 inline 文字
    class: 'pointer-events-none block truncate',
  },
  template: `
    <ng-content>
      @if (select.selectedValue() === null || select.selectedValue() === undefined) {
        <span class="text-[var(--sanring-muted)]">{{ placeholder() }}</span>
      } @else {
        <span>{{ select.selectedLabel() ?? select.selectedValue() }}</span>
      }
    </ng-content>
  `,
})
export class SelectValueComponent {
  // 🧠 注入大腦
  protected readonly select = inject(SelectComponent);

  // 接收未選擇時的提示文字
  readonly placeholder = input<string>('');

  // 允許外部傳入自訂 class
  readonly class = input<string | undefined>();

  protected readonly valueClass = computed(() => cn(this.class()));
}
