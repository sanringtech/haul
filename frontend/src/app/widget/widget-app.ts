import { Component, computed, effect, signal } from '@angular/core';
import { LucideArrowLeft, LucideX } from '@lucide/angular';
import { ButtonDirective } from '../components/ui/button';
import { BadgeDirective } from '../components/ui/badge';
import { ProgressComponent } from '../components/ui/progress';
import { Lang, LANG_STORAGE_KEY, Translations, translations } from '../i18n';
import { UsageState, UsageSummary } from '../shared/wire-types';

type Theme = 'dark' | 'light';
const THEME_STORAGE_KEY = 'sanring-usage-monitor:theme';

/** 跟 backend/Program.cs 的 widgetCollapsedSize/展開尺寸一一對應——改這裡要記得同步改那邊。 */
const COLLAPSED_SIZE = { width: 80, height: 80 };
const EXPANDED_SIZE = { width: 260, height: 180 };

/** 拖曳多少 px 算一次「切下一張」——太小容易誤觸，太大會覺得拖不動。 */
const SWIPE_THRESHOLD_PX = 40;

/**
 * 浮動小工具（獨立的 PhotinoWindow，見 backend/Program.cs 的 widgetWindow，`?mode=widget` 由
 * main.ts 分流到這個元件而不是 App）。收合時是一顆像素風小圖示，點開變成卡片堆疊，滑鼠拖曳
 * 左右切換卡片（不是滾輪），卡片順序沿用 TrackedAccounts 現有順序（跟主視窗拖曳排序共用同一份
 * 設定），不是這裡另外排。跟主視窗共用 i18n.ts/主題 token，因為兩個視窗載入的是同一份
 * index.html（file:// 同源），localStorage 是共用的。
 */
@Component({
  // 跟 App 用同一個 selector：index.html 只有一個 <app-root>，Photino 兩扇窗都載入同一份靜態
  // 檔案，main.ts 依 URL 決定 bootstrap 哪一個 component class，兩者不會同時存在，共用 selector安全。
  selector: 'app-root',
  standalone: true,
  imports: [ButtonDirective, BadgeDirective, ProgressComponent, LucideArrowLeft, LucideX],
  styleUrl: './widget-app.css',
  templateUrl: './widget-app.html',
})
export class WidgetApp {
  protected readonly isDesktopHost = signal(typeof window.external?.sendMessage === 'function');
  protected readonly summaries = signal<UsageSummary[]>([]);
  protected readonly collapsed = signal(true);
  protected readonly activeIndex = signal(0);

  /** 拖曳中的即時位移（px，上下），純視覺用，放開後歸零、由 activeIndex 決定實際換到哪張卡。 */
  private readonly dragState = signal<{ startY: number; currentY: number } | null>(null);
  protected readonly dragOffsetY = computed(() => {
    const s = this.dragState();
    return s ? s.currentY - s.startY : 0;
  });

  protected readonly theme = signal<Theme>(loadFromStorage(THEME_STORAGE_KEY, 'dark', ['dark', 'light']));
  protected readonly lang = signal<Lang>(loadFromStorage(LANG_STORAGE_KEY, 'zh-TW', ['zh-TW', 'en']));

  constructor() {
    window.external?.receiveMessage?.((message) => this.onHostMessage(message));

    effect(() => {
      const value = this.theme();
      if (value === 'dark') delete document.documentElement.dataset['theme'];
      else document.documentElement.dataset['theme'] = value;
    });

    // 收合/展開狀態一變就通知後端調整視窗大小（見 Program.cs 的 widget-resize）——這個視窗本身
    // 是 chromeless+transparent，展開只是「這扇窗變大」，不是開新視窗。
    effect(() => {
      const size = this.collapsed() ? COLLAPSED_SIZE : EXPANDED_SIZE;
      this.sendSilent({ type: 'widget-resize', width: size.width, height: size.height });
    });
  }

  protected readonly activeSummary = computed(() => this.summaries()[this.activeIndex()] ?? null);

  protected expand(): void {
    this.collapsed.set(false);
    // 每次展開才重新要一次資料——widget 平常收合著，不需要背景一直輪詢。
    this.send({ type: 'get-usage-summary' });
  }

  protected collapse(): void {
    this.collapsed.set(true);
  }

  protected openMainWindow(): void {
    this.sendSilent({ type: 'open-main-window' });
  }

  protected quit(): void {
    this.sendSilent({ type: 'quit-app' });
  }

  /**
   * 按在按鈕上（詳細/收合/結束）就直接放行，不進入拖曳狀態、也不 setPointerCapture——
   * 之前的 bug 就是這裡沒擋，卡片整個 capture 住指標，按鈕收不到自己的 click，點了沒反應。
   */
  protected onPointerDown(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('button')) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragState.set({ startY: event.clientY, currentY: event.clientY });
  }

  protected onPointerMove(event: PointerEvent): void {
    const s = this.dragState();
    if (!s) return;
    this.dragState.set({ ...s, currentY: event.clientY });
  }

  /** 往上拖＝下一張，往下拖＝上一張——跟把最上面那張卡片撥開看下一張的直覺一致。 */
  protected onPointerUp(): void {
    const s = this.dragState();
    this.dragState.set(null);
    if (!s) return;
    const delta = s.currentY - s.startY;
    if (delta <= -SWIPE_THRESHOLD_PX) this.next();
    else if (delta >= SWIPE_THRESHOLD_PX) this.previous();
  }

  private next(): void {
    this.activeIndex.update((i) => Math.min(i + 1, this.summaries().length - 1));
  }

  private previous(): void {
    this.activeIndex.update((i) => Math.max(i - 1, 0));
  }

  /** 疊在 active 卡片後面的下一張、下下張——只算視覺層次，不是真的疊圖片，見 template。 */
  protected stackPeek(offset: 1 | 2): UsageSummary | null {
    return this.summaries()[this.activeIndex() + offset] ?? null;
  }

  protected t(key: keyof Translations, params?: Record<string, string>): string {
    let text = translations[this.lang()][key];
    if (params) {
      for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, value);
    }
    return text;
  }

  protected usageBadgeClass(state: UsageState): string {
    return (
      {
        normal: 'border-transparent bg-[var(--sanring-success-50)] text-white',
        attention: 'border-transparent bg-[var(--sanring-warn-50)] text-[var(--sanring-warn-90)]',
        near_limit: 'border-transparent bg-[var(--sanring-caution-50)] text-[var(--sanring-caution-90)]',
        exceeded: 'border-transparent bg-[var(--sanring-error-50)] text-white',
        unknown: 'border-transparent bg-[var(--sanring-neutral-30)] text-[var(--sanring-neutral-90)]',
      } satisfies Record<UsageState, string>
    )[state];
  }

  protected usageBarClass(state: UsageState): string {
    return (
      {
        normal: 'bg-[var(--sanring-success-50)]',
        attention: 'bg-[var(--sanring-warn-50)]',
        near_limit: 'bg-[var(--sanring-caution-50)]',
        exceeded: 'bg-[var(--sanring-error-50)]',
        unknown: 'bg-[var(--sanring-neutral-40)]',
      } satisfies Record<UsageState, string>
    )[state];
  }

  private send(message: Record<string, unknown>): void {
    if (!this.isDesktopHost()) return;
    window.external!.sendMessage!(JSON.stringify(message));
  }

  /** widget-resize/open-main-window/quit-app 都不等回應（見 Program.cs，這三個 case 不回訊息）。 */
  private sendSilent(message: Record<string, unknown>): void {
    this.send(message);
  }

  private onHostMessage(raw: string): void {
    try {
      const payload = JSON.parse(raw) as { type: string; data?: UsageSummary[] };
      if (payload.type === 'usage-summary' && payload.data) {
        this.summaries.set(payload.data);
        this.activeIndex.set(0);
      }
    } catch {
      // widget 沒有地方顯示錯誤訊息（沒有主視窗那個 lastError alert 的空間），壞掉的訊息就單純略過。
    }
  }
}

function loadFromStorage<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const raw = localStorage.getItem(key);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}
