import { Directive, computed, input } from '@angular/core';
import { cn } from '../shared/utils';

@Directive({
  selector: 'p[sanringCardDescription], div[sanringCardDescription]',
  standalone: true,
  host: {
    '[class]': 'cardDescriptionClass()',
  },
})
export class CardDescriptionDirective {
  readonly class = input<string | undefined>();

  protected readonly cardDescriptionClass = computed(() => cn(this.class()));
}
