import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';
import { AlertVariant } from './alert.type';

@Component({
  selector: 'sanring-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'alertClass()',
    role: 'alert',
  },
})
export class AlertComponent {
  readonly class = input<string | undefined>();
  readonly variant = input<AlertVariant>('default');

  protected readonly alertClass = computed(() => {
    const variants: Record<AlertVariant, string> = {
      default:
        'border-[var(--sanring-border-strong)] bg-[var(--sanring-surface)] text-[var(--sanring-foreground)]',
      destructive:
        'border-[var(--sanring-error-50)] bg-[color-mix(in_srgb,var(--sanring-error-50)_10%,transparent)] text-[var(--sanring-error-40)] [&>svg]:text-[var(--sanring-error-40)]',
    };
    return cn(
      'relative block w-full rounded-[var(--sanring-radius-lg)] border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-[var(--sanring-foreground)]',
      variants[this.variant()],
      this.class(),
    );
  });
}
