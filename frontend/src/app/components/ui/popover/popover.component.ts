import { CdkOverlayOrigin } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { _IdGenerator } from '@angular/cdk/a11y';
import type { PopoverAlign } from './popover.type';

@Component({
  selector: 'sanring-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
})
export class PopoverComponent {
  private readonly _id = inject(_IdGenerator).getId('sanring-popover-', true);

  readonly isOpen = model(false);
  readonly align = input<PopoverAlign>('center');

  /** 供 PopoverTitle 綁定 id，讓面板 aria-labelledby 自動關聯 */
  readonly titleId = `${this._id}-title`;
  /** 供 PopoverDescription 綁定 id，讓面板 aria-describedby 自動關聯 */
  readonly descId = `${this._id}-desc`;
  /** 供 trigger aria-controls 與 content id 關聯 */
  readonly contentId = `${this._id}-content`;

  /**
   * 由 PopoverTriggerDirective 登記，供 CDK ConnectedOverlay 定位。
   * 用 signal 包裝（保留一般 property 讀寫語法）：trigger 若是巢狀在子元件內部（例如
   * CalendarHeaderComponent 內的 label 按鈕），constructor 賦值的時機會晚於
   * PopoverContentComponent 第一次 OnPush 檢查，純 property 讀取因此永遠讀到 undefined
   * 且不會再重新檢查；signal 讀取才能在賦值延後時仍正確觸發 reactive 重新渲染。
   */
  private readonly _triggerOrigin = signal<CdkOverlayOrigin | undefined>(undefined);

  get triggerOrigin(): CdkOverlayOrigin | undefined {
    return this._triggerOrigin();
  }

  set triggerOrigin(origin: CdkOverlayOrigin | undefined) {
    this._triggerOrigin.set(origin);
  }

  setOpen(open: boolean): void {
    this.isOpen.set(open);
  }
}
