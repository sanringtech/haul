import {
  ChangeDetectionStrategy,
  booleanAttribute,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { _IdGenerator } from '@angular/cdk/a11y';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../shared/utils';
import { SELECTION_CONTROL_FOCUS_CLASS } from '../shared/component-styles';
import { SanringCvaBase, SanringFieldControlAdapter } from '../shared/cva-base';
import { FieldType, SANRING_FIELD_CONTROL } from '../field/field.type';
import {
  SWITCH_THUMB_SIZE_CLASSES,
  SWITCH_THUMB_TRANSLATE_CLASSES,
  SWITCH_TRACK_SIZE_CLASSES,
} from './switch.styles';
import { SwitchSize } from './switch.type';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-switch',
  standalone: true,
  // host 設 inline-flex，讓內部 <button> 變成 flex item（被 blockify），
  // 不再以 inline-level box 參與行框排版，避免 baseline 留白造成 track 下緣多出空間。
  host: { class: 'inline-flex' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SwitchComponent),
      multi: true,
    },
    // 跟 checkbox 一樣：id/disabled 已經被同名 @Input 佔用，改用 useFactory 轉接。
    {
      provide: SANRING_FIELD_CONTROL,
      useFactory: (host: SwitchComponent) => new SanringFieldControlAdapter(FieldType.switch, host),
      deps: [forwardRef(() => SwitchComponent)],
    },
  ],
  template: `
    <button
      #btn
      type="button"
      role="switch"
      [id]="id()"
      [attr.aria-checked]="checkedSignal()"
      [attr.aria-invalid]="invalid() || errorState ? 'true' : null"
      [attr.aria-required]="fieldRequired ? 'true' : null"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-labelledby]="ariaLabelledBy()"
      [attr.aria-describedby]="computedAriaDescribedBy()"
      [attr.data-state]="checkedSignal() ? 'checked' : 'unchecked'"
      [disabled]="isDisabled()"
      [class]="trackClass()"
      (click)="toggle()"
      (focus)="onFocus()"
      (blur)="onBlur()"
    >
      <span [attr.data-state]="checkedSignal() ? 'checked' : 'unchecked'" [class]="thumbClass()">
        <span
          class="pointer-events-none absolute inset-0 grid place-items-center text-[var(--sanring-foreground)]"
          [class.hidden]="!checkedSignal()"
        >
          <ng-content select="[sanringSwitchIconChecked]" />
        </span>
        <span
          class="pointer-events-none absolute inset-0 grid place-items-center text-[var(--sanring-foreground)]"
          [class.hidden]="checkedSignal()"
        >
          <ng-content select="[sanringSwitchIconUnchecked]" />
        </span>
      </span>
    </button>
  `,
})
export class SwitchComponent extends SanringCvaBase<boolean> {
  readonly class = input<string | undefined>();
  readonly id = input(inject(_IdGenerator).getId('sanring-switch-', true));
  readonly checked = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | undefined>();
  readonly ariaLabelledBy = input<string | undefined>();
  readonly size = input<SwitchSize>('md');

  readonly checkedChange = output<boolean>();

  protected readonly checkedSignal = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.disabledState());
  protected readonly trackClass = computed(() =>
    cn(
      'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      SELECTION_CONTROL_FOCUS_CLASS,
      SWITCH_TRACK_SIZE_CLASSES[this.size()],
      this.invalid() || this.errorState ? 'border-[var(--sanring-error-50)]' : 'border-transparent',
      this.checkedSignal() ? 'bg-[var(--sanring-foreground)]' : 'bg-[var(--sanring-border-strong)]',
      this.class(),
    ),
  );
  protected readonly thumbClass = computed(() =>
    cn(
      'pointer-events-none relative block rounded-full bg-[var(--sanring-background)] shadow-lg ring-0 transition-transform duration-200 ease-in-out',
      SWITCH_THUMB_SIZE_CLASSES[this.size()],
      this.checkedSignal() && SWITCH_THUMB_TRANSLATE_CLASSES[this.size()],
      !this.checkedSignal() && 'translate-x-0',
    ),
  );

  // switch has no ariaDescribedBy input; only field-injected IDs are used
  protected readonly computedAriaDescribedBy = this.makeComputedAriaDescribedBy();

  @ViewChild('btn') private btnRef!: ElementRef<HTMLButtonElement>;

  get fieldValue(): boolean {
    return this.checkedSignal();
  }

  get fieldEmpty(): boolean {
    return !this.checkedSignal();
  }

  get fieldDisabled(): boolean {
    return this.isDisabled();
  }

  // switch has no required input; fieldRequired falls back to validator-only check in base class

  constructor() {
    super();
    effect(() => {
      this.checkedSignal.set(this.checked());
    });
  }

  toggle() {
    if (this.isDisabled()) return;
    this.checkedSignal.set(!this.checkedSignal());
    this.onChange(this.checkedSignal());
    this.onTouched();
    this.checkedChange.emit(this.checkedSignal());
    this.emitStateChanges();
  }

  focus(options?: FocusOptions): void {
    this.btnRef?.nativeElement.focus(options);
  }

  override writeValue(value: boolean | null | undefined): void {
    this.checkedSignal.set(!!value);
  }
}
