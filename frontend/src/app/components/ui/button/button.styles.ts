import type { ButtonSize } from './button.types';

// 'lg' 已從這裡移除：ButtonSize 型別沒有 'lg'，這個 key 在整個專案裡沒有任何地方會被索引到
// （sanringBtn 的 size 從未支援過 'lg'，docs 裡的 size="lg" 用例都是 sanringToggle，不是 button）。
export const CONTROL_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  icon: 'size-9 p-0',
  toolbar: 'h-[38px] min-w-[76px] px-3.5 text-sm',
  toolbarIcon: 'size-[38px] p-0',
};
