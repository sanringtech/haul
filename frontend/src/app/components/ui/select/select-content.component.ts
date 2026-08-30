import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  booleanAttribute,
  computed,
  contentChildren,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FocusKeyManager } from '@angular/cdk/a11y';
import {
  CdkConnectedOverlay,
  ConnectionPositionPair,
  Overlay,
  OverlayModule,
} from '@angular/cdk/overlay';
import { SelectComponent } from './select.component';
import { SelectContentPosition } from './select.type';
import { SelectItemComponent } from './select-item.component';
import { cn } from '../shared/utils';
import { OVERLAY_SURFACE_CLASS } from '../shared/component-styles';

const SELECT_CONTENT_GAP = 4;

const SELECT_CONTENT_POSITIONS: ConnectionPositionPair[] = [
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
    offsetY: SELECT_CONTENT_GAP,
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetY: -SELECT_CONTENT_GAP,
  },
];

const SELECT_ITEM_ALIGNED_POSITIONS: ConnectionPositionPair[] = [
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'top',
  },
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'bottom',
  },
];

@Component({
  selector: 'sanring-select-content',
  standalone: true,
  imports: [OverlayModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (select.triggerOrigin; as origin) {
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="select.isOpen()"
        [cdkConnectedOverlayPositions]="positions()"
        [cdkConnectedOverlayOffsetY]="offsetY()"
        [cdkConnectedOverlayMatchWidth]="matchTriggerWidth()"
        [cdkConnectedOverlayUsePopover]="null"
        [cdkConnectedOverlayPush]="true"
        [cdkConnectedOverlayViewportMargin]="8"
        [cdkConnectedOverlayScrollStrategy]="scrollStrategy"
        (attach)="handleAttach()"
        (overlayOutsideClick)="close()"
        (detach)="close()"
        (overlayKeydown)="handleOverlayKeydown($event)"
      >
        <div
          #content
          role="listbox"
          tabindex="-1"
          [id]="select.contentId"
          [attr.data-state]="select.isOpen() ? 'open' : 'closed'"
          [class]="contentClass()"
        >
          <ng-content></ng-content>
        </div>
      </ng-template>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class SelectContentComponent {
  protected readonly select = inject(SelectComponent);
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);

  private readonly connectedOverlay = viewChild(CdkConnectedOverlay);
  private readonly contentRef = viewChild<ElementRef<HTMLElement>>('content');

  readonly class = input<string | undefined>();
  readonly position = input<SelectContentPosition>('popper');
  readonly matchTriggerWidth = input(false, { transform: booleanAttribute });

  // DOM-order content children, handed to a FocusKeyManager so ArrowUp/ArrowDown move real
  // focus between options (previously Arrow keys only opened the trigger — see
  // COMPONENT_AUDIT.md's Batch 1 Findings for `select`).
  private readonly items = contentChildren(SelectItemComponent, { descendants: true });
  private readonly keyManager = new FocusKeyManager(this.items, this.injector)
    .withWrap()
    .withVerticalOrientation()
    .skipPredicate((item) => item.disabled);

  private readonly itemAlignedOffsetY = signal(0);

  protected readonly positions = computed(() =>
    this.position() === 'item-aligned' ? SELECT_ITEM_ALIGNED_POSITIONS : SELECT_CONTENT_POSITIONS,
  );
  protected readonly offsetY = computed(() =>
    this.position() === 'item-aligned' ? -this.itemAlignedOffsetY() : 0,
  );
  protected readonly scrollStrategy = this.overlay.scrollStrategies.close();

  protected readonly contentClass = computed(() =>
    cn(
      OVERLAY_SURFACE_CLASS,
      'z-50 max-h-96 min-w-32 overflow-y-auto rounded-[var(--sanring-radius-sm)] p-1.5 outline-none',
      this.matchTriggerWidth() ? 'w-full' : undefined,
      'animate-popover-in',
      this.class(),
    ),
  );

  protected close(): void {
    this.select.setOpen(false);
    this.itemAlignedOffsetY.set(0);
  }

  protected handleAttach(): void {
    queueMicrotask(() => {
      if (this.position() === 'item-aligned') {
        const selectedItem =
          this.contentRef()?.nativeElement.querySelector<HTMLElement>('[data-state="checked"]');
        this.itemAlignedOffsetY.set(selectedItem?.offsetTop ?? 0);
        this.connectedOverlay()?.overlayRef.updatePosition();
      }

      this.focusInitialItem();
    });
  }

  // Moves real DOM focus onto the currently-selected option (or the first enabled one) as
  // soon as the listbox is on screen, so keyboard users land somewhere navigable instead of
  // having to Tab in from the trigger.
  private focusInitialItem(): void {
    const items = this.items();
    if (items.length === 0) return;

    const selected = items.find((item) => item.value() === this.select.selectedValue());
    const target = selected && !selected.disabled ? selected : items.find((item) => !item.disabled);
    if (target) this.keyManager.setActiveItem(target);
  }

  protected handleOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      // Escape is keyboard-initiated, so restore focus to the trigger — matching
      // selectValue()'s reasoning. Outside-click close deliberately does NOT do this
      // (see close()); the click's own target should keep focus.
      this.select.focus();
      return;
    }

    if (event.key === 'Tab') {
      this.close();
      return;
    }

    this.keyManager.onKeydown(event);
  }
}
