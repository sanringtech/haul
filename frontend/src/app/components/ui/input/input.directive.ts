import { Directive, ElementRef, inject, input, DoCheck, OnDestroy } from '@angular/core';
import { cn, uniqueId } from '../shared/utils';
import { FIELD_SIZE_CLASS } from '../shared/component-styles';
import { Subject } from 'rxjs';
import { NgControl, Validators } from '@angular/forms';
import { FieldType, SanringFieldControl, SANRING_FIELD_CONTROL } from '../field/field.type';

@Directive({
  selector: 'input[sanringInput]',
  standalone: true,
  providers: [{ provide: SANRING_FIELD_CONTROL, useExisting: InputDirective }],
  host: {
    '[class]': 'hostClass',
    '[id]': 'id',
    '[attr.aria-invalid]': 'errorState ? "true" : null',
    '[attr.aria-required]': 'required ? "true" : null',
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()',
    '(input)': 'onInput()',
  },
})
export class InputDirective implements SanringFieldControl<string>, DoCheck, OnDestroy {
  readonly class = input<string>('');

  private readonly stateChangesSubject = new Subject<void>();
  readonly stateChanges = this.stateChangesSubject.asObservable();
  readonly controlType = FieldType.input;
  focused = false;

  // Consumed as an input (aliased to the native `id` attribute) rather than read
  // straight off the element, so an id the consumer writes on <input sanringInput
  // id="..."> is captured here instead of being silently overwritten by the `[id]`
  // host binding below — the same self-healing pattern as the CVA components'
  // `input(inject(_IdGenerator).getId(...))`, adapted for a directive that
  // implements SanringFieldControl directly (so `id` itself must stay a plain
  // string getter, not a signal, to satisfy the interface).
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly idInput = input<string | undefined>(undefined, { alias: 'id' });
  private readonly generatedId = uniqueId('sanring-input');
  get id(): string {
    return this.idInput() ?? this.generatedId;
  }

  readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private previousState: InputStateSnapshot | null = null;

  protected get hostClass(): string {
    return cn(
      'peer flex h-10 w-full rounded-[var(--sanring-radius)] border border-[var(--sanring-border-strong)]',
      'bg-[var(--sanring-surface)] text-[var(--sanring-foreground)]',
      FIELD_SIZE_CLASS,
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      'placeholder:text-[var(--sanring-muted)]',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--sanring-border-strong)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      // 當驗證失敗時，覆蓋原有的 border 與 ring 顏色
      this.errorState && 'border-[var(--sanring-error-50)] focus-visible:ring-[var(--sanring-error-40)]',
      this.class(),
    );
  }

  get empty(): boolean {
    return !this.el.nativeElement.value;
  }

  get value(): string {
    return this.el.nativeElement.value;
  }

  // 判斷是否顯示錯誤：有 NgControl + 驗證不通過 + 已經被碰觸過 (touched)
  get errorState(): boolean {
    return !!(this.ngControl?.invalid && this.ngControl?.touched);
  }

  // 有綁定 ngControl (reactive forms) 時，disabled 狀態以 control 為準；否則看原生屬性
  get disabled(): boolean {
    return this.ngControl?.disabled ?? this.el.nativeElement.disabled;
  }

  get required(): boolean {
    return (
      this.el.nativeElement.required || !!this.ngControl?.control?.hasValidator(Validators.required)
    );
  }

  onFocus() {
    this.focused = true;
    this.emitStateChanges();
  }

  onBlur() {
    this.focused = false;
    this.emitStateChanges();
  }

  // 確保即使沒有 ngControl，使用者的每次按鍵都能通知外層 (例如更新 empty 狀態)
  onInput() {
    this.emitStateChanges();
  }

  // Angular 在某些狀態改變時（例如透過程式碼手動 markAsTouched）不會觸發 DOM 事件，
  // 透過 ngDoCheck 可以在每個變更偵測週期同步狀態給外層 Field。
  ngDoCheck() {
    if (this.ngControl && this.hasStateChanged()) {
      this.emitStateChanges();
    }
  }

  ngOnDestroy() {
    this.stateChangesSubject.complete();
  }

  focus(options?: FocusOptions): void {
    this.el.nativeElement.focus(options);
  }

  setDescribedByIds(ids: string[]): void {
    if (ids.length) {
      this.el.nativeElement.setAttribute('aria-describedby', ids.join(' '));
    } else {
      this.el.nativeElement.removeAttribute('aria-describedby');
    }
  }

  private emitStateChanges(): void {
    this.previousState = this.getStateSnapshot();
    this.stateChangesSubject.next();
  }

  private hasStateChanged(): boolean {
    const currentState = this.getStateSnapshot();
    const previousState = this.previousState;

    return (
      !previousState ||
      currentState.value !== previousState.value ||
      currentState.focused !== previousState.focused ||
      currentState.empty !== previousState.empty ||
      currentState.errorState !== previousState.errorState ||
      currentState.disabled !== previousState.disabled ||
      currentState.required !== previousState.required
    );
  }

  private getStateSnapshot(): InputStateSnapshot {
    return {
      value: this.value,
      focused: this.focused,
      empty: this.empty,
      errorState: this.errorState,
      disabled: this.disabled,
      required: this.required,
    };
  }
}

interface InputStateSnapshot {
  value: string;
  focused: boolean;
  empty: boolean;
  errorState: boolean;
  disabled: boolean;
  required: boolean;
}
