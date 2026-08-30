import { Directive, OnDestroy, OnInit, inject } from '@angular/core';
import { CdkOverlayOrigin } from '@angular/cdk/overlay';
import { TooltipComponent } from './tooltip.component';

@Directive({
  selector: '[sanringTooltipTrigger]',
  standalone: true,
  hostDirectives: [CdkOverlayOrigin],
  host: {
    '[attr.aria-describedby]': 'tooltip.isOpen() ? tooltip.contentId : null',
    '(mouseenter)': 'tooltip.show()',
    '(mouseleave)': 'tooltip.hide()',
    '(focus)': 'tooltip.show()',
    '(blur)': 'tooltip.hide()',
    '(keydown.escape)': 'handleEscape($event)',
  },
})
export class TooltipTriggerDirective implements OnInit, OnDestroy {
  protected tooltip = inject(TooltipComponent);
  private origin = inject(CdkOverlayOrigin);

  ngOnInit() {
    this.tooltip.triggerOrigin.set(this.origin);
  }

  ngOnDestroy() {
    if (this.tooltip.triggerOrigin() === this.origin) {
      this.tooltip.triggerOrigin.set(null);
      this.tooltip.hide();
    }
  }

  protected handleEscape(event: Event) {
    if (!this.tooltip.isOpen()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.tooltip.hide();
  }
}
