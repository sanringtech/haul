import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideLoader, LucideLoaderCircle, LucideLoaderPinwheel } from '@lucide/angular';
import { cn } from '../shared/utils';
import { SpinnerSize, SpinnerSpeed, SpinnerVariant } from './spinner.type';

const SIZES: Record<SpinnerSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
  xl: 'size-8',
};

// 直接組合完整 animation 值，複用 Tailwind 內建 @keyframes spin，
// 避免靠 cascade 覆蓋 animation-duration，確保跨 Tailwind 版本穩定。
const SPEEDS: Record<SpinnerSpeed, string> = {
  slow:   'animate-[spin_2s_linear_infinite]',
  normal: 'animate-spin',
  fast:   'animate-[spin_0.5s_linear_infinite]',
};

@Component({
  selector: 'sanring-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideLoader, LucideLoaderCircle, LucideLoaderPinwheel],
  host: {
    role: 'status',
    '[attr.aria-label]': 'ariaLabel()',
    '[class]': 'hostClass()',
  },
  template: `
    @switch (variant()) {
      @case ('loader-circle') {
        <svg lucideLoaderCircle [class]="iconClass()"></svg>
      }
      @case ('pinwheel') {
        <svg lucideLoaderPinwheel [class]="iconClass()"></svg>
      }
      @default {
        <svg lucideLoader [class]="iconClass()"></svg>
      }
    }
  `,
})
export class SpinnerComponent {
  readonly class = input<string | undefined>();
  readonly variant = input<SpinnerVariant>('loader');
  readonly size = input<SpinnerSize>('md');
  readonly speed = input<SpinnerSpeed>('normal');
  readonly ariaLabel = input<string>('Loading');

  protected readonly iconClass = computed(() =>
    cn('text-current', SPEEDS[this.speed()], SIZES[this.size()]),
  );

  protected readonly hostClass = computed(() =>
    cn('inline-flex items-center justify-center', this.class()),
  );
}
