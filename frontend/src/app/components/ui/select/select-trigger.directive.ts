import { CdkOverlayOrigin } from '@angular/cdk/overlay';
import { Directive, ElementRef, computed, inject, input } from '@angular/core';
import { cn } from '../shared/utils';
import { SelectComponent } from './select.component';

@Directive({
  selector: 'button[sanringSelectTrigger]',
  standalone: true,
  hostDirectives: [CdkOverlayOrigin],
  host: {
    type: 'button',
    role: 'combobox',
    'aria-haspopup': 'listbox',
    '[id]': 'select.id',
    '[attr.aria-expanded]': 'select.isOpen() ? "true" : "false"',
    '[attr.aria-controls]': 'select.isOpen() ? select.contentId : null',
    '[attr.data-state]': 'select.isOpen() ? "open" : "closed"',
    '[disabled]': 'select.isDisabled()',
    '[attr.aria-disabled]': 'select.isDisabled() ? "true" : "false"',
    '[attr.aria-invalid]': 'select.errorState ? "true" : null',
    '[attr.aria-required]': 'select.required ? "true" : null',
    '[attr.aria-describedby]': 'select.describedByAttr',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-labelledby]': 'ariaLabelledBy()',
    '[class]': 'triggerClass()',
    '(click)': 'onClick()',
    '(focus)': 'select.onTriggerFocus()',
    '(blur)': 'select.onTriggerBlur()',
    '(keydown.enter)': 'onOpenKeydown($event)',
    '(keydown.space)': 'onOpenKeydown($event)',
    '(keydown.arrowdown)': 'onOpenKeydown($event)',
    '(keydown.arrowup)': 'onOpenKeydown($event)',
  },
})
export class SelectTriggerDirective {
  protected readonly select = inject(SelectComponent);
  private readonly origin = inject(CdkOverlayOrigin);
  readonly class = input<string | undefined>();
  readonly ariaLabel = input<string | undefined>();
  readonly ariaLabelledBy = input<string | undefined>();

  constructor() {
    this.select.triggerOrigin = this.origin;
    this.select.registerTrigger(inject(ElementRef));
  }

  protected readonly triggerClass = computed(() =>
    cn(
      'flex h-10 w-full items-center justify-between gap-2 rounded-[var(--sanring-radius)] border border-[var(--sanring-border-strong)]',
      'bg-[var(--sanring-surface)] px-3 py-2 text-sm text-[var(--sanring-foreground)]',
      'transition-colors hover:bg-[var(--sanring-surface-strong)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sanring-border-strong)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      this.class(),
    ),
  );

  protected onClick(): void {
    if (this.select.isDisabled()) return;
    this.select.setOpen(!this.select.isOpen());
  }

  protected onOpenKeydown(event: Event): void {
    if (this.select.isDisabled()) return;
    if (!(event instanceof KeyboardEvent)) return;

    event.preventDefault();
    if (!this.select.isOpen()) {
      this.select.setOpen(true);
    }
  }
}
