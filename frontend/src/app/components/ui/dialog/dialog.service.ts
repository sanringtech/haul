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
      // p-4 在外層（不是內層對話框加 margin）：DIALOG_SURFACE_CLASS 的 w-full 要對著「padding 收窄
      // 過的版面」去算 100%，這樣才會左右對稱。當初想在對話框本身加 mx-4 是錯的方向——width:100% +
      // margin 在 flex item 上會讓總寬度變成「容器寬度 + margin」，直接溢出，不是照預期縮小，這台
      // 420px 固定寬視窗一溢出就看得出來一邊貼邊一邊有空隙（2026-09-01 使用者截圖抓到才發現）。
      panelClass: ['fixed', 'inset-0', 'z-[51]', 'flex', 'items-center', 'justify-center', 'p-4'],
      ...config,
    });
  }

  closeAll(): void {
    this.cdkDialog.closeAll();
  }
}
