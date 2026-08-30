export * from './dialog.service';
export * from './dialog-close.directive';
export * from './dialog-content.component';
export * from './dialog-description.directive';
export * from './dialog-footer.component';
export * from './dialog-header.component';
export * from './dialog-media.component';
export * from './dialog-title.directive';
export * from './dialog-trigger.directive';

import { DialogCloseDirective } from './dialog-close.directive';
import { DialogContentComponent } from './dialog-content.component';
import { DialogDescriptionDirective } from './dialog-description.directive';
import { DialogFooterComponent } from './dialog-footer.component';
import { DialogHeaderComponent } from './dialog-header.component';
import { DialogMediaComponent } from './dialog-media.component';
import { DialogTitleDirective } from './dialog-title.directive';
import { DialogTriggerDirective } from './dialog-trigger.directive';

export const SANRING_DIALOG_IMPORTS = [
  DialogTriggerDirective,
  DialogContentComponent,
  DialogHeaderComponent,
  DialogMediaComponent,
  DialogTitleDirective,
  DialogDescriptionDirective,
  DialogFooterComponent,
  DialogCloseDirective,
];
