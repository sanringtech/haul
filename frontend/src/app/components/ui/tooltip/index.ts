export * from './tooltip-content.component';
export * from './tooltip-trigger.directive';
export * from './tooltip.component';
export * from './tooltip.type';

import { TooltipContentComponent } from './tooltip-content.component';
import { TooltipTriggerDirective } from './tooltip-trigger.directive';
import { TooltipComponent } from './tooltip.component';

export const SANRING_TOOLTIP_IMPORTS = [
  TooltipComponent,
  TooltipTriggerDirective,
  TooltipContentComponent,
];
