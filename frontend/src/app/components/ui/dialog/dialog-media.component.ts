import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-dialog-media',
  standalone: true,
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'mediaClass()',
  },
})
export class DialogMediaComponent {
  readonly class = input<string | undefined>();

  protected readonly mediaClass = computed(() =>
    cn(
      'mx-auto mb-4 grid size-12 place-items-center rounded-full border border-[var(--sanring-border)] bg-[var(--sanring-elevated)] text-[var(--sanring-foreground)] sm:mx-0',
      '[&_svg]:size-5 [&_svg]:shrink-0',
      this.class(),
    ),
  );
}
