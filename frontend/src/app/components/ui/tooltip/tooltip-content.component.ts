import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import {
  ConnectedOverlayPositionChange,
  ConnectionPositionPair,
  OverlayModule,
} from '@angular/cdk/overlay';
import { cn } from '../shared/utils';
import { TOOLTIP_ARROW_CLASS, TOOLTIP_SURFACE_CLASS } from './tooltip.styles';
import { TooltipComponent } from './tooltip.component';
import { TooltipSide } from './tooltip.type';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-tooltip-content',
  standalone: true,
  imports: [OverlayModule],
  template: `
    @if (tooltip.triggerOrigin(); as origin) {
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="tooltip.isOpen()"
        [cdkConnectedOverlayPositions]="positions"
        [cdkConnectedOverlayPush]="true"
        [cdkConnectedOverlayViewportMargin]="8"
        (overlayKeydown)="handleOverlayKeydown($event)"
        (positionChange)="handlePositionChange($event)"
      >
        <div
          [id]="tooltip.contentId"
          [class]="tooltipContentClass()"
          [attr.data-side]="renderedSide()"
          role="tooltip"
        >
          <ng-content></ng-content>
          <span [class]="tooltipArrowClass()" aria-hidden="true"></span>
        </div>
      </ng-template>
    }
  `,
  // 💡 整個 styles 區塊都刪除了，保持元件極致乾淨
})
export class TooltipContentComponent {
  readonly class = input<string | undefined>();
  readonly side = input<TooltipSide>('top');
  readonly sideOffset = input(6, { transform: numberAttribute });

  protected tooltip = inject(TooltipComponent);

  positions: ConnectionPositionPair[] = [];
  protected renderedSide = signal<TooltipSide>(this.side());

  protected readonly tooltipContentClass = computed(() =>
    cn(
      TOOLTIP_SURFACE_CLASS,
      'animate-in fade-in-0 zoom-in-95',
      'data-[side=bottom]:slide-in-from-top-2',
      'data-[side=left]:slide-in-from-right-2',
      'data-[side=right]:slide-in-from-left-2',
      'data-[side=top]:slide-in-from-bottom-2',

      this.class(),
    ),
  );
  protected readonly tooltipArrowClass = computed(() =>
    cn(
      TOOLTIP_ARROW_CLASS,
      this.renderedSide() === 'top' && '-bottom-1 left-1/2 -translate-x-1/2 border-l-0 border-t-0',
      this.renderedSide() === 'bottom' && '-top-1 left-1/2 -translate-x-1/2 border-b-0 border-r-0',
      this.renderedSide() === 'left' && '-right-1 top-1/2 -translate-y-1/2 border-b-0 border-l-0',
      this.renderedSide() === 'right' && '-left-1 top-1/2 -translate-y-1/2 border-r-0 border-t-0',
    ),
  );

  constructor() {
    effect(() => {
      this.updatePositions(this.side(), this.sideOffset());
    });
  }

  private updatePositions(side: TooltipSide, sideOffset: number) {
    this.positions = this.getPositions(side, sideOffset);
    this.renderedSide.set(side);
  }

  protected handlePositionChange(event: ConnectedOverlayPositionChange) {
    this.renderedSide.set(this.getSideFromPosition(event.connectionPair));
  }

  protected handleOverlayKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.tooltip.hide();
  }

  private getPositions(side: TooltipSide, offset: number): ConnectionPositionPair[] {
    const topPair: ConnectionPositionPair = {
      originX: 'center',
      originY: 'top',
      overlayX: 'center',
      overlayY: 'bottom',
      offsetY: -offset,
    };
    const bottomPair: ConnectionPositionPair = {
      originX: 'center',
      originY: 'bottom',
      overlayX: 'center',
      overlayY: 'top',
      offsetY: offset,
    };
    const rightPair: ConnectionPositionPair = {
      originX: 'end',
      originY: 'center',
      overlayX: 'start',
      overlayY: 'center',
      offsetX: offset,
    };
    const leftPair: ConnectionPositionPair = {
      originX: 'start',
      originY: 'center',
      overlayX: 'end',
      overlayY: 'center',
      offsetX: -offset,
    };

    switch (side) {
      case 'top':
        return [topPair, bottomPair, rightPair, leftPair];
      case 'bottom':
        return [bottomPair, topPair, rightPair, leftPair];
      case 'right':
        return [rightPair, leftPair, topPair, bottomPair];
      case 'left':
        return [leftPair, rightPair, topPair, bottomPair];
      default:
        return [topPair, bottomPair];
    }
  }

  private getSideFromPosition(position: ConnectionPositionPair): TooltipSide {
    // ... (維持你原本的邏輯) ...
    if (position.originY === 'top' && position.overlayY === 'bottom') return 'top';
    if (position.originY === 'bottom' && position.overlayY === 'top') return 'bottom';
    if (position.originX === 'end' && position.overlayX === 'start') return 'right';
    return 'left';
  }

}
