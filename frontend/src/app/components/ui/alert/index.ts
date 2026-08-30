export * from './alert.type';
export * from './alert.component';
export * from './alert-description.directive';
export * from './alert-title.directive';

import { AlertDescriptionDirective } from './alert-description.directive';
import { AlertTitleDirective } from './alert-title.directive';
import { AlertComponent } from './alert.component';

export const SANRING_ALERT_IMPORTS = [
  AlertComponent,
  AlertTitleDirective,
  AlertDescriptionDirective,
];
