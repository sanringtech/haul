// dialog-description.directive.ts
import { Directive, computed, inject, input } from '@angular/core';
import { _IdGenerator } from '@angular/cdk/a11y';
import { cn } from '../shared/utils';
import { DESCRIPTION_TEXT_CLASS } from '../shared/component-styles';

@Directive({
  selector: '[sanringDialogDescription]',
  standalone: true,
  host: {
    '[id]': 'id()',
    '[class]': 'dialogDescriptionClass()',
  },
})
export class DialogDescriptionDirective {
  readonly id = input(inject(_IdGenerator).getId('sanring-dialog-description-', true));
  readonly class = input<string | undefined>();

  protected readonly dialogDescriptionClass = computed(() =>
    cn(DESCRIPTION_TEXT_CLASS, this.class()),
  );
}
