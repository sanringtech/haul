import { Component, computed, effect, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideChevronDown,
  LucideChevronUp,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideEye,
  LucideEyeOff,
  LucideGripVertical,
  LucideInfo,
  LucideMoon,
  LucidePlus,
  LucideRefreshCw,
  LucideSave,
  LucideSettings,
  LucideSun,
  LucideTrash2,
} from '@lucide/angular';
import { ButtonDirective } from './components/ui/button';
import { BadgeDirective } from './components/ui/badge';
import { ProgressComponent } from './components/ui/progress';
import { InputDirective } from './components/ui/input';
import { SliderComponent } from './components/ui/slider';
import { SANRING_CARD_IMPORTS } from './components/ui/card';
import { SANRING_ALERT_IMPORTS } from './components/ui/alert';
import { SANRING_ALERT_DIALOG_IMPORTS } from './components/ui/alert-dialog';
import { SpinnerComponent } from './components/ui/spinner';
import { SkeletonDirective } from './components/ui/skeleton';
import { SANRING_TOOLTIP_IMPORTS } from './components/ui/tooltip';
import { Lang, LANG_STORAGE_KEY, Translations, translations } from './i18n';
import { ConnectionState, HiddenAccountEntry, LocalizedMessage, SourceType, UsageState, UsageSummary } from './shared/wire-types';

type Theme = 'dark' | 'light';
const THEME_STORAGE_KEY = 'sanring-usage-monitor:theme';

type View = 'list' | 'add' | 'settings' | 'info';
type AddStatus = 'idle' | 'pending' | 'success' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved';

/** Mirrors backend's UsageService.UserSettings (camelCase on the wire). */
interface UserSettingsWire {
  refreshIntervalMinutes: number | null;
  retentionDays: number | null;
  nearLimitThresholdPercent: number;
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
    SliderComponent,
    SpinnerComponent,
    SkeletonDirective,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    LucideArrowLeft,
    LucideCheck,
    LucideChevronDown,
    LucideChevronUp,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideEye,
    LucideEyeOff,
    LucideGripVertical,
    LucideInfo,
    LucideMoon,
    LucidePlus,
    LucideRefreshCw,
    LucideSave,
    LucideSettings,
    LucideSun,
    LucideTrash2,
    ...SANRING_CARD_IMPORTS,
    ...SANRING_ALERT_IMPORTS,
    ...SANRING_ALERT_DIALOG_IMPORTS,
    ...SANRING_TOOLTIP_IMPORTS,
  ],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('sanring Haul');
  /** SSOT 是根目錄的 VERSION 檔——這裡是手動對齊的第四個點（跟 package.json/Info.plist 同一套
   *  取捨，見 RELEASE-PLAN.md「版本號」：三個地方還不到值得建自動同步 pipeline 的規模），改版時
   *  記得一起改。 */
  protected readonly appVersion = 'v0.1.0';
  protected readonly isDesktopHost = signal(typeof window.external?.sendMessage === 'function');
  protected readonly summaries = signal<UsageSummary[]>([]);
  protected readonly lastError = signal<string | null>(null);
  protected readonly isLoading = signal(false);
  /** Shown once next to the refresh button instead of once per card — every card's `asOf` is effectively the same refresh instant. */
  protected readonly lastRefreshedAt = signal<string | null>(null);

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

  // ── 設定頁（PRD M3）state ──────────────────────────────────────────
  // Active＝已儲存、實際生效的值；refreshIntervalMinutes 直接驅動下面建構子裡的自動刷新 timer。
  // Draft＝設定頁表單編輯中的值，按「儲存」才覆蓋 active（跟 add-source 畫面同一種「先在草稿改，
  // 送出才生效」模式，不是像主題/語言那種點一下就立即生效——這裡有滑桿，逐 pixel 就送出會洗版）。
  protected readonly refreshIntervalMinutes = signal<number | null>(60);
  protected readonly retentionDays = signal<number | null>(3);
  protected readonly nearLimitThresholdPercent = signal<number>(80);
  protected readonly draftRefreshInterval = signal<number | null>(60);
  protected readonly draftRetentionDays = signal<number | null>(3);
  protected readonly draftNearLimitThreshold = signal<number>(80);
  protected readonly settingsSaveStatus = signal<SaveStatus>('idle');

  /** 「已隱藏的來源」清單——放在主畫面清單底部（跟卡片同一個畫面，不是設定頁），預設收合。 */
  protected readonly hiddenAccounts = signal<HiddenAccountEntry[]>([]);
  protected readonly hiddenListExpanded = signal(false);

  // ── 主題 / 語言：跟 sanring-theme.css 的 data-theme 屬性同一套模式，signal 一改當場生效，
  //    不用重載視窗。兩者都存 localStorage，預設值刻意跟改功能前的既有行為一致（深色 + 繁中），
  //    沒設過偏好的舊使用者升級後畫面不會變。──────────────────────────────────────────
  protected readonly theme = signal<Theme>(loadFromStorage(THEME_STORAGE_KEY, 'dark', ['dark', 'light']));
  protected readonly lang = signal<Lang>(loadFromStorage(LANG_STORAGE_KEY, 'zh-TW', ['zh-TW', 'en']));

  constructor() {
    window.external?.receiveMessage?.((message) => this.onHostMessage(message));

    // :root 沒有 data-theme 屬性＝深色（見 sanring-theme.css 開頭註解），所以切回 dark 是移除屬性，
    // 不是設成 "dark" 字面值——跟 CSS 那邊的預設假設保持一致，不用另外在 CSS 補一份 [data-theme="dark"]。
    effect(() => {
      const value = this.theme();
      if (value === 'dark') {
        delete document.documentElement.dataset['theme'];
      } else {
        document.documentElement.dataset['theme'] = value;
      }
      saveToStorage(THEME_STORAGE_KEY, value);
    });

    effect(() => saveToStorage(LANG_STORAGE_KEY, this.lang()));

    // 自動刷新 timer——只依賴 refreshIntervalMinutes 這個 active 值，不是設定頁還在編輯中的
    // draft，所以在設定頁裡調整下拉選項不會提早生效，要按「儲存」才會真的改變刷新頻率。
    // null＝純手動（PRD/憲法 §9），不開 timer。
    effect((onCleanup) => {
      const minutes = this.refreshIntervalMinutes();
      if (minutes === null) return;
      const id = setInterval(() => this.refresh(), minutes * 60_000);
      onCleanup(() => clearInterval(id));
    });

    // 啟動時就要抓一次設定，不是只有打開設定頁才抓——不然自動刷新 timer 永遠只會用預設的
    // 60 分鐘，使用者上次存的值要等他自己點進設定頁才會套用，不合理。
    this.send({ type: 'get-settings' });
    // 「已隱藏的來源」現在是主畫面清單底部的一塊（不是設定頁），啟動時就要抓，不然清單一開始
    // 是空的，使用者不會知道有幾個帳號被隱藏、要去哪裡展開。
    this.send({ type: 'get-hidden-accounts' });
    // 用量本身原本要等自動刷新 timer 第一次觸發（預設 60 分鐘）或使用者自己按重新整理才會有資料
    // ——開機那段空窗期畫面顯示的是「還沒有追蹤任何來源」，明明有追蹤只是還沒抓，會誤導使用者。
    // 開機時主動打一次，跟按重新整理按鈕走同一條路（isLoading 一樣會亮，骨架屏正常顯示）。
    this.refresh();
  }

  protected toggleTheme(): void {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  protected toggleLang(): void {
    this.lang.set(this.lang() === 'zh-TW' ? 'en' : 'zh-TW');
  }

  /** 查目前語言的翻譯表，{key} 形式的 placeholder 用 params 替換——跟 usageStateLabel() 那類「依狀態查表」寫法同一套模式。 */
  protected t(key: keyof Translations, params?: Record<string, string>): string {
    let text = translations[this.lang()][key];
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, value);
      }
    }
    return text;
  }

  /**
   * 跟 t() 一樣的查表邏輯，只是輸入換成後端送來的 LocalizedMessage（見 backend/Models/LocalizedText.cs）
   * 而不是前端寫死的 key——後端 provider 產生的每一句訊息（錯誤、視窗標籤、重置時間）都走這條路，
   * 不是直接顯示後端組好的中文字串。key 是 string（來自 JSON，編譯期無法檢查跟 Translations 對不對得
   * 上），所以用 `as keyof Translations`；兩邊的 key 集合要人工保持一致，見 i18n.ts 開頭的提醒。
   */
  protected tm(msg: LocalizedMessage | null): string | null {
    if (msg === null) return null;
    return this.t(msg.key as keyof Translations, msg.params ?? undefined);
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

  /** 草稿預填目前 active 的值——不用另外打一次 get-settings，啟動時已經抓過了（見建構子）。 */
  protected openSettingsView(): void {
    this.view.set('settings');
    this.settingsSaveStatus.set('idle');
    this.draftRefreshInterval.set(this.refreshIntervalMinutes());
    this.draftRetentionDays.set(this.retentionDays());
    this.draftNearLimitThreshold.set(this.nearLimitThresholdPercent());
  }

  protected toggleHiddenList(): void {
    this.hiddenListExpanded.update((v) => !v);
  }

  protected closeSettingsView(): void {
    this.view.set('list');
  }

  /** 純靜態說明頁，不用打任何後端訊息——內容見 i18n.ts 的 info* 那組 key。 */
  protected openInfoView(): void {
    this.view.set('info');
  }

  protected closeInfoView(): void {
    this.view.set('list');
  }

  protected selectRefreshInterval(minutes: number | null): void {
    this.draftRefreshInterval.set(minutes);
  }

  protected selectRetentionDays(days: number | null): void {
    this.draftRetentionDays.set(days);
  }

  protected onNearLimitThresholdChange(value: number): void {
    this.draftNearLimitThreshold.set(value);
  }

  /** 存檔回應（'settings' 訊息）到達時才真的覆蓋 active 值，見 onHostMessage——不是這裡樂觀更新，
   * 因為閾值變動會連動一次完整刷新（見 Program.cs），active 值要跟後端回傳的卡片資料同步生效。 */
  protected saveSettings(): void {
    this.settingsSaveStatus.set('saving');
    this.send({
      type: 'update-settings',
      refreshIntervalMinutes: this.draftRefreshInterval(),
      retentionDays: this.draftRetentionDays(),
      nearLimitThresholdPercent: this.draftNearLimitThreshold(),
    });
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
      this.addResultMessage.set(this.t('pleaseEnterApiKey'));
      return;
    }

    this.addStatus.set('pending');
    this.addResultMessage.set(null);
    const apiKey = entry.sourceType === 'api_key' ? this.addApiKey().trim() : undefined;
    if (apiKey !== undefined) this.addApiKey.set(apiKey);
    this.send({ type: 'add-source', source: entry.sourceId, credential: apiKey ? { apiKey } : undefined });
  }

  /** Alert Dialog 已處理二次確認；只有彈窗的破壞性按鈕會呼叫這個方法。 */
  protected removeSource(sourceId: string): void {
    this.send({ type: 'remove-source', source: sourceId });
  }

  /**
   * 關閉顯示（憲法 §8）——跟「取消追蹤」是兩個獨立操作：資料/Keychain 憑證都不動，只是不再顯示。
   * 可逆、非破壞性，所以不用像取消追蹤那樣二次確認。本地先把卡片拿掉（樂觀更新），後端只是純
   * 設定異動，不觸發任何 provider 的即時 API（見 Program.cs 的 set-visibility case 註解）。
   */
  protected hideSource(accountId: string): void {
    this.summaries.set(this.summaries().filter((item) => item.source !== accountId));
    this.sendSilent({ type: 'set-visibility', source: accountId, visible: false });
  }

  /** 重新顯示：這張卡片沒有任何快取資料，要等後端整批刷新回來才會出現在主畫面，不是樂觀更新。 */
  protected unhideSource(accountId: string): void {
    this.hiddenAccounts.set(this.hiddenAccounts().filter((a) => a.accountId !== accountId));
    this.send({ type: 'set-visibility', source: accountId, visible: true });
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

  /**
   * 空字串＝清除標籤，回到只顯示 displayName。前端先樂觀更新畫面，後端只是把它寫進設定檔——
   * 不用等一輪完整刷新才看到新名字，也不需要為了改個名字重打任何 provider 的即時 API。
   */
  protected commitRename(): void {
    const accountId = this.editingLabelAccountId();
    if (!accountId) return;
    const label = this.editingLabelValue().trim() || null;
    this.editingLabelAccountId.set(null);
    this.summaries.set(this.summaries().map((item) => (item.source === accountId ? { ...item, accountLabel: label } : item)));
    this.sendSilent({ type: 'rename-account', source: accountId, label });
  }

  protected cancelRename(): void {
    this.editingLabelAccountId.set(null);
  }

  /**
   * 拖放結束：本地先重排（拖曳當下要立即看到效果），新順序只靜默存回後端設定檔——不是完整刷新，
   * 拖曳本身不該觸發任何 provider 的即時 API 呼叫（同上，見 sendSilent 的說明）。
   *
   * setTimeout(0) 是刻意的，不是隨手的非同步：CDK 放開滑鼠後自己還在跑一段「把卡片滑回定位」的
   * transform 動畫/DOM 清理，如果同一個 tick 內就改 summaries() 觸發 Angular `@for` 依新順序重排
   * DOM，兩邊會搶同一批卡片元素，卡高不一致（Codex 兩條進度列 vs. Kimi 一條）時特別容易看到卡片
   * 疊在一起的穿幫畫面。延後一個 tick，讓 CDK 自己的動畫先跑完、把它加的 transform/樣式清乾淨，
   * Angular 才接手重排——這是 Angular CDK 那類 drag+framework-bound-array race 的標準解法。
   */
  protected onDrop(event: CdkDragDrop<UsageSummary[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const reordered = [...this.summaries()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    setTimeout(() => this.summaries.set(reordered), 0);
    this.sendSilent({ type: 'reorder-accounts', order: reordered.map((item) => item.source) });
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

  /** 卡片標題旁的唯讀 badge——標題可以改名蓋掉 AI 類型文字，這個分辨「訂閱制 / API key 制」不受影響。 */
  protected sourceTypeLabel(type: SourceType): string {
    return this.t(type === 'subscription' ? 'subscriptionType' : 'apiKeyType');
  }

  /** 沒有百分比概念的來源（DeepSeek/Kimi 的絕對餘額）不畫假進度條，狀態改用文字 badge。 */
  protected usageStateLabel(state: UsageState): string {
    return (
      {
        normal: this.t('stateNormal'),
        near_limit: this.t('stateNearLimit'),
        exceeded: this.t('stateExceeded'),
        unknown: this.t('stateUnknown'),
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
      label: this.tm(item.percentUsedLabel),
      percent: item.percentUsed,
      state: item.usageState,
      detail: this.tm(item.detail),
    };
    if (item.secondaryPercentUsedLabel === null) {
      return [primary];
    }
    return [
      primary,
      {
        label: this.tm(item.secondaryPercentUsedLabel),
        percent: item.secondaryPercentUsed,
        state: item.secondaryUsageState ?? 'unknown',
        detail: this.tm(item.secondaryDetail),
      },
    ];
  }

  private send(message: Record<string, unknown>): void {
    if (!this.isDesktopHost()) {
      this.lastError.set(this.t('hostNotConnected'));
      return;
    }
    this.isLoading.set(true);
    window.external!.sendMessage!(JSON.stringify(message));
  }

  /** 跟 send() 一樣送訊息給後端，但不點亮「重新整理中…」——用於純本地異動（排序/改名），
   * 這兩者已經在呼叫端樂觀更新過畫面了，不該讓使用者以為觸發了一次真正的用量刷新。 */
  private sendSilent(message: Record<string, unknown>): void {
    if (!this.isDesktopHost()) return;
    window.external!.sendMessage!(JSON.stringify(message));
  }

  private onHostMessage(raw: string): void {
    this.isLoading.set(false);
    try {
      const payload = JSON.parse(raw) as {
        type: string;
        data?: UsageSummary[];
        catalog?: CatalogEntry[];
        settings?: UserSettingsWire;
        hiddenAccounts?: HiddenAccountEntry[];
        error?: string;
      };

      if (payload.type === 'catalog' && payload.catalog) {
        this.catalog.set(payload.catalog);
        return;
      }

      if (payload.type === 'hidden-accounts' && payload.hiddenAccounts) {
        this.hiddenAccounts.set(payload.hiddenAccounts);
        return;
      }

      // get-settings（啟動時）跟 update-settings（存檔後）的回應是同一種訊息——後者多了「存檔中」
      // 的短暫確認提示，前者純粹是把 active 值填進來。
      if (payload.type === 'settings' && payload.settings) {
        this.refreshIntervalMinutes.set(payload.settings.refreshIntervalMinutes);
        this.retentionDays.set(payload.settings.retentionDays);
        this.nearLimitThresholdPercent.set(payload.settings.nearLimitThresholdPercent);
        if (this.settingsSaveStatus() === 'saving') {
          this.settingsSaveStatus.set('saved');
          setTimeout(() => this.settingsSaveStatus.set('idle'), 1500);
        }
        return;
      }

      // 新增來源的結果現在後端會單獨送一則（因為 API key 制的 accountId 是伺服器產生的 GUID，
      // 前端沒辦法從一般的清單裡用 sourceId 反查回「剛剛加的是哪一個」）。通常是一個，但 Claude
      // 透過 cswap 一次偵測可能加好幾個帳號，陣列也可能是空的（cswap 有裝但偵測到的都已經追蹤
      // 過了）——三種情況分開處理，不能只看 data?.[0]。
      if (payload.type === 'account-added' && payload.data) {
        const addedAccounts = payload.data;
        if (addedAccounts.length === 0) {
          this.addStatus.set('success');
          this.addResultMessage.set(this.t('noNewAccountsDetected'));
          return;
        }

        const allValid = addedAccounts.every((a) => a.connectionState === 'valid');
        if (allValid) {
          this.addStatus.set('success');
          this.addResultMessage.set(
            addedAccounts.length === 1
              ? this.t('addedSuccess', { name: addedAccounts[0].accountLabel ?? addedAccounts[0].displayName })
              : this.t('addedSuccessMultiple', { count: String(addedAccounts.length) }),
          );
          // 讓使用者瞄到一眼「成功了」再切回去，不是完全無感跳轉，但也不用再多按一次確認。
          setTimeout(() => this.closeAddView(), 900);
        } else {
          this.addStatus.set('error');
          // 多帳號情況下只顯示第一個失敗的訊息，不逐一列舉——夠用，不用把畫面塞滿。
          const firstFailed = addedAccounts.find((a) => a.connectionState !== 'valid') ?? addedAccounts[0];
          this.addResultMessage.set(this.tm(firstFailed.detail) ?? this.t('unknownAddFailure'));
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
      this.lastError.set(this.t('parseError', { raw }));
    }
  }
}

/** localStorage 讀取只在使用者身上生效（見 artifact/browser-storage 的一般提醒：私密視窗、清過站台
 * 資料的情況下可能整組拿不到）——包一層 try/catch，拿不到就乖乖用預設值，不讓整個 app 掛掉。 */
function loadFromStorage<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const raw = localStorage.getItem(key);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 存不進去（私密視窗等）就算了，下次開啟退回預設值，不影響當下這次的使用
  }
}
