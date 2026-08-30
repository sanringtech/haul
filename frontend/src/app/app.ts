import { Component, computed, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ButtonDirective } from './components/ui/button';
import { BadgeDirective } from './components/ui/badge';
import { ProgressComponent } from './components/ui/progress';
import { InputDirective } from './components/ui/input';
import { SANRING_CARD_IMPORTS } from './components/ui/card';
import { SANRING_ALERT_IMPORTS } from './components/ui/alert';
import { SpinnerComponent } from './components/ui/spinner';
import { SkeletonDirective } from './components/ui/skeleton';
import { SANRING_TOOLTIP_IMPORTS } from './components/ui/tooltip';

declare global {
  // lib.dom.d.ts already declares `Window.external: External`. Photino.NET
  // injects these two methods onto it at runtime; merge them in rather than
  // redeclaring `external` itself (that would conflict with the DOM lib).
  interface External {
    sendMessage?: (message: string) => void;
    receiveMessage?: (callback: (message: string) => void) => void;
  }
}

type SourceType = 'subscription' | 'api_key';
type UsageState = 'normal' | 'near_limit' | 'exceeded' | 'unknown';
type ConnectionState = 'not_configured' | 'valid' | 'invalid' | 'expired';
type View = 'list' | 'add';
type AddStatus = 'idle' | 'pending' | 'success' | 'error';

/** Mirrors backend/Models/UsageSummary.cs (camelCase on the wire, see Program.cs jsonOptions). */
interface UsageSummary {
  /** Now an accountId, not a bare sourceId — unique per tracked account (multi-account support). */
  source: string;
  /** AI 類型顯示名稱（例如 "DeepSeek"）— 卡片主標題，同類型的每個帳號都一樣。 */
  displayName: string;
  sourceType: SourceType;
  percentUsed: number | null;
  usageState: UsageState;
  connectionState: ConnectionState;
  isEstimated: boolean;
  asOf: string;
  detail: string | null;
  /** Set when a source has more than one quota window (Claude: 5h + 7d) — see backend for why. */
  percentUsedLabel: string | null;
  secondaryPercentUsed: number | null;
  secondaryUsageState: UsageState | null;
  secondaryPercentUsedLabel: string | null;
  secondaryDetail: string | null;
  /** 帳號副標題（例如 "DeepSeek #2"）——null 時代表這個來源目前只有單一帳號，不用另外標示。 */
  accountLabel: string | null;
}

/** One progress row's worth of data, built from either the primary or secondary window fields. */
interface UsageWindow {
  label: string | null;
  percent: number | null;
  state: UsageState;
  detail: string | null;
}

/** Mirrors backend's SourceCatalogEntry — the fixed set of known provider types, tracked or not. */
interface CatalogEntry {
  sourceId: string;
  displayName: string;
  sourceType: SourceType;
  isTracked: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ButtonDirective,
    BadgeDirective,
    ProgressComponent,
    InputDirective,
    SpinnerComponent,
    SkeletonDirective,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ...SANRING_CARD_IMPORTS,
    ...SANRING_ALERT_IMPORTS,
    ...SANRING_TOOLTIP_IMPORTS,
  ],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('SanRing Usage Monitor');
  protected readonly isDesktopHost = signal(typeof window.external?.sendMessage === 'function');
  protected readonly summaries = signal<UsageSummary[]>([]);
  protected readonly lastError = signal<string | null>(null);
  protected readonly isLoading = signal(false);
  /** Shown once next to the refresh button instead of once per card — every card's `asOf` is effectively the same refresh instant. */
  protected readonly lastRefreshedAt = signal<string | null>(null);

  /** Which source is mid "取消追蹤" confirmation (constitution §8: must be a deliberate 2-step action). */
  protected readonly pendingRemoval = signal<string | null>(null);

  /** Which account's label is currently showing an edit input, and its in-progress value. */
  protected readonly editingLabelAccountId = signal<string | null>(null);
  protected readonly editingLabelValue = signal('');

  // ── "＋ 新增來源" flow state ──────────────────────────────────────────
  protected readonly view = signal<View>('list');
  protected readonly catalog = signal<CatalogEntry[]>([]);
  protected readonly addSelectedSourceId = signal<string | null>(null);
  protected readonly addApiKey = signal('');
  protected readonly addStatus = signal<AddStatus>('idle');
  protected readonly addResultMessage = signal<string | null>(null);

  protected readonly addSelectedEntry = computed(
    () => this.catalog().find((c) => c.sourceId === this.addSelectedSourceId()) ?? null,
  );

  /** 新增畫面第一層改用「存取類型」分兩區顯示，而不是每一項各自掛 hover 說明。 */
  protected readonly catalogBySubscription = computed(() => this.catalog().filter((c) => c.sourceType === 'subscription'));
  protected readonly catalogByApiKey = computed(() => this.catalog().filter((c) => c.sourceType === 'api_key'));

  constructor() {
    window.external?.receiveMessage?.((message) => this.onHostMessage(message));
  }

  protected refresh(): void {
    this.send({ type: 'get-usage-summary' });
  }

  protected openAddView(): void {
    this.view.set('add');
    this.addSelectedSourceId.set(null);
    this.addApiKey.set('');
    this.addStatus.set('idle');
    this.addResultMessage.set(null);
    this.send({ type: 'get-catalog' });
  }

  protected closeAddView(): void {
    this.view.set('list');
  }

  protected selectAddSource(sourceId: string): void {
    this.addSelectedSourceId.set(sourceId);
    this.addApiKey.set('');
    this.addStatus.set('idle');
    this.addResultMessage.set(null);
  }

  protected resetAddSelection(): void {
    this.addSelectedSourceId.set(null);
    this.addStatus.set('idle');
    this.addResultMessage.set(null);
  }

  protected onAddApiKeyInput(event: Event): void {
    this.addApiKey.set((event.target as HTMLInputElement).value);
  }

  /** API key 制：真的送出金鑰驗證。訂閱制：沒有東西好打，這顆按鈕只是「開始偵測本機」。 */
  protected submitAdd(): void {
    const entry = this.addSelectedEntry();
    if (!entry) return;

    if (entry.sourceType === 'api_key' && !this.addApiKey().trim()) {
      this.addStatus.set('error');
      this.addResultMessage.set('請先輸入 API key');
      return;
    }

    this.addStatus.set('pending');
    this.addResultMessage.set(null);
    const apiKey = entry.sourceType === 'api_key' ? this.addApiKey().trim() : undefined;
    this.send({ type: 'add-source', source: entry.sourceId, credential: apiKey ? { apiKey } : undefined });
  }

  /** First click arms the confirmation, second click (on the same source) actually removes it. */
  protected requestRemove(sourceId: string): void {
    if (this.pendingRemoval() === sourceId) {
      this.send({ type: 'remove-source', source: sourceId });
      this.pendingRemoval.set(null);
    } else {
      this.pendingRemoval.set(sourceId);
    }
  }

  protected cancelRemove(): void {
    this.pendingRemoval.set(null);
  }

  /** 點名稱進入編輯：預填畫面上目前顯示的文字（自訂標籤，沒有的話就是 displayName 本身，例如 "Codex"）。 */
  protected startRename(item: UsageSummary): void {
    this.editingLabelAccountId.set(item.source);
    this.editingLabelValue.set(item.accountLabel ?? item.displayName);
  }

  protected onRenameInput(event: Event): void {
    this.editingLabelValue.set((event.target as HTMLInputElement).value);
  }

  /** Enter 確定、Escape 放棄，跟其他輸入框行為一致。 */
  protected onRenameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitRename();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRename();
    }
  }

  /** 空字串＝清除標籤，回到只顯示 displayName。 */
  protected commitRename(): void {
    const accountId = this.editingLabelAccountId();
    if (!accountId) return;
    const label = this.editingLabelValue().trim();
    this.editingLabelAccountId.set(null);
    this.send({ type: 'rename-account', source: accountId, label: label || null });
  }

  protected cancelRename(): void {
    this.editingLabelAccountId.set(null);
  }

  /** 拖放結束：本地先重排（拖曳當下要立即看到效果），再把新順序整批送回後端持久化。 */
  protected onDrop(event: CdkDragDrop<UsageSummary[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const reordered = [...this.summaries()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.summaries.set(reordered);
    this.send({ type: 'reorder-accounts', order: reordered.map((item) => item.source) });
  }

  /** 憲法 §4：連線狀態 有效=綠 / 失效=橘 / 過期=紅 / 尚未設定=灰 — 用 sanring badge-* 語意色 token。 */
  protected connectionDotClass(state: ConnectionState): string {
    return (
      {
        valid: 'bg-[var(--sanring-badge-online)]',
        invalid: 'bg-[var(--sanring-badge-away)]',
        expired: 'bg-[var(--sanring-badge-busy)]',
        not_configured: 'bg-[var(--sanring-badge-offline)]',
      } satisfies Record<ConnectionState, string>
    )[state];
  }

  /** 憲法 §4：用量狀態 正常=綠(0-80%) / 接近上限=橘(80-99%) / 超額=紅(100%) — badge 覆寫色。 */
  protected usageBadgeClass(state: UsageState): string {
    return (
      {
        normal: 'border-transparent bg-[var(--sanring-success-50)] text-white',
        near_limit: 'border-transparent bg-[var(--sanring-warn-50)] text-[var(--sanring-warn-90)]',
        exceeded: 'border-transparent bg-[var(--sanring-error-50)] text-white',
        unknown: 'border-transparent bg-[var(--sanring-neutral-30)] text-[var(--sanring-neutral-90)]',
      } satisfies Record<UsageState, string>
    )[state];
  }

  /** 沒有百分比概念的來源（DeepSeek/Kimi 的絕對餘額）不畫假進度條，狀態改用文字 badge。 */
  protected usageStateLabel(state: UsageState): string {
    return (
      {
        normal: '正常',
        near_limit: '偏低',
        exceeded: '已用盡',
        unknown: '—',
      } satisfies Record<UsageState, string>
    )[state];
  }

  /** 同一組狀態，這次是 progress bar 的填色（用 CSS var，跟 badge 共用色階）。 */
  protected usageBarClass(state: UsageState): string {
    return (
      {
        normal: 'bg-[var(--sanring-success-50)]',
        near_limit: 'bg-[var(--sanring-warn-50)]',
        exceeded: 'bg-[var(--sanring-error-50)]',
        unknown: 'bg-[var(--sanring-neutral-40)]',
      } satisfies Record<UsageState, string>
    )[state];
  }

  /**
   * 卡片內容機械地依資料量顯示：1 個視窗的來源（Codex/DeepSeek/Kimi）只出現一行，
   * 2 個視窗的來源（Claude 的 5h+7d）就自然多一行——不特別針對某個 AI 寫死判斷式。
   */
  protected windows(item: UsageSummary): UsageWindow[] {
    const primary: UsageWindow = {
      label: item.percentUsedLabel,
      percent: item.percentUsed,
      state: item.usageState,
      detail: item.detail,
    };
    if (item.secondaryPercentUsedLabel === null) {
      return [primary];
    }
    return [
      primary,
      {
        label: item.secondaryPercentUsedLabel,
        percent: item.secondaryPercentUsed,
        state: item.secondaryUsageState ?? 'unknown',
        detail: item.secondaryDetail,
      },
    ];
  }

  private send(message: Record<string, unknown>): void {
    if (!this.isDesktopHost()) {
      this.lastError.set('未連接到桌面殼層（用 ng serve 純前端開發時無法呼叫 C# 後端）');
      return;
    }
    this.isLoading.set(true);
    window.external!.sendMessage!(JSON.stringify(message));
  }

  private onHostMessage(raw: string): void {
    this.isLoading.set(false);
    try {
      const payload = JSON.parse(raw) as {
        type: string;
        data?: UsageSummary[];
        catalog?: CatalogEntry[];
        error?: string;
      };

      if (payload.type === 'catalog' && payload.catalog) {
        this.catalog.set(payload.catalog);
        return;
      }

      // 新增來源的結果現在後端會單獨送一則（因為 API key 制的 accountId 是伺服器產生的 GUID，
      // 前端沒辦法從一般的清單裡用 sourceId 反查回「剛剛加的是哪一個」）。
      if (payload.type === 'account-added' && payload.data?.[0]) {
        const added = payload.data[0];
        if (added.connectionState === 'valid') {
          this.addStatus.set('success');
          this.addResultMessage.set(`已新增 ${added.accountLabel ?? added.displayName}`);
          // 讓使用者瞄到一眼「成功了」再切回去，不是完全無感跳轉，但也不用再多按一次確認。
          setTimeout(() => this.closeAddView(), 900);
        } else {
          this.addStatus.set('error');
          this.addResultMessage.set(added.detail ?? '新增失敗，原因不明');
        }
        return;
      }

      if (payload.type === 'usage-summary' && payload.data) {
        this.summaries.set(payload.data);
        this.lastError.set(null);
        this.lastRefreshedAt.set(payload.data[0]?.asOf ?? null);
        return;
      }

      if (payload.error) {
        this.lastError.set(payload.error);
      }
    } catch {
      this.lastError.set(`收到無法解析的訊息: ${raw}`);
    }
  }
}
