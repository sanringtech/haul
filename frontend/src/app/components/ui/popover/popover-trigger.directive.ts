import { CdkOverlayOrigin } from '@angular/cdk/overlay';
import { Directive, inject } from '@angular/core';
import { PopoverComponent } from './popover.component';

@Directive({
  selector: '[sanringPopoverTrigger]',
  standalone: true,
  hostDirectives: [CdkOverlayOrigin],
  host: {
    '(click)': 'onClick()',
    'aria-haspopup': 'dialog',
    '[attr.aria-expanded]': 'popover.isOpen() ? "true" : "false"',
    '[attr.aria-controls]': 'popover.isOpen() ? popover.contentId : null',
  },
})
export class PopoverTriggerDirective {
  protected readonly popover = inject(PopoverComponent);
  private readonly origin = inject(CdkOverlayOrigin);

  constructor() {
    this.popover.triggerOrigin = this.origin;
  }

  protected onClick(): void {
    this.popover.setOpen(!this.popover.isOpen());
  }
}
