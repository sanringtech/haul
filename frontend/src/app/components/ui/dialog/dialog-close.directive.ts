import { DialogRef } from '@angular/cdk/dialog';
import { Directive, HostListener, inject, input } from '@angular/core';

@Directive({ selector: '[sanringDialogClose]', standalone: true })
export class DialogCloseDirective {
  private readonly dialogRef = inject(DialogRef, { optional: true });

  // 未帶值使用（bare attribute）時，Angular 會把它綁成空字串而非套用 input 預設值，
  // 所以空字串一律當作「沒有自訂結果」，正規化回 undefined。
  readonly result = input<unknown>(undefined, { alias: 'sanringDialogClose' });

  @HostListener('click')
  closeDialog() {
    const result = this.result();
    this.dialogRef?.close(result === '' ? undefined : result);
  }
}
