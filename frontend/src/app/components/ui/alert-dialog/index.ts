export * from './alert-dialog.service';
export * from './alert-dialog-action.directive';
export * from './alert-dialog-cancel.directive';
export * from './alert-dialog-content.component';
export * from './alert-dialog-trigger.directive';

export {
  DialogDescriptionDirective,
  DialogFooterComponent,
  DialogHeaderComponent,
  DialogMediaComponent,
  DialogTitleDirective,
} from '../dialog';

import { AlertDialogActionDirective } from './alert-dialog-action.directive';
import { AlertDialogCancelDirective } from './alert-dialog-cancel.directive';
import { AlertDialogContentComponent } from './alert-dialog-content.component';
import { AlertDialogTriggerDirective } from './alert-dialog-trigger.directive';
import {
  DialogDescriptionDirective,
  DialogFooterComponent,
  DialogHeaderComponent,
  DialogMediaComponent,
  DialogTitleDirective,
} from '../dialog';

export const SANRING_ALERT_DIALOG_IMPORTS = [
  AlertDialogTriggerDirective,
  AlertDialogContentComponent,
  DialogHeaderComponent,
  DialogMediaComponent,
  DialogTitleDirective,
  DialogDescriptionDirective,
  DialogFooterComponent,
  AlertDialogActionDirective,
  AlertDialogCancelDirective,
];
