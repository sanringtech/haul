export * from './popover.component';
export * from './popover-content.component';
export * from './popover-header.component';
export * from './popover-title.component';
export * from './popover-description.component';
export * from './popover-trigger.directive';
export * from './popover.type';

// 便利陣列：imports: [SANRING_POPOVER_IMPORTS] 一行搞定
import { PopoverComponent } from './popover.component';
import { PopoverContentComponent } from './popover-content.component';
import { PopoverHeaderComponent } from './popover-header.component';
import { PopoverTitleComponent } from './popover-title.component';
import { PopoverDescriptionComponent } from './popover-description.component';
import { PopoverTriggerDirective } from './popover-trigger.directive';

export const SANRING_POPOVER_IMPORTS = [
  PopoverComponent,
  PopoverContentComponent,
  PopoverHeaderComponent,
  PopoverTitleComponent,
  PopoverDescriptionComponent,
  PopoverTriggerDirective,
];
