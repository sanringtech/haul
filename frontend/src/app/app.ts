import { Component, signal } from '@angular/core';
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

/** Mirrors backend/Models/UsageSummary.cs (camelCase on the wire, see Program.cs jsonOptions). */
interface UsageSummary {
  source: string;
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
}

/** One progress row's worth of data, built from either the primary or secondary window fields. */
interface UsageWindow {
  label: string | null;
  percent: number | null;
  state: UsageState;
  detail: string | null;
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

  /** In-progress API key text per source, keyed by source id (constitution R2: api_key sources only). */
  protected readonly draftApiKeys = signal<Record<string, string>>({});

  /** Which source is mid "取消追蹤" confirmation (constitution §8: must be a deliberate 2-step action). */
  protected readonly pendingRemoval = signal<string | null>(null);

  constructor() {
    window.external?.receiveMessage?.((message) => this.onHostMessage(message));
  }

  protected refresh(): void {
    this.send({ type: 'get-usage-summary' });
  }

  protected onApiKeyInput(sourceId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draftApiKeys.update((keys) => ({ ...keys, [sourceId]: value }));
  }

  protected addSource(sourceId: string): void {
    const apiKey = this.draftApiKeys()[sourceId]?.trim();
    if (!apiKey) {
      this.lastError.set('請先輸入 API key');
      return;
    }
    this.send({ type: 'add-source', source: sourceId, credential: { apiKey } });
    this.draftApiKeys.update((keys) => ({ ...keys, [sourceId]: '' }));
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
      const payload = JSON.parse(raw) as { type: string; data?: UsageSummary[]; error?: string };
      if (payload.type === 'usage-summary' && payload.data) {
        this.summaries.set(payload.data);
        this.lastError.set(null);
        this.lastRefreshedAt.set(payload.data[0]?.asOf ?? null);
      } else if (payload.error) {
        this.lastError.set(payload.error);
      }
    } catch {
      this.lastError.set(`收到無法解析的訊息: ${raw}`);
    }
  }
}
