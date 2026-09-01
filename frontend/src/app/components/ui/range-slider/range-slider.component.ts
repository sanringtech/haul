import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  input,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { cn } from '../shared/utils';
import { SELECTION_CONTROL_FOCUS_CLASS } from '../shared/component-styles';

/**
 * 單一軌道、兩個手柄的區間滑桿——取代原本「注意」「接近上限」各自一條獨立 sanring-slider、
 * 靠 allowedMin/allowedMax 互相夾住的做法。那種做法邏輯上沒錯，但畫面上是兩條分開的軌道，
 * 使用者看不出來兩者其實是同一條 0-100% 量表上的兩個斷點，也看不出「注意一定不能比接近上限
 * 高」這件事——這個元件把兩個手柄畫在同一條軌道上，順序關係天生不可能搞錯，一眼就懂。
 *
 * 不像 sanring-slider 走完整的 ControlValueAccessor/SanringCvaBase（這裡用不到 ngModel/
 * reactive forms，設定頁原本兩顆滑桿也只是走 [value]/(valueChange) 這種最簡單的雙向綁定），
 * 少了那層機器，元件本身簡單很多。
 */
@Component({
  selector: 'sanring-range-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
  },
  template: `
    <div #track class="relative h-2 w-full rounded-full overflow-hidden bg-[var(--sanring-border-strong)]">
      <!-- 三段底色：綠（0 ~ low）／黃（low ~ high）／橘（high ~ 軌道右端）。最右端另外疊一個固定
           紅點代表 100% 已用盡——那不是這個滑桿能拖到的範圍，只是視覺上告訴使用者「量表在這裡終止」。 -->
      <div class="absolute inset-y-0 left-0 bg-[var(--sanring-success-50)]" [style.width.%]="lowPercent()"></div>
      <div
        class="absolute inset-y-0 bg-[var(--sanring-warn-50)]"
        [style.left.%]="lowPercent()"
        [style.width.%]="highPercent() - lowPercent()"
      ></div>
      <div class="absolute inset-y-0 bg-[var(--sanring-caution-50)]" [style.left.%]="highPercent()" [style.right]="'0'"></div>
    </div>

    <span
      class="pointer-events-none absolute top-1/2 -translate-y-1/2 -right-0.5 size-3 rounded-full bg-[var(--sanring-error-50)] ring-2 ring-[var(--sanring-background)]"
      [attr.aria-hidden]="true"
    ></span>

    <span
      role="slider"
      [attr.tabindex]="disabled() ? -1 : 0"
      [class]="thumbClass()"
      [style.left.%]="lowPercent()"
      [attr.aria-label]="lowAriaLabel()"
      [attr.aria-valuemin]="allowedMinValue()"
      [attr.aria-valuemax]="high()"
      [attr.aria-valuenow]="low()"
      [attr.aria-disabled]="disabled() || null"
      (keydown)="onKeydown($event, 'low')"
      (pointerdown)="onPointerDown($event, 'low')"
      (pointermove)="onPointerMove($event, 'low')"
      (pointerup)="onPointerEnd($event)"
      (pointercancel)="onPointerEnd($event)"
    ></span>

    <span
      role="slider"
      [attr.tabindex]="disabled() ? -1 : 0"
      [class]="thumbClass()"
      [style.left.%]="highPercent()"
      [attr.aria-label]="highAriaLabel()"
      [attr.aria-valuemin]="low()"
      [attr.aria-valuemax]="allowedMaxValue()"
      [attr.aria-valuenow]="high()"
      [attr.aria-disabled]="disabled() || null"
      (keydown)="onKeydown($event, 'high')"
      (pointerdown)="onPointerDown($event, 'high')"
      (pointermove)="onPointerMove($event, 'high')"
      (pointerup)="onPointerEnd($event)"
      (pointercancel)="onPointerEnd($event)"
    ></span>
  `,
})
export class RangeSliderComponent {
  readonly class = input<string | undefined>();
  readonly min = input(0, { transform: numberAttribute });
  readonly max = input(100, { transform: numberAttribute });
  readonly step = input(1, { transform: numberAttribute });
  /** 兩個手柄實際可以拖到的範圍——視覺軌道仍然是 min~max 的完整長度（見上面 class 註解）。 */
  readonly allowedMin = input<number | undefined>(undefined);
  readonly allowedMax = input<number | undefined>(undefined);
  readonly low = input(0, { transform: numberAttribute });
  readonly high = input(100, { transform: numberAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly lowAriaLabel = input<string | undefined>();
  readonly highAriaLabel = input<string | undefined>();

  readonly lowChange = output<number>();
  readonly highChange = output<number>();

  private readonly trackRef = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly draggingThumb = signal<'low' | 'high' | null>(null);

  protected readonly minValue = computed(() => Math.min(this.min(), this.max()));
  protected readonly maxValue = computed(() => Math.max(this.min(), this.max()));
  protected readonly allowedMinValue = computed(() =>
    Math.min(this.maxValue(), Math.max(this.minValue(), this.allowedMin() ?? this.minValue())),
  );
  protected readonly allowedMaxValue = computed(() =>
    Math.max(this.allowedMinValue(), Math.min(this.maxValue(), this.allowedMax() ?? this.maxValue())),
  );

  protected readonly lowPercent = computed(() => this.toPercent(this.low()));
  protected readonly highPercent = computed(() => this.toPercent(this.high()));

  protected readonly hostClass = computed(() =>
    cn(
      'relative flex w-full touch-none select-none items-center py-2',
      this.disabled() ? 'cursor-not-allowed opacity-50' : '',
      this.class(),
    ),
  );

  // 拖曳中不要 transition-left（會跟指標位置打架、視覺上落後一拍），只有鍵盤/點擊這種離散跳動才要動畫。
  protected readonly thumbClass = computed(() =>
    cn(
      'absolute top-1/2 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--sanring-foreground)] bg-[var(--sanring-background)] shadow-sm',
      this.disabled() ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
      this.draggingThumb() ? '' : 'transition-[left]',
      SELECTION_CONTROL_FOCUS_CLASS,
    ),
  );

  onKeydown(event: KeyboardEvent, thumb: 'low' | 'high'): void {
    if (this.disabled()) return;

    const step = this.normalizedStep();
    const pageStep = step * 10;
    const current = thumb === 'low' ? this.low() : this.high();
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - step;
        break;
      case 'PageUp':
        next = current + pageStep;
        break;
      case 'PageDown':
        next = current - pageStep;
        break;
      case 'Home':
        next = thumb === 'low' ? this.allowedMinValue() : this.low();
        break;
      case 'End':
        next = thumb === 'low' ? this.high() : this.allowedMaxValue();
        break;
    }

    if (next === null) return;
    event.preventDefault();
    this.setValue(thumb, next);
  }

  onPointerDown(event: PointerEvent, thumb: 'low' | 'high'): void {
    if (this.disabled() || event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.focus();
    target.setPointerCapture(event.pointerId);
    this.draggingThumb.set(thumb);
    this.setValueFromPointer(thumb, event);
  }

  onPointerMove(event: PointerEvent, thumb: 'low' | 'high'): void {
    if (this.draggingThumb() !== thumb) return;
    this.setValueFromPointer(thumb, event);
  }

  onPointerEnd(event: PointerEvent): void {
    if (!this.draggingThumb()) return;
    this.draggingThumb.set(null);
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  private setValueFromPointer(thumb: 'low' | 'high', event: PointerEvent): void {
    const rect = this.trackRef().nativeElement.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const value = this.minValue() + ratio * (this.maxValue() - this.minValue());
    this.setValue(thumb, value);
  }

  private setValue(thumb: 'low' | 'high', value: number): void {
    const step = this.normalizedStep();
    const floor = thumb === 'low' ? this.allowedMinValue() : this.low();
    const ceiling = thumb === 'low' ? this.high() : this.allowedMaxValue();
    const clamped = Math.min(Math.max(value, floor), ceiling);
    const stepped = Math.round((clamped - this.minValue()) / step) * step + this.minValue();
    const next = Number(Math.min(Math.max(stepped, floor), ceiling).toFixed(5));

    if (thumb === 'low') {
      if (next === this.low()) return;
      this.lowChange.emit(next);
    } else {
      if (next === this.high()) return;
      this.highChange.emit(next);
    }
  }

  private toPercent(value: number): number {
    const range = this.maxValue() - this.minValue();
    if (range <= 0) return 0;
    return ((value - this.minValue()) / range) * 100;
  }

  private normalizedStep(): number {
    const step = this.step();
    return Number.isFinite(step) && step > 0 ? step : 1;
  }
}
