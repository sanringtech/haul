import {
  ChangeDetectionStrategy,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { cn, uniqueId } from '../shared/utils';
import { SANRING_FIELD_CONTROL } from './field.type';

const LABEL_BACKGROUND_VAR = '--sanring-field-label-background';

// 找出離 host 最近、有實際不透明 background-color 的祖先，當作 floating label 缺口色塊的底色
function findAmbientBackground(el: HTMLElement): string | null {
  let current = el.parentElement;
  while (current) {
    const { backgroundColor } = getComputedStyle(current);
    if (
      backgroundColor &&
      backgroundColor !== 'transparent' &&
      !/^rgba\(0, 0, 0, 0\)$/.test(backgroundColor)
    ) {
      return backgroundColor;
    }
    current = current.parentElement;
  }
  return null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'sanring-field',
  standalone: true,
  host: {
    '[id]': 'id()',
    '[class]': 'fieldClass()',
  },
  template: `
    <!-- 注意：同一個 select 字串不能同時出現在 @if 跟 @else 兩個分支裡——沒有渲染的那個分支會把內容
         「卡」走，導致實際渲染的分支反而是空的 (Angular content projection 的 bucket 是整份 template
         靜態決定，不分 branch)。所以這裡兩個 <ng-content> 各自只出現一次，用 CSS 的 display:contents
         切換排版：floating 時當一般 relative 容器；非 floating 時讓這層 wrapper 從版面上「消失」，
         label/input 直接變成 Field 自己 flex-col 的 item，等同原本沒有 wrapper 的行為。
         label 用 absolute 定位不受 DOM 順序影響 (positioned 元素的疊層永遠蓋在 static 元素之上)，
         所以 label 寫在前面即可同時滿足「非 floating 時 label 要先出現」跟「floating 時疊在 input 上」 -->
    <div [class]="controlWrapperClass()">
      <ng-content select="[sanringLabel]"></ng-content>
      <ng-content select="[sanringInput]"></ng-content>
    </div>
    <ng-content select="[sanringDescription], sanring-error-message"></ng-content>
    <!-- 其餘沒有對到上面 selector 的內容，維持原本最單純的投影 -->
    <ng-content></ng-content>
  `,
})
export class SanringFieldComponent {
  // 產生這組 Field 專屬的 ID 前綴
  readonly id = input(uniqueId('sanring-field'));

  readonly class = input<string | undefined>();

  // 是否使用 floating label 排版（label 從 input 內部浮到上方）
  readonly floating = input(false, { transform: booleanAttribute });

  // 非 floating 時用 display:contents 讓這層 wrapper 從版面消失，行為等同沒有 wrapper
  protected readonly controlWrapperClass = computed(() =>
    this.floating() ? 'relative flex items-center' : 'contents',
  );

  // 抓取投影進來的 Input / Select / Switch
  readonly control = contentChild(SANRING_FIELD_CONTROL);

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // Description / ErrorMessage 會透過 registerDescribedBy 把自己的 id 掛進來
  private readonly describedByIds = signal<readonly string[]>([]);

  // control 上的 disabled/required/focused/empty/errorState 都是 plain getter，不是 signal，
  // 靠這個計數器把 stateChanges (Observable) 橋接進 signal graph，下面的 computed 才會正確重算
  private readonly stateVersion = signal(0);

  readonly hasError = computed(() => {
    this.stateVersion();
    return this.control()?.errorState ?? false;
  });

  readonly isDisabled = computed(() => {
    this.stateVersion();
    return this.control()?.disabled ?? false;
  });

  readonly isRequired = computed(() => {
    this.stateVersion();
    return this.control()?.required ?? false;
  });

  readonly isFocused = computed(() => {
    this.stateVersion();
    return this.control()?.focused ?? false;
  });

  readonly isEmpty = computed(() => {
    this.stateVersion();
    return this.control()?.empty ?? false;
  });

  // 根據錯誤狀態動態調整外層 class（可依需求擴充）
  protected readonly fieldClass = computed(() =>
    cn(
      'group relative flex flex-col gap-2',
      // 留出空間給 floating label 往上飄出時不會被上面裁切
      this.floating() && 'pt-3 is-floating',
      this.hasError() && 'is-error', // 加上 is-error 標記，方便子元件寫 CSS
      this.isDisabled() && 'is-disabled',
      this.isRequired() && 'is-required',
      this.isFocused() && 'is-focused',
      this.isEmpty() && 'is-empty',
      this.class(),
    ),
  );

  constructor() {
    // 隨 control() 變動重新綁定：投影的 control 換掉時，訂閱也會跟著換掉
    effect((onCleanup) => {
      const ctrl = this.control();
      if (!ctrl) return;

      this.stateVersion.update((v) => v + 1);

      const subscription = ctrl.stateChanges.subscribe(() =>
        this.stateVersion.update((v) => v + 1),
      );
      onCleanup(() => subscription.unsubscribe());
    });

    // 把收集到的 describedByIds 同步給 control，讓 input 產生正確的 aria-describedby
    effect(() => {
      this.control()?.setDescribedByIds?.([...this.describedByIds()]);
    });

    // floating label 的缺口色塊需要知道「外部背景」是什麼色，這裡自動偵測，只在渲染完成後跑一次：
    // 1. 如果開發者已經手動覆寫過 --sanring-field-label-background（不管是在這個元素或祖先層級），
    //    getComputedStyle 讀到的值就不會是空字串，這時完全不動它，手動指定的優先權永遠比自動偵測高。
    // 2. 沒有手動覆寫時，才往上找第一個有實際 (非透明) background-color 的祖先當作偵測結果。
    // 限制：只認得出單色 background-color，抓不到漸層/圖片背景；且只在初次渲染後跑一次，
    // 之後如果外部背景動態改變 (例如切換 dark/light 主題) 不會自動重新偵測。
    afterNextRender(() => {
      if (!this.floating()) return;

      const hostEl = this.elementRef.nativeElement;
      const alreadyOverridden = getComputedStyle(hostEl)
        .getPropertyValue(LABEL_BACKGROUND_VAR)
        .trim();
      if (alreadyOverridden) return;

      const detected = findAmbientBackground(hostEl);
      if (detected) {
        hostEl.style.setProperty(LABEL_BACKGROUND_VAR, detected);
      }
    });
  }

  // 提供給 Description / ErrorMessage 註冊/取消自己的 id
  registerDescribedBy(id: string) {
    this.describedByIds.update((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }

  unregisterDescribedBy(id: string) {
    this.describedByIds.update((ids) => ids.filter((existing) => existing !== id));
  }

  // 提供給內部 Label 取得對應的 Input ID
  get inputId(): string {
    return this.control()?.id || `${this.id()}-input`;
  }
}
