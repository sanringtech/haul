import { inject, Injectable, TemplateRef } from '@angular/core';
import { DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { DialogService } from '../dialog/dialog.service';

@Injectable({
  providedIn: 'root',
})
export class AlertDialogService {
  private readonly dialogService = inject(DialogService);

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

  // 🛠️ 真正的實作邏輯：疊加在 DialogService 之上，只多鎖 close 行為與調整 role
  open<R = unknown, D = unknown, C = unknown>(
    componentOrTemplate: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C> {
    // role/disableClose 放在 ...config 之後，確保呼叫端無法意外解除背景/Esc 鎖定
    const mergedConfig: DialogConfig<D, DialogRef<R, C>> = {
      ...config,
      role: 'alertdialog',
      disableClose: true,
    };

    // 用 instanceof narrowing 而非型別斷言，讓每個分支自然對上 DialogService 的對應多載
    if (componentOrTemplate instanceof TemplateRef) {
      return this.dialogService.open<R, D, C>(componentOrTemplate, mergedConfig);
    }

    return this.dialogService.open<R, D, C>(componentOrTemplate, mergedConfig);
  }
}
