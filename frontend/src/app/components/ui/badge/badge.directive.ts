import { Directive, computed, input } from '@angular/core';
import { cn } from '../shared/utils';
import { BADGE_SIZE_CLASS, BADGE_TEXT_CLASS } from './badge.styles';
import { BadgeVariant } from './badge.type';

@Directive({
  selector: 'span[sanringBadge], div[sanringBadge], a[sanringBadge]',
  standalone: true,
  host: { '[class]': 'badgeClass()' },
})
export class BadgeDirective {
  readonly class = input<string | undefined>();
  readonly variant = input<BadgeVariant>('default');

  protected readonly badgeClass = computed(() => {
    const variants: Record<BadgeVariant, string> = {
      default: 'border-transparent bg-[var(--sanring-control)] text-[var(--sanring-control-foreground)] hover:opacity-80',
      secondary:
        'border-[var(--sanring-border)] bg-[var(--sanring-surface-strong)] text-[var(--sanring-foreground)] hover:bg-[var(--sanring-active)]',
      destructive: 'border-transparent bg-[var(--sanring-error-50)] text-white hover:bg-[var(--sanring-error-60)]',
      outline: 'border-[var(--sanring-border-strong)] text-[var(--sanring-foreground)]',
      ghost:
        'border-transparent bg-transparent text-[var(--sanring-foreground)] hover:bg-[var(--sanring-surface-strong)]',
    };
    return cn(
      'inline-flex items-center justify-center gap-1 rounded-full border',
      BADGE_SIZE_CLASS,
      BADGE_TEXT_CLASS,
      'transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--sanring-border-strong)] focus:ring-offset-2',
      variants[this.variant()],
      this.class(),
    );
  });
}
