import { Directive, ElementRef, HostListener, booleanAttribute, computed, inject, input } from '@angular/core';
import { cn } from '../shared/utils';
import { CONTROL_TEXT_CLASS } from '../shared/component-styles';
import { CONTROL_SIZE_CLASSES } from './button.styles';
import type { ButtonSize, ButtonVariant } from './button.types';

@Directive({
  selector: 'button[sanringBtn], a[sanringBtn]',
  standalone: true,
  host: {
    '[class]': 'buttonClass()',
    '[attr.role]': 'isAnchor && !hasHref ? "button" : null',
    '[attr.aria-disabled]': "disabled() ? 'true' : null",
    '[attr.disabled]': 'disabled() && !isAnchor ? true : null',
    '[attr.tabindex]': 'hostTabIndex()',
    '(keydown.enter)': 'handleActivationKey($event)',
    '(keydown.space)': 'handleActivationKey($event)',
  },
})
export class ButtonDirective {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly class = input<string | undefined>();
  readonly variant = input<ButtonVariant>('default');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly isAnchor = this.elementRef.nativeElement.tagName.toLowerCase() === 'a';
  protected readonly hasHref = this.elementRef.nativeElement.hasAttribute('href');

  // A hrefless <a> isn't natively focusable, so it needs an explicit tabindex
  // to match the role="button" this directive gives it; an <a href> is already
  // focusable natively; a <button> needs no tabindex at all.
  protected readonly hostTabIndex = computed<number | null>(() => {
    if (!this.isAnchor) return null;
    if (this.disabled()) return -1;
    return this.hasHref ? null : 0;
  });

  protected readonly buttonClass = computed(() => {
    const variants: Record<ButtonVariant, string> = {
      default: 'border-transparent bg-[var(--sanring-control)] text-[var(--sanring-control-foreground)]',
      secondary:
        'border-[var(--sanring-border)] bg-[var(--sanring-surface-strong)] text-[var(--sanring-foreground)] hover:bg-[var(--sanring-active)]',
      outline:
        'border-[var(--sanring-border-strong)] bg-transparent text-[var(--sanring-foreground)] hover:bg-[var(--sanring-surface-strong)]',
      ghost:
        'border-transparent bg-transparent text-[var(--sanring-foreground)] hover:bg-[var(--sanring-surface-strong)]',
      destructive:
        'border-transparent bg-[var(--sanring-error-70)] text-white hover:bg-[var(--sanring-error-80)] focus-visible:ring-[var(--sanring-error-60)]',
      link: 'border-transparent bg-transparent px-0 text-[var(--sanring-foreground)] underline-offset-4 hover:underline',
    };
    return cn(
      'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--sanring-radius)] border',
      CONTROL_TEXT_CLASS,
      'transition-[background-color,color] focus-visible:outline-none focus-visible:ring-2',
      'focus-visible:ring-[var(--sanring-border-strong)] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
      variants[this.variant()],
      CONTROL_SIZE_CLASSES[this.size()],
      this.class(),
    );
  });

  @HostListener('click', ['$event'])
  protected handleClick(event: Event) {
    if (!this.disabled()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  // Only a hrefless <a role="button"> needs this: a native <button> already
  // activates on Enter/Space, and an <a href> already navigates on Enter.
  protected handleActivationKey(event: Event) {
    if (!this.isAnchor || this.hasHref || this.disabled()) return;
    event.preventDefault();
    this.elementRef.nativeElement.click();
  }
}
