// dialog-title.directive.ts
import { Directive, computed, inject, input } from '@angular/core';
import { _IdGenerator } from '@angular/cdk/a11y';
import { cn } from '../shared/utils';
import { TITLE_TEXT_CLASS } from '../shared/component-styles';

@Directive({
  selector: '[sanringDialogTitle]',
  standalone: true,
  host: {
    '[id]': 'id()',
    '[class]': 'dialogTitleClass()',
  },
})
export class DialogTitleDirective {
  readonly id = input(inject(_IdGenerator).getId('sanring-dialog-title-', true));
  readonly class = input<string | undefined>();

  protected readonly dialogTitleClass = computed(() => cn(TITLE_TEXT_CLASS, this.class()));
}
