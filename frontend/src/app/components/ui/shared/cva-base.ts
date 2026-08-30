import {
  DestroyRef,
  Directive,
  Injector,
  OnInit,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { FieldType, SanringFieldControl } from '../field/field.type';

// Abstract base class for all Sanring form components. Holds the shared
// ControlValueAccessor plumbing, Field integration state, and the bridge
// that keeps errorState/fieldRequired reactive under OnPush change detection.
//
// Why ngOnInit and not a constructor inject for NgControl: components register
// themselves via NG_VALUE_ACCESSOR (forwardRef). Self-injecting NgControl in the
// constructor while also being a NG_VALUE_ACCESSOR causes NG0200 with NgModel
// (NgModel needs to resolve its value accessor — i.e. us — before we exist).
// Deferring to ngOnInit avoids the cycle because Angular finishes constructing
// all directives on the same node before firing lifecycle hooks.
//
// Why control.events and not statusChanges: markAsTouched() does not emit on
// statusChanges (only valid/invalid/pending/disabled transitions do), so an
// external markAllAsTouched() call would not update errorState. control.events
// (Angular v18+) fires for every state mutation including touched changes.
@Directive()
export abstract class SanringCvaBase<T> implements ControlValueAccessor, OnInit {
  focused = false;
  ngControl: NgControl | null = null;

  protected readonly _injector = inject(Injector);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _stateChangesSubject = new Subject<void>();
  readonly stateChanges: Observable<void> = this._stateChangesSubject.asObservable();
  protected readonly _stateVersion = signal(0);
  private readonly _fieldDescribedByIds = signal<string[]>([]);
  protected readonly disabledState = signal(false);

  protected onChange: (value: T) => void = () => {};
  protected onTouched: () => void = () => {};

  constructor() {
    this._destroyRef.onDestroy(() => this._stateChangesSubject.complete());
  }

  get errorState(): boolean {
    this._stateVersion();
    return !!(this.ngControl?.invalid && this.ngControl?.touched);
  }

  get fieldRequired(): boolean {
    this._stateVersion();
    return this.hasInputRequired() || !!this.ngControl?.control?.hasValidator(Validators.required);
  }

  // Override in subclasses that expose a `required` input.
  protected hasInputRequired(): boolean {
    return false;
  }

  // Builds a computed that merges an optional component-level ariaDescribedBy
  // input with any IDs injected by a parent Field via setDescribedByIds().
  protected makeComputedAriaDescribedBy(ariaDescribedBy?: Signal<string | undefined>) {
    return computed(() => {
      const ids = [ariaDescribedBy?.(), ...this._fieldDescribedByIds()].filter(
        (v): v is string => !!v,
      );
      return ids.length ? ids.join(' ') : undefined;
    });
  }

  ngOnInit(): void {
    this.ngControl = this._injector.get(NgControl, null, { optional: true, self: true });
    this.ngControl?.control?.events
      ?.pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this.emitStateChanges());
  }

  onFocus(): void {
    this.focused = true;
    this.emitStateChanges();
  }

  onBlur(): void {
    this.focused = false;
    this.onTouched();
    this.emitStateChanges();
  }

  setDescribedByIds(ids: string[]): void {
    this._fieldDescribedByIds.set(ids);
  }

  registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
    this.emitStateChanges();
  }

  protected emitStateChanges(): void {
    this._stateVersion.update((v) => v + 1);
    this._stateChangesSubject.next();
  }

  abstract writeValue(value: T): void;
}

// The component classes cannot directly implement SanringFieldControl because
// SanringFieldControl requires id/disabled/value/required as plain properties,
// which would collide with same-named Angular @Input() signals. This adapter
// bridges the gap: it holds a typed reference to the host and delegates every
// SanringFieldControl accessor through the host's fieldXxx getters.
interface SanringCvaHost<T> {
  id(): string;
  fieldValue: T | null;
  fieldEmpty: boolean;
  focused: boolean;
  errorState: boolean;
  fieldDisabled: boolean;
  fieldRequired: boolean;
  ngControl: NgControl | null;
  stateChanges: Observable<void>;
  focus(options?: FocusOptions): void;
  setDescribedByIds(ids: string[]): void;
}

export class SanringFieldControlAdapter<T> implements SanringFieldControl<T> {
  constructor(
    readonly controlType: FieldType,
    private readonly host: SanringCvaHost<T>,
  ) {}

  get id(): string {
    return this.host.id();
  }
  get value(): T | null {
    return this.host.fieldValue;
  }
  get empty(): boolean {
    return this.host.fieldEmpty;
  }
  get focused(): boolean {
    return this.host.focused;
  }
  get errorState(): boolean {
    return this.host.errorState;
  }
  get disabled(): boolean {
    return this.host.fieldDisabled;
  }
  get required(): boolean {
    return this.host.fieldRequired;
  }
  get ngControl(): NgControl | null {
    return this.host.ngControl;
  }
  get stateChanges(): Observable<void> {
    return this.host.stateChanges;
  }
  focus(options?: FocusOptions): void {
    this.host.focus(options);
  }
  setDescribedByIds(ids: string[]): void {
    this.host.setDescribedByIds(ids);
  }
}
