import { inject } from '@angular/core';
import { _IdGenerator } from '@angular/cdk/a11y';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 產生同一頁面內不會撞名的 DOM id，用於 a11y 屬性 (id / aria-describedby / for)
export function uniqueId(prefix: string): string {
  return inject(_IdGenerator).getId(`${prefix}-`, true);
}
