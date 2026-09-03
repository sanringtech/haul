// 退場動畫實際時長由各元件的 CSS 決定，這裡的數字只是 animationend 事件因故沒觸發時
// 的保底上限（例如動畫被中途打斷），不必跟 CSS 精準同步。

/** popover 與 hover-card 共用 CSS 動畫 --animate-popover-out */
export const POPOVER_LEAVE_DURATION_MS = 150;

/** sheet 的 CSS 動畫 --animate-sheet-out-* */
export const SHEET_LEAVE_DURATION_MS = 200;

/** toast 的 CSS 動畫 --animate-toast-leave */
export const TOAST_LEAVE_FALLBACK_MS = 200;
