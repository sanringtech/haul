import { DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { Directive, HostListener, TemplateRef, inject, input } from '@angular/core';
import { DialogService } from './dialog.service';

@Directive({ selector: '[sanringDialogTrigger]', standalone: true })
export class DialogTriggerDirective {
  private dialogService = inject(DialogService);

  readonly sanringDialogTrigger = input.required<TemplateRef<unknown>>();
  readonly sanringDialogConfig = input<DialogConfig<unknown, DialogRef<unknown, unknown>>>();

  @HostListener('click')
  onClick() {
    const dialogTemplate = this.sanringDialogTrigger();

    if (dialogTemplate) {
      this.dialogService.open(dialogTemplate, this.sanringDialogConfig());
    }
  }
}
