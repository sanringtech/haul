import {
  ChangeDetectionStrategy,
  Injector,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  effect,
  inject,
  input,
} from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
// 1. 引入 LucideAngularModule 與需要的 X icon
import { LucideX } from '@lucide/angular';
import { cn } from '../shared/utils';
import { OVERLAY_CLOSE_ICON_CLASS, OVERLAY_SURFACE_CLASS } from '../shared/component-styles';
import { DialogDescriptionDirective } from './dialog-description.directive';
import { DialogTitleDirective } from './dialog-title.directive';
import { DIALOG_SURFACE_CLASS, OVERLAY_ABSOLUTE_CLOSE_BUTTON_CLASS } from './dialog.styles';

interface DialogAriaSnapshot {
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  titleId?: string;
  descriptionId?: string;
}

function firstAriaValue(...values: Array<string | null | undefined>): string | null {
  return values.find((value): value is string => !!value?.trim()) ?? null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-dialog-content',
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
export class DialogContentComponent {
  protected readonly closeButtonClass = OVERLAY_ABSOLUTE_CLOSE_BUTTON_CLASS;
  protected readonly closeIconClass = OVERLAY_CLOSE_ICON_CLASS;

  readonly class = input<string | undefined>();
  readonly showClose = input(true, { transform: booleanAttribute });
  readonly closeAriaLabel = input('關閉對話框');
  /** Accessible-name fallback used when no projected dialog title is present. */
  readonly ariaLabel = input<string | undefined>();
  /** Explicit labelling relationship; takes precedence over a projected title and ariaLabel. */
  readonly ariaLabelledBy = input<string | undefined>();
  /** Explicit description relationship; takes precedence over a projected description. */
  readonly ariaDescribedBy = input<string | undefined>();

  private dialogRef = inject(DialogRef, { optional: true });
  private readonly injector = inject(Injector);
  private readonly title = contentChild(DialogTitleDirective, { descendants: true });
  private readonly description = contentChild(DialogDescriptionDirective, { descendants: true });
  private configAriaCaptured = false;
  private configAriaLabel: string | null = null;
  private configAriaLabelledBy: string | null = null;
  private configAriaDescribedBy: string | null = null;

  protected readonly dialogContentClass = computed(() =>
    cn(OVERLAY_SURFACE_CLASS, DIALOG_SURFACE_CLASS, 'bg-[var(--sanring-surface)]', this.class()),
  );

  constructor() {
    effect(() => {
      const snapshot: DialogAriaSnapshot = {
        label: this.ariaLabel(),
        labelledBy: this.ariaLabelledBy(),
        describedBy: this.ariaDescribedBy(),
        titleId: this.title()?.id(),
        descriptionId: this.description()?.id(),
      };
      afterNextRender(() => this.syncDialogAria(snapshot), { injector: this.injector });
    });
  }

  closeDialog() {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }

  private syncDialogAria(snapshot: DialogAriaSnapshot) {
    const container = this.getDialogContainer();

    if (!container) {
      return;
    }

    if (!this.configAriaCaptured) {
      this.configAriaLabel = container.getAttribute('aria-label');
      this.configAriaLabelledBy = container.getAttribute('aria-labelledby');
      this.configAriaDescribedBy = container.getAttribute('aria-describedby');
      this.configAriaCaptured = true;
    }

    // Keep an accessible name supplied through DialogConfig unless the content
    // explicitly opts into a different relationship.
    const labelledBy = firstAriaValue(
      snapshot.labelledBy,
      this.configAriaLabelledBy,
      snapshot.titleId,
    );
    const describedBy = firstAriaValue(
      snapshot.describedBy,
      this.configAriaDescribedBy,
      snapshot.descriptionId,
    );

    if (labelledBy) {
      container.setAttribute('aria-labelledby', labelledBy);
      container.removeAttribute('aria-label');
    } else {
      const label =
        firstAriaValue(snapshot.label, this.configAriaLabel) ??
        (container.getAttribute('role') === 'alertdialog' ? 'Alert dialog' : 'Dialog');
      container.setAttribute('aria-label', label);
      container.removeAttribute('aria-labelledby');
    }

    if (describedBy) {
      container.setAttribute('aria-describedby', describedBy);
    } else {
      container.removeAttribute('aria-describedby');
    }
  }

  private getDialogContainer() {
    return this.dialogRef?.overlayRef.overlayElement.querySelector('cdk-dialog-container');
  }
}
