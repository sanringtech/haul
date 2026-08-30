import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { cn } from '../shared/utils';
import { ProgressDirective } from './progress.directive';
import type { ProgressShape } from './progress.types';

@Component({
  selector: 'sanring-progress',
  standalone: true,
  imports: [ProgressDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      sanringProgress
      [value]="value()"
      [max]="max()"
      [ariaLabel]="ariaLabel()"
      [ariaValueText]="ariaValueText()"
      #bar="progress"
      [class]="containerClass()"
    >
      <div [class]="resolvedBarClass()" [style.width.%]="bar.percentage()">
        @if (shimmer()) {
          <!--
            掃光帶設計：
            - w-1/3 讓帶子只佔 bar 的 1/3，配合 keyframe 的 -300%→400% 可乾淨進出
            - linear 讓速度恆定，視覺上才有「衝刺」感
            - 顏色走 --sanring-progress-shimmer CSS 變數：深色主題用半透明黑、淺色主題用半透明白
              → 無論 bar 是白是黑，都保有對比度
          -->
          <div
            class="absolute inset-y-0 left-0 w-1/3 animate-[progress-shimmer_1.2s_linear_infinite]"
            style="background: linear-gradient(to right, transparent, var(--sanring-progress-shimmer, rgba(255,255,255,0.4)), transparent)"
          ></div>
        }
      </div>
    </div>
  `,
})
export class ProgressComponent {
  readonly class = input<string | undefined>();
  readonly barClass = input<string | undefined>();
  readonly value = input<number>(0);
  readonly max = input<number>(100);
  readonly shape = input<ProgressShape>('rounded');
  readonly shimmer = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | undefined>();
  readonly ariaValueText = input<string | undefined>();

  private readonly shapeClasses: Record<ProgressShape, string> = {
    rounded: 'h-2 rounded-full',
    square: 'h-2 rounded-none',
    trapezoid: 'h-3 [transform:skewX(-12deg)]',
  };

  protected readonly containerClass = computed(() =>
    cn(
      'relative w-full overflow-hidden bg-[var(--sanring-progress-track)]',
      this.shapeClasses[this.shape()],
      this.class(),
    ),
  );

  protected readonly resolvedBarClass = computed(() =>
    cn(
      'h-full transition-[width] duration-500 ease-out relative overflow-hidden',
      'bg-[var(--sanring-progress-bar)]',
      this.barClass(),
    ),
  );
}
