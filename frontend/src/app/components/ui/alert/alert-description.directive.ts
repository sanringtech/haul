import { Directive, computed, input } from '@angular/core';
import { cn } from '../shared/utils';
import { ALERT_DESCRIPTION_TEXT_CLASS } from './alert.styles';

@Directive({
  selector: '[sanringAlertDescription]',
  standalone: true,
  host: {
    '[class]': 'alertDescriptionClass()',
  },
})
export class AlertDescriptionDirective {
  readonly class = input<string | undefined>();

  protected readonly alertDescriptionClass = computed(() =>
    cn(ALERT_DESCRIPTION_TEXT_CLASS, this.class()),
  );
}
