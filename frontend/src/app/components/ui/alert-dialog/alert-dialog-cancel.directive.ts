import { Directive, HostListener, inject, input } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';

@Directive({ selector: '[sanringAlertDialogCancel]', standalone: true })
export class AlertDialogCancelDirective {
  // 未帶值使用（bare attribute）時，Angular 會把它綁成空字串而非套用 input 預設值，
  // 所以預設值改在 click handler 裡處理，空字串一律當作「沒有自訂結果」。
  readonly sanringAlertDialogCancel = input<unknown>('');

  private readonly dialogRef = inject(DialogRef, { optional: true });

  @HostListener('click')
  cancel() {
    const result = this.sanringAlertDialogCancel();
    this.dialogRef?.close(result === '' ? false : result);
  }
}
