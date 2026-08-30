import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkOverlayOrigin } from '@angular/cdk/overlay';
import { cn } from '../shared/utils';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-tooltip',
  standalone: true,
  template: `<ng-content></ng-content>`,
  host: {
    style: 'display: contents',
    '[class]': 'tooltipClass()',
  },
})
export class TooltipComponent implements OnDestroy {
  readonly class = input<string | undefined>();
  readonly delayDuration = input(200, { transform: numberAttribute });

  readonly isOpen = signal(false);
  readonly triggerOrigin = signal<CdkOverlayOrigin | null>(null);
  readonly contentId = inject(_IdGenerator).getId('sanring-tooltip-', true);
  protected readonly tooltipClass = computed(() => cn(this.class()));

  private timeoutId?: ReturnType<typeof setTimeout>;

  show() {
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => this.isOpen.set(true), this.delayDuration());
  }

  hide() {
    clearTimeout(this.timeoutId);
    this.isOpen.set(false);
  }

  ngOnDestroy() {
    clearTimeout(this.timeoutId);
  }
}
