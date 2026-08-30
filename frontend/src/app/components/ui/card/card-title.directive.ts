import { Directive, computed, input } from '@angular/core';
import { cn } from '../shared/utils';
import { SECTION_TITLE_TEXT_CLASS } from './card.styles';

@Directive({
  selector:
    'h1[sanringCardTitle], h2[sanringCardTitle], h3[sanringCardTitle], h4[sanringCardTitle], div[sanringCardTitle]',
  standalone: true,
  host: {
    '[class]': 'cardTitleClass()',
  },
})
export class CardTitleDirective {
  readonly class = input<string | undefined>();

  protected readonly cardTitleClass = computed(() =>
    cn(SECTION_TITLE_TEXT_CLASS, this.class()),
  );
}
