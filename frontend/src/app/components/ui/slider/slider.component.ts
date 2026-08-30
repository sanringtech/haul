import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  numberAttribute,
  output,
  signal,
  untracked,
} from '@angular/core';
import { _IdGenerator } from '@angular/cdk/a11y';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../shared/utils';
import { SELECTION_CONTROL_FOCUS_CLASS } from '../shared/component-styles';
import { SanringCvaBase, SanringFieldControlAdapter } from '../shared/cva-base';
import { FieldType, SANRING_FIELD_CONTROL } from '../field/field.type';

@Component({
  selector: 'sanring-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SliderComponent),
      multi: true,
    },
    // 跟 checkbox 一樣：id/disabled/value 已經被同名 @Input 佔用，改用 useFactory 轉接。
    {
      provide: SANRING_FIELD_CONTROL,
      useFactory: (host: SliderComponent) => new SanringFieldControlAdapter(FieldType.slider, host),
      deps: [forwardRef(() => SliderComponent)],
    },
  ],
  host: {
    '[class]': 'hostClass()',
    '[attr.role]': '"slider"',
    '[attr.id]': 'id()',
    '[attr.aria-valuemin]': 'minValue()',
    '[attr.aria-valuemax]': 'maxValue()',
    '[attr.aria-valuenow]': 'valueSignal()',
    '[attr.aria-valuetext]': 'ariaValueText()',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-labelledby]': 'ariaLabelledBy()',
    '[attr.aria-describedby]': 'computedAriaDescribedBy()',
    '[attr.aria-invalid]': 'errorState ? "true" : null',
    '[attr.aria-required]': 'fieldRequired ? "true" : null',
    '[attr.aria-disabled]': 'isDisabled() || null',
    '[attr.aria-orientation]': '"horizontal"',
    '[attr.tabindex]': 'isDisabled() ? -1 : tabIndex()',
    '[attr.data-disabled]': 'isDisabled() || null',
    '(focus)': 'onFocus()',
    '(blur)': 'markTouched()',
    '(keydown)': 'onKeydown($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd($event)',
    '(pointercancel)': 'onPointerEnd($event)',
  },
  template: `
    <div
      class="relative h-2 w-full grow overflow-hidden rounded-full bg-[var(--sanring-border-strong)]"
    >
      <div
        class="absolute h-full bg-[var(--sanring-foreground)]"
        [style.width.%]="percentage()"
      ></div>
    </div>

    <span [class]="thumbClass()" [style.left.%]="percentage()"></span>
  `,
})
export class SliderComponent extends SanringCvaBase<number> {
  readonly class = input<string | undefined>();
  readonly id = input(inject(_IdGenerator).getId('sanring-slider-', true));
  readonly min = input(0, { transform: numberAttribute });
  readonly max = input(100, { transform: numberAttribute });
  readonly step = input(1, { transform: numberAttribute });
  readonly value = input(50, { transform: numberAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly tabIndex = input(0, { transform: numberAttribute });
  readonly ariaLabel = input<string | undefined>();
  readonly ariaLabelledBy = input<string | undefined>();
  readonly ariaDescribedBy = input<string | undefined>();
  readonly ariaValueText = input<string | undefined>();

  readonly valueChange = output<number>();

  protected readonly valueSignal = signal(50);
  protected readonly minValue = computed(() => Math.min(this.min(), this.max()));
  protected readonly maxValue = computed(() => Math.max(this.min(), this.max()));
  protected readonly isDisabled = computed(() => this.disabled() || this.disabledState());

  protected readonly percentage = computed(() => {
    const range = this.maxValue() - this.minValue();
    if (range <= 0) return 0;
    return ((this.valueSignal() - this.minValue()) / range) * 100;
  });

  protected readonly hostClass = computed(() =>
    cn(
      'relative flex w-full touch-none select-none items-center rounded-[var(--sanring-radius-xs)] py-2',
      SELECTION_CONTROL_FOCUS_CLASS,
      this.isDisabled() ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      this.class(),
    ),
  );

  // Dragging updates `left` on every pointermove — a CSS transition there fights the
  // pointer position and makes the thumb visibly lag behind the cursor (and the fill,
  // which has no transition). Only animate `left` for discrete changes (keyboard, click).
  protected readonly thumbClass = computed(() =>
    cn(
      'pointer-events-none absolute block size-5 -translate-x-1/2 rounded-full border-2 border-[var(--sanring-foreground)] bg-[var(--sanring-background)] shadow-sm',
      this.dragging() ? '' : 'transition-[left]',
    ),
  );

  protected readonly computedAriaDescribedBy = this.makeComputedAriaDescribedBy(this.ariaDescribedBy);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dragging = signal(false);

  get fieldValue(): number {
    return this.valueSignal();
  }

  // 滑桿一定有一個數值，不存在「空值」的狀態
  get fieldEmpty(): boolean {
    return false;
  }

  get fieldDisabled(): boolean {
    return this.isDisabled();
  }

  // slider has no required input; fieldRequired falls back to validator-only check in base class

  constructor() {
    super();
    effect(() => {
      const value = this.value();
      this.min();
      this.max();
      this.step();
      untracked(() => this.setValue(value, false));
    });
  }

  focus(options?: FocusOptions): void {
    this.host.nativeElement.focus(options);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) return;

    const step = this.normalizedStep();
    const pageStep = step * 10;
    let nextValue: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        nextValue = this.valueSignal() + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        nextValue = this.valueSignal() - step;
        break;
      case 'PageUp':
        nextValue = this.valueSignal() + pageStep;
        break;
      case 'PageDown':
        nextValue = this.valueSignal() - pageStep;
        break;
      case 'Home':
        nextValue = this.minValue();
        break;
      case 'End':
        nextValue = this.maxValue();
        break;
    }

    if (nextValue === null) return;
    event.preventDefault();
    this.setValue(nextValue, true);
  }

  onPointerDown(event: PointerEvent): void {
    if (this.isDisabled() || event.button !== 0) return;

    event.preventDefault();
    this.host.nativeElement.focus();
    this.host.nativeElement.setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.setValueFromPointer(event);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging() || this.isDisabled()) return;
    this.setValueFromPointer(event);
  }

  onPointerEnd(event: PointerEvent): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    if (this.host.nativeElement.hasPointerCapture(event.pointerId)) {
      this.host.nativeElement.releasePointerCapture(event.pointerId);
    }
    this.markTouched();
  }

  markTouched(): void {
    this.onTouched();
    this.focused = false;
    this.emitStateChanges();
  }

  override writeValue(value: number | null | undefined): void {
    this.setValue(value ?? this.minValue(), false);
  }

  private setValueFromPointer(event: PointerEvent): void {
    const rect = this.host.nativeElement.getBoundingClientRect();
    if (rect.width <= 0) return;

    const ratio = (event.clientX - rect.left) / rect.width;
    const value = this.minValue() + ratio * (this.maxValue() - this.minValue());
    this.setValue(value, true);
  }

  private setValue(value: number, emit: boolean): void {
    const nextValue = this.normalizeValue(value);
    if (this.valueSignal() === nextValue) return;

    this.valueSignal.set(nextValue);
    this.emitStateChanges();
    if (!emit) return;
    this.onChange(nextValue);
    this.valueChange.emit(nextValue);
  }

  private normalizeValue(value: number): number {
    const min = this.minValue();
    const max = this.maxValue();
    const step = this.normalizedStep();
    const clamped = Math.min(Math.max(value, min), max);
    const stepped = Math.round((clamped - min) / step) * step + min;
    return Number(Math.min(Math.max(stepped, min), max).toFixed(5));
  }

  private normalizedStep(): number {
    const step = this.step();
    return Number.isFinite(step) && step > 0 ? step : 1;
  }
}
