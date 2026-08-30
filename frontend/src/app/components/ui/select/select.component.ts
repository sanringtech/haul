import { CdkOverlayOrigin } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  booleanAttribute,
  computed,
  forwardRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { _IdGenerator } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NgControl, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { FieldType, SanringFieldControl, SANRING_FIELD_CONTROL } from '../field/field.type';
import { SelectValue } from './select.type';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-select',
  standalone: true,
  template: `<ng-content></ng-content>`,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
    {
      provide: SANRING_FIELD_CONTROL,
      useExisting: forwardRef(() => SelectComponent),
    },
  ],
})
export class SelectComponent<T extends SelectValue = SelectValue>
  implements ControlValueAccessor, SanringFieldControl<T>, OnInit
{
  // Keep the SanringFieldControl `id` contract as a string getter while still
  // exposing a consumer-facing `id` input, matching InputDirective/TextareaDirective.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly idInput = input<string | undefined>(undefined, { alias: 'id' });
  private readonly generatedId = inject(_IdGenerator).getId('sanring-select-', true);
  get id(): string {
    return this.idInput() ?? this.generatedId;
  }
  readonly contentId = inject(_IdGenerator).getId('sanring-select-content-', true);

  // 🧠 元件的核心狀態
  readonly isOpen = model<boolean>(false); // 選單開關狀態
  readonly selectedValue = signal<T | null>(null); // 當前選中的數值
  readonly selectedLabel = signal<string | null>(null);
  readonly disabledState = signal<boolean>(false); // CVA setDisabledState() 寫入的禁用狀態
  // Plain-usage disabled input, same "combine with CVA state" pattern select-item.component.ts
  // already uses for its own disabledInput/disabledState — root/trigger just hadn't caught up.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly disabledInput = input(false, { alias: 'disabled', transform: booleanAttribute });
  readonly isDisabled = computed(() => this.disabledInput() || this.disabledState());
  triggerOrigin?: CdkOverlayOrigin;
  triggerElementRef?: ElementRef<HTMLElement>;

  // ==========================================
  // SanringFieldControl 介面實作：真正的可 focus 元素是 SelectTriggerDirective 那顆
  // <button>，所以 focus()/id 都要透過 triggerElementRef 轉一手。
  // ==========================================
  readonly controlType = FieldType.select;
  focused = false;
  ngControl: NgControl | null = null;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stateChangesSubject = new Subject<void>();
  readonly stateChanges = this.stateChangesSubject.asObservable();
  private readonly stateVersion = signal(0);
  private readonly fieldDescribedByIds = signal<string[]>([]);

  get value(): T | null {
    return this.selectedValue();
  }

  get empty(): boolean {
    return this.selectedValue() === null;
  }

  get errorState(): boolean {
    this.stateVersion();
    return !!(this.ngControl?.invalid && this.ngControl?.touched);
  }

  get disabled(): boolean {
    return this.isDisabled();
  }

  get required(): boolean {
    this.stateVersion();
    return !!this.ngControl?.control?.hasValidator(Validators.required);
  }

  // Angular 表單的控制回呼函式
  protected onChange: (value: T | null) => void = () => {};
  protected onTouched: () => void = () => {};

  constructor() {
    this.destroyRef.onDestroy(() => this.stateChangesSubject.complete());
  }

  ngOnInit(): void {
    // 跟 checkbox 一樣的原因：constructor 階段 self-inject NgControl 會跟 NgModel 搭配時
    // 觸發 NG0200 循環依賴（本元件同時透過 NG_VALUE_ACCESSOR 註冊自己），延後到 ngOnInit 才拿。
    this.ngControl = this.injector.get(NgControl, null, { optional: true, self: true });
    // 不能只聽 statusChanges——markAsTouched() 不會觸發它，改聽 control.events（Angular
    // v18+ 公開 API）才能在 markAllAsTouched() 這類外部呼叫時正確更新 errorState。
    this.ngControl?.control?.events
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.emitStateChanges());
  }

  // 提供給子元件（Trigger、Item）呼叫的方法
  setOpen(open: boolean): void {
    if (this.isDisabled()) return;
    this.isOpen.set(open);
  }

  selectValue(val: T | null, label?: string): void {
    if (this.isDisabled()) return;
    this.selectedValue.set(val);
    this.selectedLabel.set(label ?? null);
    this.onChange(val);
    this.onTouched();
    this.isOpen.set(false); // 選完自動關閉
    // 選完值後焦點回到 trigger（native <select> 本來就不會失焦），不管是滑鼠點選還是
    // 鍵盤 Enter/Space 選的都一樣——這是使用者主動完成的操作,跟「點擊選單外面關閉」
    // 不同,不會有搶走使用者焦點的問題。
    this.focus();
    this.emitStateChanges();
  }

  setSelectedLabel(label: string | null): void {
    this.selectedLabel.set(label);
  }

  registerTrigger(elementRef: ElementRef<HTMLElement>): void {
    this.triggerElementRef = elementRef;
  }

  onTriggerFocus(): void {
    this.focused = true;
    this.emitStateChanges();
  }

  onTriggerBlur(): void {
    this.focused = false;
    this.onTouched();
    this.emitStateChanges();
  }

  focus(options?: FocusOptions): void {
    this.triggerElementRef?.nativeElement.focus(options);
  }

  setDescribedByIds(ids: string[]): void {
    this.fieldDescribedByIds.set(ids);
  }

  get describedByAttr(): string | undefined {
    const ids = this.fieldDescribedByIds();
    return ids.length ? ids.join(' ') : undefined;
  }

  // --- ControlValueAccessor 介面實作 ---
  writeValue(value: T | null): void {
    this.selectedValue.set(value);
    this.selectedLabel.set(null);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
    this.emitStateChanges();
  }

  private emitStateChanges(): void {
    this.stateVersion.update((v) => v + 1);
    this.stateChangesSubject.next();
  }
}
