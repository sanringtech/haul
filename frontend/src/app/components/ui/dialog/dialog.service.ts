import { inject, Injectable, TemplateRef } from '@angular/core';
import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  private readonly cdkDialog = inject(Dialog);

  // 📖 多載 1：提供給傳入 Component 的情況
  open<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C>;

  // 📖 多載 2：提供給傳入 Template 的情況
  open<R = unknown, D = unknown, C = unknown>(
    template: TemplateRef<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C>;

  // 🛠️ 真正的實作邏輯 (把兩種情況包起來處理)
  open<R = unknown, D = unknown, C = unknown>(
    componentOrTemplate: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C> {
    return this.cdkDialog.open<R, D, C>(componentOrTemplate, {
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaModal: true,
      backdropClass: ['fixed', 'inset-0', 'z-50', 'bg-black/80', 'backdrop-blur-sm'],
      panelClass: ['fixed', 'inset-0', 'z-[51]', 'flex', 'items-center', 'justify-center'],
      ...config,
    });
  }

  closeAll(): void {
    this.cdkDialog.closeAll();
  }
}
