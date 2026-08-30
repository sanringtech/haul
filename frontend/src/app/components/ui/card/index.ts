export * from './card.component';
export * from './card-content.component';
export * from './card-footer.component';
export * from './card-header.component';
export * from './card-description.directive';
export * from './card-title.directive';

import { CardContentComponent } from './card-content.component';
import { CardDescriptionDirective } from './card-description.directive';
import { CardFooterComponent } from './card-footer.component';
import { CardHeaderComponent } from './card-header.component';
import { CardTitleDirective } from './card-title.directive';
import { CardComponent } from './card.component';

export const SANRING_CARD_IMPORTS = [
  CardComponent,
  CardHeaderComponent,
  CardTitleDirective,
  CardDescriptionDirective,
  CardContentComponent,
  CardFooterComponent,
];
