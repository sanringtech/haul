import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { DialogContentComponent } from '../dialog/dialog-content.component';

/**
 * Extends (rather than wraps) DialogContentComponent: @ContentChild queries for
 * title/description resolve against wherever this component is instantiated, which
 * breaks if content is passed through a nested <ng-content> wrapper instead.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-alert-dialog-content',
  standalone: true,
  imports: [LucideX],
  host: {
    '[class]': 'dialogContentClass()',
  },
  template: `
    <ng-content></ng-content>

    @if (showClose()) {
      <button
        type="button"
        [attr.aria-label]="closeAriaLabel()"
        (click)="closeDialog()"
        [class]="closeButtonClass"
      >
        <svg lucideX [class]="closeIconClass"></svg>
        <span class="sr-only">關閉</span>
      </button>
    }
  `,
  styles: `
    :host {
      animation: sanring-dialog-content-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes sanring-dialog-content-in {
      from {
        opacity: 0;
        scale: 0.95;
      }

      to {
        opacity: 1;
        scale: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
})
export class AlertDialogContentComponent extends DialogContentComponent {
  override readonly showClose = input(false, { transform: booleanAttribute });
}
