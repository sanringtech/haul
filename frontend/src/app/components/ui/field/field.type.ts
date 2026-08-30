import { InjectionToken } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Observable } from 'rxjs';

export const FieldType = {
  input: 'input',
  textarea: 'textarea',
  switch: 'switch',
  select: 'select',
  checkbox: 'checkbox',
  radioGroup: 'radio-group',
  slider: 'slider',
  otpInput: 'otp-input',
  fileUpload: 'file-upload',
  calendar: 'calendar',
  datePicker: 'date-picker',
} as const;

export type FieldType = (typeof FieldType)[keyof typeof FieldType];

export interface SanringFieldControl<T = unknown> {
  /** 控制項的值 (T 可能是 string, boolean, string[] 等) */
  readonly value: T | null;

  /** 關聯的 Angular 表單控制項狀態 (用來判斷驗證) */
  readonly ngControl: NgControl | null;

  /** 狀態變更時發出通知 (如 focus, blur, error 發生時) */
  readonly stateChanges: Observable<void>;

  /** 元件的唯一識別碼 (通常由外部生成或自己生成) */
  readonly id: string;

  /** 該控制項是否處於 Focus 狀態 */
  readonly focused: boolean;

  /** 該控制項是否為空值 */
  readonly empty: boolean;

  /** 該控制項是否處於錯誤狀態 (通常是 invalid && touched) */
  readonly errorState: boolean;

  /**
   * 識別當前元件的類型 (非常重要！)
   * 例如: 'input', 'textarea', 'switch', 'select'
   */
  readonly controlType: FieldType;

  /** 該控制項是否被禁用 */
  readonly disabled: boolean;

  /** 該控制項是否為必填 */
  readonly required: boolean;

  /** (可選) 接收外部傳來的 IDs，用於設定 aria-describedby */
  setDescribedByIds?(ids: string[]): void;

  /** 提供外部 Focus 該元件的方法 */
  focus(options?: FocusOptions): void;
}

export const SANRING_FIELD_CONTROL = new InjectionToken<SanringFieldControl>('SanringFieldControl');
