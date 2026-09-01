// rounded-[...] 原本是 sm:rounded-[...]（照 shadcn 網頁版慣例，手機全螢幕對話框不要圓角，
// ≥640px 才要）——這個 app 是固定 420px 寬的桌面視窗，永遠吃不到 sm: 這個斷點，等於圓角
// 100% 不會生效，不是手機版特意設計，是這裡的假設從一開始就不適用桌面固定視窗（2026-09-01
// 加新對話框時才發現，取消追蹤那個既有對話框其實也一直是方角，只是沒特別注意到）。拿掉 sm: 前綴。
// w-full 在固定寬度視窗裡會直接貼齊 overlay 容器邊緣——留白改在 dialog.service.ts 的 panelClass
// 加 p-4（外層 padding，不是這裡加 margin）：w-full 要對著「padding 收窄過的版面」算 100% 才會
// 左右對稱，在這裡加 mx-4 會變成 width:100% + margin 疊加，總寬度溢出容器，兩側留白反而不對稱
// （2026-09-01 使用者截圖抓到才發現，原本以為加 margin 就好，猜錯了）。
export const DIALOG_SURFACE_CLASS =
  'relative z-50 grid w-full max-w-lg gap-4 p-6 rounded-[var(--sanring-radius-lg)]';
export const OVERLAY_ABSOLUTE_CLOSE_BUTTON_CLASS =
  'absolute right-4 top-4 rounded-[var(--sanring-radius-xs)] text-[var(--sanring-muted)] opacity-70 ring-offset-[var(--sanring-surface)] transition-colors transition-opacity hover:text-[var(--sanring-foreground)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sanring-border-strong)] focus-visible:ring-offset-2 disabled:pointer-events-none';
