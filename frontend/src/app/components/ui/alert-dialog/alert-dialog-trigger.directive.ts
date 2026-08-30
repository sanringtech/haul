import { DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { Directive, HostListener, TemplateRef, inject, input } from '@angular/core';
import { AlertDialogService } from './alert-dialog.service';

@Directive({ selector: '[sanringAlertDialogTrigger]', standalone: true })
export class AlertDialogTriggerDirective {
  private readonly alertDialogService = inject(AlertDialogService);

  readonly sanringAlertDialogTrigger = input.required<TemplateRef<unknown>>();
  readonly sanringAlertDialogConfig = input<DialogConfig<unknown, DialogRef<unknown, unknown>>>();

  @HostListener('click')
  onClick() {
    const alertDialogTemplate = this.sanringAlertDialogTrigger();

    if (alertDialogTemplate) {
      this.alertDialogService.open(alertDialogTemplate, this.sanringAlertDialogConfig());
    }
  }
}
