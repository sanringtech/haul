import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { FocusableOption } from '@angular/cdk/a11y';
import { LucideCheck } from '@lucide/angular';
import { SelectComponent } from './select.component';
import { cn } from '../shared/utils';
import { SELECT_ITEM_SIZE_CLASS } from './select.styles';
import { SelectIndicatorPosition, SelectValue } from './select.type';

@Component({
  selector: 'sanring-select-item',
  standalone: true,
  imports: [LucideCheck],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'option',
    '[attr.aria-selected]': 'isSelected()',
    '[attr.aria-disabled]': 'isDisabled() ? "true" : null',
    '[attr.data-state]': 'isSelected() ? "checked" : "unchecked"',
    '[attr.data-disabled]': 'isDisabled() ? "" : null',
    '[attr.tabindex]': 'isDisabled() ? "-1" : "0"',
    '[class]': 'itemClass()',
    '(click)': 'selectItem()',
    '(keydown.enter)': 'handleKeyActivation($event)',
    '(keydown.space)': 'handleKeyActivation($event)',
  },
  template: `
    <span [class]="indicatorClass()">
      @if (isSelected() && showIndicator()) {
        <ng-content select="[sanringSelectItemIndicator]">
          <svg lucideCheck class="size-4 animate-in zoom-in-50" strokeWidth="3"></svg>
        </ng-content>
      }
    </span>

    <span #label [class]="labelClass()">
      <ng-content></ng-content>
    </span>
  `,
})
export class SelectItemComponent implements AfterViewInit, FocusableOption {
  protected readonly select = inject(SelectComponent);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @ViewChild('label') private labelRef?: ElementRef<HTMLElement>;

  readonly value = input.required<SelectValue>();
  // FocusKeyManager's FocusableOption requires a plain `disabled` boolean property, which a
  // signal input() can't double as (it's a function) — same reason combobox-item/command-item
  // alias their disabled input to `disabledInput` and expose a plain getter for their
  // interface. Template usage stays `[disabled]="..."` either way.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly disabledInput = input(false, { alias: 'disabled', transform: booleanAttribute });
  readonly showIndicator = input(true, { transform: booleanAttribute });
  readonly indicatorPosition = input<SelectIndicatorPosition>('start');
  readonly class = input<string | undefined>();

  protected readonly isSelected = computed(() => this.select.selectedValue() === this.value());
  protected readonly isDisabled = computed(() => this.disabledInput() || this.select.isDisabled());

  // FocusableOption.disabled — used by SelectContentComponent's FocusKeyManager to skip this
  // item during Arrow-key navigation.
  get disabled(): boolean {
    return this.isDisabled();
  }

  protected readonly itemClass = computed(() =>
    cn(
      'relative flex w-full cursor-default select-none items-center gap-2 rounded-[var(--sanring-radius-xs)] px-2 outline-none',
      SELECT_ITEM_SIZE_CLASS,
      'text-[var(--sanring-foreground)] transition-colors',
      'hover:bg-[var(--sanring-surface-strong)] focus:bg-[var(--sanring-surface-strong)]',
      'data-[state=checked]:bg-[var(--sanring-active)] data-[state=checked]:hover:bg-[var(--sanring-active)]',
      'data-[state=checked]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      this.class(),
    ),
  );

  protected readonly indicatorClass = computed(() =>
    cn(
      'flex size-4 shrink-0 items-center justify-center text-current',
      this.isSelected() && this.showIndicator() ? 'opacity-100' : 'opacity-0',
      this.indicatorPosition() === 'end' ? 'order-2' : 'order-1',
    ),
  );

  protected readonly labelClass = computed(() =>
    cn('min-w-0 flex-1 truncate', this.indicatorPosition() === 'end' ? 'order-1' : 'order-2'),
  );

  constructor() {
    effect(() => {
      if (this.isSelected()) {
        this.select.setSelectedLabel(this.itemText());
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.isSelected()) {
      this.select.setSelectedLabel(this.itemText());
    }
  }

  protected selectItem(): void {
    if (this.isDisabled()) return;
    this.select.selectValue(this.value(), this.itemText());
  }

  protected handleKeyActivation(event: Event): void {
    if (this.isDisabled()) return;
    event.preventDefault();
    this.selectItem();
  }

  // FocusableOption — called by SelectContentComponent's FocusKeyManager to move real DOM
  // focus onto this item during Arrow-key navigation.
  focus(): void {
    this.elementRef.nativeElement.focus();
  }

  getLabel(): string {
    return this.itemText();
  }

  private itemText(): string {
    return (
      this.labelRef?.nativeElement.textContent?.trim() ??
      this.elementRef.nativeElement.textContent?.trim() ??
      ''
    );
  }
}
