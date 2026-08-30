import { Directive, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Directive({
  // 拿掉標籤限制，讓 div, span, 甚至 p 都可以套用
  selector: '[sanringSkeleton]',
  standalone: true,
  host: {
    'aria-hidden': 'true',
    '[class]': 'skeletonClass()',
  },
})
export class SkeletonDirective {
  readonly class = input<string | undefined>();

  protected readonly skeletonClass = computed(() =>
    cn(
      'animate-pulse rounded-[var(--sanring-radius-sm)] bg-[var(--sanring-surface-strong)]',
      this.class(), // 讓使用者可以覆蓋寬高和形狀
    ),
  );
}
