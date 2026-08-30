import { Directive, computed, input } from '@angular/core';

@Directive({
  selector: '[sanringProgress]',
  exportAs: 'progress',
  standalone: true,
  host: {
    role: 'progressbar',
    '[attr.aria-valuenow]': 'clampedValue()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-valuetext]': 'ariaValueText()',
  },
})
export class ProgressDirective {
  readonly value = input<number>(0);
  readonly max = input<number>(100);
  readonly ariaLabel = input<string | undefined>();
  readonly ariaValueText = input<string | undefined>();

  // aria-valuenow must stay within [aria-valuemin, aria-valuemax] per the ARIA spec —
  // clamp it the same way percentage() clamps the visual fill, so an out-of-range
  // `value` (e.g. exceeding `max`) doesn't get reported straight through to assistive tech.
  readonly clampedValue = computed(() => {
    const max = this.max();
    if (max <= 0) return 0;
    return Math.min(max, Math.max(0, this.value()));
  });

  readonly percentage = computed(() => {
    const max = this.max();
    if (max <= 0) return 0;
    return Math.min(100, Math.max(0, (this.value() / max) * 100));
  });
}
