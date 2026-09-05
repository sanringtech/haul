import { AfterViewInit, Component, TemplateRef, ViewChild, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  LucideArrowLeft,
  LucideBookOpen,
  LucideCheck,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideChevronUp,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideEye,
  LucideEyeOff,
  LucideFileSpreadsheet,
  LucideFileText,
  LucideGripVertical,
  LucideHeartPulse,
  LucideInfo,
  LucideLogOut,
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
import { RangeSliderComponent } from './components/ui/range-slider';
import { LineChartComponent, LineChartSeries } from './components/ui/line-chart';
import { DonutGaugeComponent } from './components/ui/donut-gauge';
import { SwitchComponent } from './components/ui/switch';
import { SANRING_CARD_IMPORTS } from './components/ui/card';
import { SANRING_ALERT_IMPORTS } from './components/ui/alert';
import { AlertDialogService, SANRING_ALERT_DIALOG_IMPORTS } from './components/ui/alert-dialog';
import { SANRING_DIALOG_IMPORTS } from './components/ui/dialog';
import { SpinnerComponent } from './components/ui/spinner';
import { SkeletonDirective } from './components/ui/skeleton';
import { SANRING_TOOLTIP_IMPORTS } from './components/ui/tooltip';
import { DatePickerComponent, SANRING_DATE_PICKER_IMPORTS } from './components/ui/date-picker';
import { CalendarComponent, SANRING_CALENDAR_IMPORTS } from './components/ui/calendar';
import { SANRING_POPOVER_IMPORTS } from './components/ui/popover';
import { CalendarLocale, DisabledInput } from '@sanring/date-picker-core';
import { Lang, LANG_STORAGE_KEY, Translations, translations } from './i18n';
import { ConnectionState, HiddenAccountEntry, LocalizedMessage, SourceType, UsageState, UsageSummary } from './shared/wire-types';

type Theme = 'dark' | 'light';
const THEME_STORAGE_KEY = 'sanring-usage-monitor:theme';
// 新 key 用改名後的品牌前綴——舊的 sanring-usage-monitor:* 是既有 key，維持不動避免使用者現有
// 偏好設定憑空消失（見 RELEASE-PLAN.md「改名」那節），但這個 key 是這次才新增的，沒有這個包袱。
const DISCLOSURE_SEEN_KEY = 'sanring-haul:disclosure-seen';

type View = 'list' | 'add' | 'settings' | 'info' | 'ledger';
type AddStatus = 'idle' | 'pending' | 'success' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved';

/** Mirrors backend's UsageService.UserSettings (camelCase on the wire). */
interface UserSettingsWire {
  refreshIntervalMinutes: number | null;
  attentionThresholdPercent: number;
  nearLimitThresholdPercent: number;
  deepSeekAttentionBalanceThresholdUsd: number | null;
  deepSeekLowBalanceThresholdUsd: number | null;
  kimiAttentionBalanceThresholdUsd: number | null;
  kimiLowBalanceThresholdUsd: number | null;
  usageHistoryEnabled: boolean;
  claudeWakeUpEnabled: boolean;
  /** accountId → 幾點（0-23，本機時間）觸發，有在這個物件裡＝已勾選。 */
  claudeWakeUpAccountHours: Record<string, number>;
}

/**
 * startRename() 只真的用得到這三個欄位——縮小成這個介面而不是整個 UsageSummary，讓「Claude 用量
 * 喚醒」清單也能重用同一套改名機制：那份清單混合了 summaries()（UsageSummary）跟 hiddenAccounts()
 * （HiddenAccountEntry）兩種不同形狀的資料，統一成這個最小交集就不用另外寫第二套改名邏輯。
 */
interface RenameableAccount {
  source: string;
  displayName: string;
  accountLabel: string | null;
}

/** One progress row's worth of data, built from either the primary or secondary window fields. */
interface UsageWindow {
  label: string | null;
  percent: number | null;
  state: UsageState;
  detail: string | null;
}

/** Mirrors backend TokenRow —— 帳簿頁分模型 token／估算金額。 */
interface TokenRowWire {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreation5mTokens: number;
  cacheCreation1hTokens: number;
  cacheReadTokens: number;
  estimatedCostUsd: number | null;
}

interface TokenSliceWire {
  key: string;
  label: string;
  models: TokenRowWire[];
  entries: number;
  oldestUtc: string | null;
  newestUtc: string | null;
}

interface TokenLedgerWire {
  source: string;
  bucket: string;
  models: TokenRowWire[];
  entries: number;
  oldestUtc: string | null;
  newestUtc: string | null;
  days?: TokenSliceWire[];
  sessions?: TokenSliceWire[];
}

type TokenSliceMode = 'models' | 'month' | 'week' | 'day';

const CALENDAR_LOCALE_ZH: CalendarLocale = {
  weekStartsOn: 1,
  weekdayLabels: ['日', '一', '二', '三', '四', '五', '六'],
  monthLabels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};

const CALENDAR_LOCALE_EN: CalendarLocale = {
  weekStartsOn: 1,
  weekdayLabels: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function mondayOf(value: string): Date {
  const d = parseYmd(value);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function mergeTokenRows(rows: TokenRowWire[]): TokenRowWire[] {
  const map = new Map<string, TokenRowWire>();
  for (const row of rows) {
    const cur = map.get(row.model);
    if (!cur) {
      map.set(row.model, { ...row });
      continue;
    }
    const cost =
      cur.estimatedCostUsd == null && row.estimatedCostUsd == null
        ? null
        : (cur.estimatedCostUsd ?? 0) + (row.estimatedCostUsd ?? 0);
    map.set(row.model, {
      model: row.model,
      inputTokens: cur.inputTokens + row.inputTokens,
      outputTokens: cur.outputTokens + row.outputTokens,
      cacheCreation5mTokens: cur.cacheCreation5mTokens + row.cacheCreation5mTokens,
      cacheCreation1hTokens: cur.cacheCreation1hTokens + row.cacheCreation1hTokens,
      cacheReadTokens: cur.cacheReadTokens + row.cacheReadTokens,
      estimatedCostUsd: cost == null ? null : Math.round(cost * 10_000) / 10_000,
    });
  }
  return [...map.values()].sort(
    (a, b) =>
      (b.estimatedCostUsd ?? 0) - (a.estimatedCostUsd ?? 0)
      || b.inputTokens + b.outputTokens + b.cacheReadTokens - (a.inputTokens + a.outputTokens + a.cacheReadTokens),
  );
}

/** Mirrors backend's UsageHistoryStore.UsageHistoryPoint（camelCase on the wire）——帳簿頁折線圖用。 */
interface UsageHistoryPointWire {
  recordedAtUtc: string;
  accountId: string;
  displayName: string;
  accountLabel: string | null;
  windowLabelKey: string | null;
  percentUsed: number;
  usageState: UsageState;
}

/** `codex:user@x.com` / `claude:user@x.com` 沒有自訂標籤時，圖例用 email 而不是都叫「Codex」。 */
function emailFromAccountId(accountId: string): string | null {
  const colon = accountId.indexOf(':');
  if (colon < 0) return null;
  const suffix = accountId.slice(colon + 1);
  return suffix.includes('@') ? suffix : null;
}

/**
 * 擷取升級後 usage_history 常同時留下字面 `codex`/`claude` 跟 `codex:email`。
 * 後端會 remap，圖表這邊也收斂一次——舊桌面殼還沒重開時圖例仍會變一條。
 */
function canonicalHistoryAccountId(accountId: string, ids: Iterable<string>): string {
  if (accountId !== 'codex' && accountId !== 'claude') return accountId;
  const prefixed = [...ids].filter((id) => id.startsWith(`${accountId}:`));
  return prefixed.length === 1 ? prefixed[0]! : accountId;
}

/** 卡片列表最上方的彙總健康度——見 usageHealth() 的算法說明。 */
interface UsageHealth {
  /** 所有訂閱用量中最需要注意的狀態；API KEY 餘額不屬於用量健康度。 */
  state: UsageState;
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
    NgTemplateOutlet,
    ButtonDirective,
    BadgeDirective,
    ProgressComponent,
    InputDirective,
    RangeSliderComponent,
    LineChartComponent,
    DonutGaugeComponent,
    SwitchComponent,
    SpinnerComponent,
    SkeletonDirective,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    LucideArrowLeft,
    LucideBookOpen,
    LucideCheck,
    LucideChevronDown,
    LucideChevronLeft,
    LucideChevronRight,
    LucideChevronUp,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideEye,
    LucideEyeOff,
    LucideFileSpreadsheet,
    LucideFileText,
    LucideGripVertical,
    LucideHeartPulse,
    LucideInfo,
    LucideLogOut,
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
    ...SANRING_DIALOG_IMPORTS,
    ...SANRING_TOOLTIP_IMPORTS,
    ...SANRING_DATE_PICKER_IMPORTS,
    ...SANRING_CALENDAR_IMPORTS,
    ...SANRING_POPOVER_IMPORTS,
  ],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements AfterViewInit {
  private readonly alertDialogService = inject(AlertDialogService);
  @ViewChild('disclosureDialog') private readonly disclosureDialog?: TemplateRef<unknown>;
  protected readonly title = signal('sanring Haul');
  /** SSOT 是根目錄的 VERSION 檔——這裡是手動對齊的第四個點（跟 package.json/Info.plist 同一套
   *  取捨，見 RELEASE-PLAN.md「版本號」：三個地方還不到值得建自動同步 pipeline 的規模），改版時
   *  記得一起改。 */
  protected readonly appVersion = 'v0.4.1';
  protected readonly isDesktopHost = signal(typeof window.external?.sendMessage === 'function');
  protected readonly summaries = signal<UsageSummary[]>([]);
  protected readonly lastError = signal<string | null>(null);
  protected readonly isLoading = signal(false);
  /** Shown once next to the refresh button instead of once per card — every card's `asOf` is effectively the same refresh instant. */
  protected readonly lastRefreshedAt = signal<string | null>(null);
  /** 刷新結束後短暫亮一下「上次更新」，數字沒變時也看得到動作完成。 */
  protected readonly justRefreshed = signal(false);
  private justRefreshedTimer?: ReturnType<typeof setTimeout>;

  /** 以最嚴重的訂閱用量代表整體健康狀態；API KEY 餘額由來源卡片各自呈現。 */
  protected readonly usageHealth = computed<UsageHealth | null>(() => {
    const states = this.summaries()
      .filter((item) => item.sourceType === 'subscription')
      .flatMap((item) => this.windows(item).map((window) => window.state));
    if (states.length === 0) return null;

    const severity: Record<UsageState, number> = { unknown: 0, normal: 1, attention: 2, near_limit: 3, exceeded: 4 };
    return { state: states.reduce((worst, state) => severity[state] > severity[worst] ? state : worst) };
  });

  /**
   * 「API KEY 餘額提醒」那兩列的標籤要能點擊改名、同步回對應帳號卡片（跟卡片標題共用同一套
   * startRename/commitRename 機制，不是另外做一套）——但這組閾值是「整個 DeepSeek/整個 Kimi 共用
   * 一組」，不是綁在某個帳號上，所以只有「剛好只追蹤一個」的時候才找得出唯一對應的帳號可以改名；
   * 追蹤兩個以上（或一個都沒有）就沒有唯一對應目標，退回顯示不可點擊的純文字「DeepSeek」/「Kimi」，
   * 不然點下去到底改哪一個會誤導。DisplayName 同時篩 sourceType==='api_key'——Kimi 同時有訂閱制
   * 跟 API KEY 制兩種 provider，DisplayName 都叫 "Kimi"，這裡要的是餘額那個，不能只比對名字。
   */
  protected readonly deepSeekAccount = computed(() => {
    const matches = this.summaries().filter((s) => s.displayName === 'DeepSeek' && s.sourceType === 'api_key');
    return matches.length === 1 ? matches[0] : null;
  });
  protected readonly kimiAccount = computed(() => {
    const matches = this.summaries().filter((s) => s.displayName === 'Kimi' && s.sourceType === 'api_key');
    return matches.length === 1 ? matches[0] : null;
  });

  /**
   * 「有沒有追蹤這個 provider 的 api_key 帳號」——跟上面 deepSeekAccount()/kimiAccount() 是不同問題：
   * 那兩個回答「剛好只有一個，可不可以在這裡改名」，這兩個回答「這個 provider 的餘額提醒設定列
   * 該不該出現」。帳號被取消追蹤後（連同 summaries()/hiddenAccounts() 都沒有了），設定頁還留著
   * 一整列「Kimi 餘額提醒」開關會很奇怪——使用者反饋這點，兩者其實是同一件事的兩個層面，帳號
   * 都不在了，這個 provider 的餘額提醒設定當然也不該還露出來。「關閉顯示」中的帳號（hiddenAccounts）
   * 還算追蹤中，不是取消追蹤，餘額提醒該繼續有效，所以也算進來。
   */
  protected readonly hasDeepSeekAccount = computed(() =>
    this.summaries().some((s) => s.displayName === 'DeepSeek' && s.sourceType === 'api_key') ||
    this.hiddenAccounts().some((a) => a.displayName === 'DeepSeek' && a.sourceType === 'api_key'),
  );
  protected readonly hasKimiAccount = computed(() =>
    this.summaries().some((s) => s.displayName === 'Kimi' && s.sourceType === 'api_key') ||
    this.hiddenAccounts().some((a) => a.displayName === 'Kimi' && a.sourceType === 'api_key'),
  );

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
  protected readonly attentionThresholdPercent = signal<number>(70);
  protected readonly nearLimitThresholdPercent = signal<number>(85);
  protected readonly deepSeekAttentionBalanceThresholdUsd = signal<number | null>(null);
  protected readonly deepSeekLowBalanceThresholdUsd = signal<number | null>(null);
  protected readonly kimiAttentionBalanceThresholdUsd = signal<number | null>(null);
  protected readonly kimiLowBalanceThresholdUsd = signal<number | null>(null);
  protected readonly draftRefreshInterval = signal<number | null>(60);
  protected readonly draftAttentionThreshold = signal<number>(70);
  protected readonly draftNearLimitThreshold = signal<number>(85);
  /** 「注意」select 的選項清單——動態排除掉會跟「接近上限」目前的值交叉的選項，選單裡出現的
   *  每一項本來就保證合法，不用另外在選了之後才 clamp。跟 sanring-range-slider 的 allowedMax 同一個
   *  50~95、5 一階的規則。 */
  protected readonly attentionThresholdOptions = computed(() => {
    const options: number[] = [];
    for (let v = 50; v <= this.draftNearLimitThreshold(); v += 5) options.push(v);
    return options;
  });
  protected readonly nearLimitThresholdOptions = computed(() => {
    const options: number[] = [];
    for (let v = this.draftAttentionThreshold(); v <= 95; v += 5) options.push(v);
    return options;
  });
  protected readonly draftDeepSeekLowBalance = signal<number | null>(null);
  protected readonly draftKimiLowBalance = signal<number | null>(null);
  protected readonly draftDeepSeekBalanceAlertEnabled = signal(false);
  protected readonly draftKimiBalanceAlertEnabled = signal(false);
  /** 「記錄用量歷史」開關——active 值另外驅動下面建構子裡自動刷新 timer 的接管邏輯，見那裡的註解。 */
  protected readonly usageHistoryEnabled = signal(false);
  protected readonly draftUsageHistoryEnabled = signal(false);
  /**
   * 「Claude 用量喚醒」——這是唯一會真的消耗使用者用量額度的開關（其餘都是唯讀查詢），用 Map
   * 存 accountId → 觸發時刻（0-23，本機時間），有在 Map 裡＝已勾選，不需要另外一個布林清單。
   * 跟其餘設定頁的開關（記錄用量歷史、刷新間隔按鈕）同一套「點下去立即存檔」模式，見
   * onClaudeWakeUpToggle/onClaudeWakeUpAccountToggle/onClaudeWakeUpAccountHourChange。
   */
  protected readonly claudeWakeUpEnabled = signal(false);
  protected readonly draftClaudeWakeUpEnabled = signal(false);
  protected readonly claudeWakeUpAccountHours = signal<ReadonlyMap<string, number>>(new Map());
  protected readonly draftClaudeWakeUpAccountHours = signal<ReadonlyMap<string, number>>(new Map());
  /** 新勾選一個帳號時的預設喚醒時刻——早上比較合理，起床/開始工作前先喚醒，不用等到真的開始用才觸發。 */
  private static readonly DEFAULT_WAKE_UP_HOUR = 7;
  /** 24 小時制的下拉選項，模板裡 @for 直接迭代，固定清單不用做成 computed。 */
  protected readonly claudeWakeUpHourOptions = Array.from({ length: 24 }, (_, h) => h);
  protected readonly settingsSaveStatus = signal<SaveStatus>('idle');

  /** 「Claude 用量喚醒」帳號清單從目前追蹤中、AccountId 為 claude:{email} 的帳號裡挑——
   *  舊版單帳號（source 字面上是 "claude"）沒有獨立快照，不支援喚醒。 */
  /**
   * 隱藏中（關閉顯示，不是取消追蹤）的帳號也要算進來——隱藏≠移除，帳號還在追蹤中，Keychain
   * 憑證還在，喚醒還是會真的觸發，使用者得看得到、改得了這個設定，不能因為卡片被藏起來就連
   * 帶連設定頁都找不到（那樣等於沒辦法關掉一個還在背景消耗額度的東西）。summaries()／
   * hiddenAccounts() 兩邊的帳號不會重疊（同一個帳號同時間只會在其中一邊），直接合併不用去重。
   */
  protected readonly claudeWakeUpEligibleAccounts = computed<RenameableAccount[]>(() => [
    ...this.summaries()
      .filter((s) => s.source.startsWith('claude:'))
      .map((s) => ({ source: s.source, displayName: s.displayName, accountLabel: s.accountLabel })),
    ...this.hiddenAccounts()
      .filter((a) => a.accountId.startsWith('claude:'))
      .map((a) => ({ source: a.accountId, displayName: a.displayName, accountLabel: a.accountLabel })),
  ]);

  /** 匯出用量歷史（md/xlsx）的按鈕狀態——跟 addStatus/settingsSaveStatus 同一種「按下去到有結果」模式。 */
  protected readonly historyExportStatus = signal<'idle' | 'pending' | 'success' | 'error'>('idle');
  protected readonly historyExportError = signal<string | null>(null);
  protected readonly localUsageExportStatus = signal<'idle' | 'pending' | 'success' | 'error'>('idle');
  protected readonly localUsageExportError = signal<string | null>(null);
  protected readonly usageHistory = signal<UsageHistoryPointWire[]>([]);
  protected readonly claudeTokenLedger = signal<TokenLedgerWire | null>(null);
  protected readonly codexTokenLedger = signal<TokenLedgerWire | null>(null);
  protected readonly claudeTokenTotals = computed(() => this.tokenTotals(this.claudeTokenLedger()));
  protected readonly codexTokenTotals = computed(() => this.tokenTotals(this.codexTokenLedger()));
  protected readonly tokenProviderCards = computed(() => [
    {
      id: 'claude',
      titleKey: 'ledgerTokenTitle' as const,
      emptyKey: 'ledgerTokenEmpty' as const,
      ledger: this.claudeTokenLedger(),
      totals: this.claudeTokenTotals(),
    },
    {
      id: 'codex',
      titleKey: 'ledgerCodexTitle' as const,
      emptyKey: 'ledgerCodexEmpty' as const,
      ledger: this.codexTokenLedger(),
      totals: this.codexTokenTotals(),
    },
  ]);

  protected readonly infoNotices = [
    { titleKey: 'infoTestingTitle' as const, bodyKey: 'infoTestingBody' as const },
    { titleKey: 'infoUsdTitle' as const, bodyKey: 'infoUsdBody' as const },
  ];

  protected readonly infoSections = [
    { titleKey: 'infoClaudeTitle', bodyKey: 'infoClaudeBody' },
    { titleKey: 'infoCodexTitle', bodyKey: 'infoCodexBody' },
    { titleKey: 'infoApiKeyTitle', bodyKey: 'infoApiKeyBody' },
    { titleKey: 'infoKimiSubTitle', bodyKey: 'infoKimiSubBody' },
    { titleKey: 'infoCursorTitle', bodyKey: 'infoCursorBody' },
    { titleKey: 'infoGrokTitle', bodyKey: 'infoGrokBody' },
  ] as const;

  private tokenTotals(ledger: TokenLedgerWire | { models: TokenRowWire[] } | null): { input: number; output: number; cacheWrite: number; cacheRead: number; cost: number | null } {
    const rows = ledger?.models ?? [];
    let input = 0;
    let output = 0;
    let cacheWrite = 0;
    let cacheRead = 0;
    let cost = 0;
    let hasCost = false;
    for (const r of rows) {
      input += r.inputTokens;
      output += r.outputTokens;
      cacheWrite += r.cacheCreation5mTokens + r.cacheCreation1hTokens;
      cacheRead += r.cacheReadTokens;
      if (r.estimatedCostUsd != null) {
        cost += r.estimatedCostUsd;
        hasCost = true;
      }
    }
    return { input, output, cacheWrite, cacheRead, cost: hasCost ? cost : null };
  }

  /**
   * 圖表現在收在「查看圖表」對話框裡，不是直接嵌在設定頁裡——原本折線圖固定畫在「記錄用量歷史」
   * 卡片下面。圖表現在在帳簿頁，chartMode 決定畫哪一種；之後加熱力圖這裡多一個 union 即可。
   */
  protected readonly chartMode = signal<'line' | 'donut'>('line');
  protected readonly tokenSliceMode = signal<TokenSliceMode>('models');
  protected readonly tokenSliceAnchor = signal(ymd(new Date()));
  protected readonly datePickerOpen = signal(false);
  protected readonly tokenSliceSelectedDate = computed(() => parseYmd(this.tokenSliceAnchor()));
  private readonly periodDatePicker = viewChild(DatePickerComponent);
  private readonly periodCalendar = viewChild(CalendarComponent);
  protected readonly tokenSliceDisabled = computed<DisabledInput>(() => {
    const min = this.tokenSliceMinDate();
    const max = this.tokenSliceMaxDate();
    const mode = this.tokenSliceMode();
    return (date: Date) => {
      const key = ymd(date);
      if (mode === 'month') {
        const month = key.slice(0, 7);
        return month < min.slice(0, 7) || month > max.slice(0, 7);
      }
      if (mode === 'week') {
        const start = ymd(mondayOf(key));
        const end = parseYmd(start);
        end.setDate(end.getDate() + 6);
        return ymd(end) < min || start > max;
      }
      return key < min || key > max;
    };
  });

  protected calendarLocale(): CalendarLocale {
    return this.lang() === 'en' ? CALENDAR_LOCALE_EN : CALENDAR_LOCALE_ZH;
  }

  protected tokenSliceTriggerLabel(): string {
    if (this.tokenSliceMode() === 'week') return this.tokenSliceWeekLabel();
    if (this.tokenSliceMode() === 'month') return this.tokenSliceMonthValue();
    return this.tokenSliceAnchor();
  }

  protected onTokenSlicePicked(date: Date | null): void {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
    const next = ymd(date);
    const current = this.tokenSliceAnchor();
    const mode = this.tokenSliceMode();
    const unchanged =
      mode === 'month'
        ? next.slice(0, 7) === current.slice(0, 7)
        : mode === 'week'
          ? ymd(mondayOf(next)) === ymd(mondayOf(current))
          : next === current;
    if (unchanged) return;
    this.tokenSliceAnchor.set(next);
    this.datePickerOpen.set(false);
  }

  protected setChartMode(mode: 'line' | 'donut'): void {
    this.chartMode.set(mode);
  }

  protected setTokenSliceMode(mode: TokenSliceMode): void {
    if (this.tokenSliceMode() === 'models' && mode !== 'models') {
      this.tokenSliceAnchor.set(this.tokenSliceMaxDate());
    }
    this.tokenSliceMode.set(mode);
  }

  private allLedgerDayKeys(): string[] {
    const keys = new Set<string>();
    for (const day of this.claudeTokenLedger()?.days ?? []) keys.add(day.key);
    for (const day of this.codexTokenLedger()?.days ?? []) keys.add(day.key);
    return [...keys].sort();
  }

  protected tokenSliceMinDate(): string {
    return this.allLedgerDayKeys()[0] ?? ymd(new Date());
  }

  protected tokenSliceMaxDate(): string {
    return this.allLedgerDayKeys().at(-1) ?? ymd(new Date());
  }

  protected tokenSliceMonthValue(): string {
    return this.tokenSliceAnchor().slice(0, 7);
  }

  protected tokenSliceWeekLabel(): string {
    const start = mondayOf(this.tokenSliceAnchor());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return this.t('ledgerSliceWeekRange', {
      start: `${start.getMonth() + 1}/${start.getDate()}`,
      end: `${end.getMonth() + 1}/${end.getDate()}`,
    });
  }

  protected shiftTokenSlice(delta: number): void {
    const next = parseYmd(this.tokenSliceAnchor());
    const mode = this.tokenSliceMode();
    if (mode === 'month') next.setMonth(next.getMonth() + delta);
    else if (mode === 'week') next.setDate(next.getDate() + delta * 7);
    else next.setDate(next.getDate() + delta);
    let value = ymd(next);
    const min = this.tokenSliceMinDate();
    const max = this.tokenSliceMaxDate();
    if (value < min) value = min;
    if (value > max) value = max;
    this.tokenSliceAnchor.set(value);
  }

  private periodDayKeys(): Set<string> {
    const anchor = this.tokenSliceAnchor();
    const mode = this.tokenSliceMode();
    if (mode === 'day') return new Set([anchor]);
    if (mode === 'month') {
      const prefix = anchor.slice(0, 7);
      const keys = new Set<string>();
      const cursor = parseYmd(`${prefix}-01`);
      while (ymd(cursor).startsWith(prefix)) {
        keys.add(ymd(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return keys;
    }
    if (mode === 'week') {
      const start = mondayOf(anchor);
      const keys = new Set<string>();
      for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        keys.add(ymd(day));
      }
      return keys;
    }
    return new Set();
  }

  protected tokenPeriodRows(ledger: TokenLedgerWire | null): TokenRowWire[] {
    const wanted = this.periodDayKeys();
    return mergeTokenRows((ledger?.days ?? []).filter((day) => wanted.has(day.key)).flatMap((day) => day.models));
  }

  protected tokenPeriodTotals(ledger: TokenLedgerWire | null) {
    return this.tokenTotals({ models: this.tokenPeriodRows(ledger) });
  }

  /**
   * 帳簿頁折線圖的資料——把 usageHistory() 依「帳號＋視窗」分組成一條條線。顏色刻意不用
   * success/warn/error 那組語意色（那些在別處代表「狀態」，這裡的顏色只是用來分辨「這是哪個
   * 帳號的哪個視窗」，兩件事混在一起會誤導），改用 primary/coral/sun/info 四個品牌色階輪流分配。
   */
  private isChartedHistoryPoint(p: UsageHistoryPointWire): boolean {
    return (
      p.windowLabelKey === 'fiveHourLabel' ||
      p.windowLabelKey === 'sevenDayLabel' ||
      p.windowLabelKey === 'cursorModelsLabel' ||
      p.windowLabelKey === 'otherModelsLabel'
    );
  }

  /**
   * 5 小時（短週期／突發額度）跟 7 天以上（長週期／總預算，含 Cursor 的月結模型桶）分成兩張圖。
   * 舊的 Cursor 美元花費序列（沒有 windowLabelKey）不進圖——那不是帳簿頁在畫的東西。
   */
  protected readonly shortWindowChartSeries = computed(() =>
    this.buildChartSeries(this.usageHistory().filter((p) => p.windowLabelKey === 'fiveHourLabel')),
  );
  protected readonly longWindowChartSeries = computed(() =>
    this.buildChartSeries(
      this.usageHistory().filter((p) => p.windowLabelKey === 'sevenDayLabel' || p.windowLabelKey === 'cursorModelsLabel' || p.windowLabelKey === 'otherModelsLabel'),
    ),
  );

  /** 帳號→顏色的對照表刻意跨兩張圖共用同一份（不是每張圖各自從頭分配）——同一個帳號在兩張圖
   *  裡要是同一個顏色，才看得出「這兩張圖裡的這兩條線是同一個人」，不然色號分配順序不同，
   *  兩張圖對不起來。 */
  private readonly accountColorMap = computed(() => {
    const palette = [
      'var(--sanring-primary-50)',
      'var(--sanring-coral-50)',
      'var(--sanring-sun-50)',
      'var(--sanring-info-50)',
    ];
    const history = this.usageHistory();
    const ids = history.map((p) => p.accountId);
    const map = new Map<string, string>();
    for (const p of history) {
      if (!this.isChartedHistoryPoint(p)) continue;
      const accountId = canonicalHistoryAccountId(p.accountId, ids);
      if (!map.has(accountId)) {
        map.set(accountId, palette[map.size % palette.length]);
      }
    }
    return map;
  });

  private buildChartSeries(points: UsageHistoryPointWire[]): LineChartSeries[] {
    const accountColor = this.accountColorMap();
    const ids = this.usageHistory().map((p) => p.accountId);
    const grouped = new Map<string, { accountId: string; windowKey: string; label: string; dashed: boolean; points: { x: number; y: number }[] }>();

    for (const p of points) {
      const accountId = canonicalHistoryAccountId(p.accountId, ids);
      const windowKey = p.windowLabelKey ?? '';
      const key = `${accountId}::${windowKey}`;
      const windowLabel = p.windowLabelKey === 'fiveHourLabel' ? this.t('fiveHourLabel')
        : p.windowLabelKey === 'sevenDayLabel' ? this.t('sevenDayLabel')
        : p.windowLabelKey === 'cursorModelsLabel' ? this.t('cursorModelsLabel')
        : p.windowLabelKey === 'otherModelsLabel' ? this.t('otherModelsLabel')
        : null;
      const email = emailFromAccountId(accountId);
      const accountName =
        p.accountLabel && p.accountLabel !== p.displayName
          ? p.accountLabel
          : (email ?? p.accountLabel ?? p.displayName);
      const label = windowLabel ? `${accountName}（${windowLabel}）` : accountName;
      const x = new Date(p.recordedAtUtc).getTime();

      const existing = grouped.get(key);
      if (existing) {
        existing.points.push({ x, y: p.percentUsed });
      } else {
        // 次要視窗畫虛線（Claude 7 天、Cursor 其他模型）；主要視窗與單視窗來源畫實線。
        grouped.set(key, {
          accountId,
          windowKey,
          label,
          dashed: p.windowLabelKey === 'sevenDayLabel' || p.windowLabelKey === 'otherModelsLabel',
          points: [{ x, y: p.percentUsed }],
        });
      }
    }

    return [...grouped.values()].map((series) => ({
      id: `${series.accountId}::${series.windowKey}`,
      label: series.label,
      color: accountColor.get(series.accountId)!,
      dashed: series.dashed,
      points: series.points.sort((a, b) => a.x - b.x),
    }));
  }

  /** X 軸時間範圍兩張圖共用同一個，不是各自貼合自己的資料——這樣兩張圖上下對齊時，同一個時間點
   *  在兩張圖的水平位置是一樣的，比較「這時候發生了什麼」才有意義。 */
  protected readonly chartMinX = computed(() => {
    const allX = this.usageHistory().filter((p) => this.isChartedHistoryPoint(p)).map((p) => new Date(p.recordedAtUtc).getTime());
    return allX.length > 0 ? Math.min(...allX) : 0;
  });
  protected readonly chartMaxX = computed(() => {
    const allX = this.usageHistory().filter((p) => this.isChartedHistoryPoint(p)).map((p) => new Date(p.recordedAtUtc).getTime());
    return allX.length > 0 ? Math.max(...allX) : 1;
  });

  /** 點圖例可以個別開關某一條線——跟一般圖表庫（ECharts 等）圖例的標準互動一樣。只存「被關掉」
   *  的 label，不是存「目前可見」的清單——新出現的系列（例如剛追蹤的新帳號）預設就是顯示的，
   *  不用額外處理「新系列要不要顯示」這個問題。兩張圖共用同一份，label 本身已經含帳號+視窗，
   *  不會跨圖撞名。 */
  protected readonly hiddenChartSeries = signal<ReadonlySet<string>>(new Set());

  protected toggleChartSeries(label: string): void {
    this.hiddenChartSeries.update((hidden) => {
      const next = new Set(hidden);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  /**
   * 圖例要顯示的資料（含消耗速率、是否被關掉）——刻意不當成傳給 <sanring-line-chart> 的
   * LineChartSeries 的一部分（那個元件是純畫圖的，不該知道「速率」這種業務語意），也刻意不做成
   * computed（現在有兩張圖各自要呼叫，用 computed 反而要多存兩份幾乎一樣的東西，一個 method
   * 兩張圖共用邏輯更單純，這裡的資料量小，模板裡每次 CD 重算也不是問題）。
   */
  protected chartLegendFor(series: LineChartSeries[]) {
    return series.map((s) => ({
      ...s,
      rateLabel: this.burnRateLabel(s.points),
      hidden: this.hiddenChartSeries().has(s.label),
    }));
  }

  /** 實際畫進 <sanring-line-chart> 的只有沒被關掉的系列。 */
  protected visibleSeries(series: LineChartSeries[]): LineChartSeries[] {
    return series.filter((s) => !this.hiddenChartSeries().has(s.label));
  }

  /**
   * 甜甜圈量表模式：直接拿折線圖已經分好組、排好序的 series 來用，每個系列只取「最後一個點」
   * （＝目前最新的值）——不重新查一次 usageHistory()，兩種畫法看的是同一份分組結果，只是折線圖
   * 畫全部的點、這裡只看最新一點。跟圖例一樣尊重 hiddenChartSeries()：使用者在折線圖模式關掉的
   * 系列，切到甜甜圈模式也應該保持關掉，不然「關掉」這個動作在兩種模式之間對不起來。
   */
  protected donutDataFor(series: LineChartSeries[]): { label: string; color: string; percent: number }[] {
    return series
      .filter((s) => !this.hiddenChartSeries().has(s.label))
      .map((s) => ({ label: s.label, color: s.color, percent: s.points.at(-1)?.y ?? 0 }));
  }

  /**
   * 消耗速率：用系列最後兩個點算 Δ%/小時——增量過濾後每個點都代表一次真正的數值變化，不是每 5
   * 分鐘的固定間隔，用「最後兩點」比用「最後一小時內的點」更準（後者在點很稀疏時可能抓不到任何
   * 點）。少於兩個點算不出速率，不顯示。
   */
  private burnRateLabel(points: { x: number; y: number }[]): string | null {
    if (points.length < 2) return null;
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const hours = (last.x - prev.x) / 3_600_000;
    if (hours <= 0) return null;
    const rate = (last.y - prev.y) / hours;
    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toFixed(1)}%/h`;
  }

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
    //
    // 「記錄用量歷史」開啟時直接接管成固定 5 分鐘一次，蓋掉使用者選的刷新間隔——這是使用者自己
    // 選的行為（見開關旁的說明文字），不是意外副作用：沒有另外開一條背景輪詢，寫入歷史記錄完全
    // 搭這裡的便車（見後端 Program.cs 的 RespondWithSummaries），只有一份「多久打一次 API」的邏輯。
    // （原本是 3 分鐘，使用者反饋抓太密、資料雜訊偏多，改成 5 分鐘。）
    effect((onCleanup) => {
      const minutes = this.usageHistoryEnabled() ? 5 : this.refreshIntervalMinutes();
      if (minutes === null) return;
      const id = setInterval(() => this.refresh(), minutes * 60_000);
      onCleanup(() => clearInterval(id));
    });

    effect(() => {
      const date = this.tokenSliceSelectedDate();
      this.periodDatePicker()?.writeValue(date);
      this.periodCalendar()?.writeValue(date);
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

  // ViewChild 只有在畫面初始化完才拿得到 TemplateRef，不能在 constructor 裡就開——跟主要的資料
  // 抓取（get-settings/get-usage-summary 那些）不同層級的時機限制，所以分開放。
  ngAfterViewInit(): void {
    if (loadFromStorage(DISCLOSURE_SEEN_KEY, '0', ['0', '1']) === '1') return;
    if (!this.disclosureDialog) return;
    // 強制先看過才能用——AlertDialogService 內部鎖 disableClose，不能點背景/按 Esc 跳過，
    // 一定要按下面那顆「了解」，不能在同意之前就進到主畫面。
    this.alertDialogService.open(this.disclosureDialog).closed.subscribe(() => {
      saveToStorage(DISCLOSURE_SEEN_KEY, '1');
    });
  }

  protected toggleTheme(): void {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  protected toggleLang(): void {
    this.lang.set(this.lang() === 'zh-TW' ? 'en' : 'zh-TW');
  }

  /** 查目前語言的翻譯表，{key} 形式的 placeholder 用 params 替換——跟 usageStateLabel() 那類「依狀態查表」寫法同一套模式。 */
  protected formatCount(n: number): string {
    return n.toLocaleString(this.lang() === 'zh-TW' ? 'zh-Hant-TW' : 'en');
  }

  protected formatUsd(n: number | null): string {
    if (n == null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  protected cacheWriteTokens(row: TokenRowWire): number {
    return row.cacheCreation5mTokens + row.cacheCreation1hTokens;
  }

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

  private pulseJustRefreshed(): void {
    this.justRefreshed.set(true);
    clearTimeout(this.justRefreshedTimer);
    this.justRefreshedTimer = setTimeout(() => this.justRefreshed.set(false), 900);
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
    this.draftAttentionThreshold.set(this.attentionThresholdPercent());
    this.draftNearLimitThreshold.set(this.nearLimitThresholdPercent());
    this.draftDeepSeekLowBalance.set(this.deepSeekLowBalanceThresholdUsd());
    this.draftKimiLowBalance.set(this.kimiLowBalanceThresholdUsd());
    this.draftDeepSeekBalanceAlertEnabled.set(this.deepSeekLowBalanceThresholdUsd() !== null);
    this.draftKimiBalanceAlertEnabled.set(this.kimiLowBalanceThresholdUsd() !== null);
    this.draftUsageHistoryEnabled.set(this.usageHistoryEnabled());
    this.draftClaudeWakeUpEnabled.set(this.claudeWakeUpEnabled());
    this.draftClaudeWakeUpAccountHours.set(this.claudeWakeUpAccountHours());
  }

  protected openLedgerView(): void {
    this.view.set('ledger');
    this.historyExportStatus.set('idle');
    this.historyExportError.set(null);
    this.localUsageExportStatus.set('idle');
    this.localUsageExportError.set(null);
    this.sendSilent({ type: 'get-usage-history' });
  }

  protected closeLedgerView(): void {
    this.view.set('list');
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

  /**
   * 這幾顆按鈕點下去立即存檔，不等「儲存」——跟 onUsageHistoryToggle 同一個理由、同一個 bug 的
   * 回報（使用者選了「純手動」，沒按儲存就離開設定頁，回來又跳回 1 小時，感覺像「自動跳回」，
   * 其實是根本沒存到）。這裡是離散的按鈕點擊（不是拖曳滑桿），跟 saveSettings() 平常存檔時同樣
   * 只會觸發一次完整刷新，不會有滑桿逐 pixel 洗版存檔的問題，所以能比照開關那樣直接存。
   */
  protected selectRefreshInterval(minutes: number | null): void {
    this.draftRefreshInterval.set(minutes);
    this.saveSettings();
  }

  protected onAttentionThresholdChange(value: number): void {
    this.draftAttentionThreshold.set(Math.min(value, this.draftNearLimitThreshold()));
  }

  protected onNearLimitThresholdChange(value: number): void {
    this.draftNearLimitThreshold.set(Math.max(value, this.draftAttentionThreshold()));
  }

  /**
   * 拖滑桿跟選數字是同一個值的兩種輸入方式——原本試過 sanringInput type="number" 自由輸入，
   * 使用者反饋改用 select 下拉：一來只有 50/55/…/95 這 10 個合法值，下拉直接列舉排除打錯字/
   * 打出不是 5 的倍數這種情況；二來跟「API KEY 餘額提醒」那兩個數字輸入框在「同一種控制項」
   * 這件事上取得一致（select 本質上也是一種 input）。選項清單本身就用 attentionThresholdOptions/
   * nearLimitThresholdOptions 動態排除掉會跟另一個閾值交叉的值，所以這裡不用再另外 clamp——
   * 選單裡出現的每個選項本來就保證合法。
   */
  protected onAttentionThresholdSelect(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value)) return;
    this.draftAttentionThreshold.set(value);
  }

  protected onNearLimitThresholdSelect(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value)) return;
    this.draftNearLimitThreshold.set(value);
  }

  /**
   * 這顆開關存檔即時生效，不等使用者另外按「儲存」——跟同一頁其他欄位（間隔/閾值）故意採用
   * 「先在草稿改，按儲存才生效」不一樣。原因：header 那幾顆主題/語言切換都是點下去立即生效，
   * 使用者對「開關」這個控制項元件的既有預期就是這樣，之前做成要另外按儲存，會讓人以為開關已經
   * 生效、關掉設定頁後才發現其實沒存到——玩家回報「記錄用量歷史會自動關閉」，根因就是這個預期
   * 落差（不是真的有東西把它關掉，是本來就沒存進去）。
   */
  protected onUsageHistoryToggle(checked: boolean): void {
    this.draftUsageHistoryEnabled.set(checked);
    this.saveSettings();
  }

  /** 同一個「開關點下去立即存檔」理由——這個開關比其他都更需要即時生效：使用者關掉它就是想要
   *  立刻停止消耗額度，不該還要多按一次儲存才真的停下來。 */
  protected onClaudeWakeUpToggle(checked: boolean): void {
    this.draftClaudeWakeUpEnabled.set(checked);
    this.saveSettings();
  }

  protected onClaudeWakeUpAccountToggle(accountId: string, checked: boolean): void {
    this.draftClaudeWakeUpAccountHours.update((hours) => {
      const next = new Map(hours);
      if (checked) next.set(accountId, App.DEFAULT_WAKE_UP_HOUR);
      else next.delete(accountId);
      return next;
    });
    this.saveSettings();
  }

  protected onClaudeWakeUpAccountHourChange(accountId: string, event: Event): void {
    const hour = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(hour)) return;
    this.draftClaudeWakeUpAccountHours.update((hours) => {
      if (!hours.has(accountId)) return hours; // 沒勾選就沒有時刻可以改
      const next = new Map(hours);
      next.set(accountId, hour);
      return next;
    });
    this.saveSettings();
  }

  protected onBalanceAlertToggle(provider: 'deepseek' | 'kimi', checked: boolean): void {
    const enabled = provider === 'deepseek' ? this.draftDeepSeekBalanceAlertEnabled : this.draftKimiBalanceAlertEnabled;
    const amount = provider === 'deepseek' ? this.draftDeepSeekLowBalance : this.draftKimiLowBalance;
    enabled.set(checked);
    if (checked && amount() === null) amount.set(10);
  }

  protected onLowBalanceInput(provider: 'deepseek' | 'kimi', event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const parsed = raw === '' ? null : Number(raw);
    const value = parsed !== null && Number.isFinite(parsed) ? Math.max(0, parsed) : null;
    if (provider === 'deepseek') this.draftDeepSeekLowBalance.set(value);
    else this.draftKimiLowBalance.set(value);
  }

  /** 存檔回應（'settings' 訊息）到達時才真的覆蓋 active 值，見 onHostMessage——不是這裡樂觀更新，
   * 因為閾值變動會連動一次完整刷新（見 Program.cs），active 值要跟後端回傳的卡片資料同步生效。 */
  protected saveSettings(): void {
    this.settingsSaveStatus.set('saving');
    this.send({
      type: 'update-settings',
      refreshIntervalMinutes: this.draftRefreshInterval(),
      attentionThresholdPercent: this.draftAttentionThreshold(),
      nearLimitThresholdPercent: this.draftNearLimitThreshold(),
      deepSeekAttentionBalanceThresholdUsd: null,
      deepSeekLowBalanceThresholdUsd: this.draftDeepSeekBalanceAlertEnabled() ? this.draftDeepSeekLowBalance() : null,
      kimiAttentionBalanceThresholdUsd: null,
      kimiLowBalanceThresholdUsd: this.draftKimiBalanceAlertEnabled() ? this.draftKimiLowBalance() : null,
      usageHistoryEnabled: this.draftUsageHistoryEnabled(),
      claudeWakeUpEnabled: this.draftClaudeWakeUpEnabled(),
      claudeWakeUpAccountHours: Object.fromEntries(this.draftClaudeWakeUpAccountHours()),
    });
  }

  /** 真的結束程式，不是關視窗——關視窗的預設行為是隱藏到 Dock／工作列（見 Program.cs 的
   *  RegisterWindowClosingHandler），process 還在跑。這裡送 quit 訊息讓後端主動
   *  Environment.Exit(0)，才是真的退出。 */
  protected quitApp(): void {
    this.sendSilent({ type: 'quit' });
  }

  /** md/xlsx 匯出——存檔對話框（原生「另存新檔」視窗）跟寫檔都在後端做，這裡只負責發訊息跟收結果。
   *  用 sendSilent 而非 send()：這不是一次用量刷新，用 send() 會連帶點亮清單頁的刷新中圖示，
   *  在設定頁裡做這個動作會讓使用者困惑「怎麼跑去刷新卡片了」。 */
  protected exportUsageHistory(format: 'md' | 'xlsx'): void {
    this.historyExportStatus.set('pending');
    this.historyExportError.set(null);
    this.sendSilent({ type: 'export-usage-history', exportFormat: format, lang: this.lang() });
  }

  /** 匯出最近 30 天完整本機掃描結果，不跟著畫面上目前的月／週／日篩選。 */
  protected exportLocalUsage(): void {
    this.localUsageExportStatus.set('pending');
    this.localUsageExportError.set(null);
    this.sendSilent({ type: 'export-local-token-usage', exportFormat: 'xlsx', lang: this.lang() });
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

  /** API key 制：真的送出金鑰驗證。Claude/Codex：擷取目前 CLI 登入。其他訂閱：偵測本機 session。 */
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
  protected startRename(item: RenameableAccount): void {
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

  protected connectionStateLabel(state: ConnectionState): string {
    return this.t(
      (
        {
          valid: 'connectionValid',
          invalid: 'connectionInvalid',
          expired: 'connectionExpired',
          not_configured: 'connectionNotConfigured',
        } as const
      )[state],
    );
  }

  /** 憲法 §4：用量狀態 正常=綠(0-80%) / 接近上限=橘(80-99%) / 超額=紅(100%) — badge 覆寫色。 */
  protected usageBadgeClass(state: UsageState): string {
    return (
      {
        normal: 'border-transparent bg-[var(--sanring-success-50)] text-[var(--sanring-success-90)]',
        attention: 'border-transparent bg-[var(--sanring-warn-50)] text-[var(--sanring-warn-90)]',
        near_limit: 'border-transparent bg-[var(--sanring-caution-50)] text-[var(--sanring-caution-90)]',
        exceeded: 'border-transparent bg-[var(--sanring-error-50)] text-[var(--sanring-error-90)]',
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
        attention: this.t('stateAttention'),
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
        attention: 'bg-[var(--sanring-warn-50)]',
        near_limit: 'bg-[var(--sanring-caution-50)]',
        exceeded: 'bg-[var(--sanring-error-50)]',
        unknown: 'bg-[var(--sanring-neutral-40)]',
      } satisfies Record<UsageState, string>
    )[state];
  }

  /** 同一組狀態，這次只取前景色——健康度區塊的心跳圖示用，跟 badge/bar 共用色階但不要背景色。 */
  protected healthIconClass(state: UsageState): string {
    return (
      {
        normal: 'text-[var(--sanring-success-fg)]',
        attention: 'text-[var(--sanring-warn-fg)]',
        near_limit: 'text-[var(--sanring-caution-fg)]',
        exceeded: 'text-[var(--sanring-error-fg)]',
        unknown: 'text-[var(--sanring-muted)]',
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
        usageHistory?: UsageHistoryPointWire[];
        claudeTokenLedger?: TokenLedgerWire;
        codexTokenLedger?: TokenLedgerWire;
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

      if (payload.type === 'usage-history') {
        if (payload.usageHistory) this.usageHistory.set(payload.usageHistory);
        this.claudeTokenLedger.set(payload.claudeTokenLedger ?? null);
        this.codexTokenLedger.set(payload.codexTokenLedger ?? null);
        return;
      }

      // get-settings（啟動時）跟 update-settings（存檔後）的回應是同一種訊息——後者多了「存檔中」
      // 的短暫確認提示，前者純粹是把 active 值填進來。
      if (payload.type === 'settings' && payload.settings) {
        this.refreshIntervalMinutes.set(payload.settings.refreshIntervalMinutes);
        this.attentionThresholdPercent.set(payload.settings.attentionThresholdPercent);
        this.nearLimitThresholdPercent.set(payload.settings.nearLimitThresholdPercent);
        this.deepSeekAttentionBalanceThresholdUsd.set(payload.settings.deepSeekAttentionBalanceThresholdUsd);
        this.deepSeekLowBalanceThresholdUsd.set(payload.settings.deepSeekLowBalanceThresholdUsd);
        this.kimiAttentionBalanceThresholdUsd.set(payload.settings.kimiAttentionBalanceThresholdUsd);
        this.kimiLowBalanceThresholdUsd.set(payload.settings.kimiLowBalanceThresholdUsd);
        this.usageHistoryEnabled.set(payload.settings.usageHistoryEnabled);
        this.claudeWakeUpEnabled.set(payload.settings.claudeWakeUpEnabled);
        this.claudeWakeUpAccountHours.set(new Map(Object.entries(payload.settings.claudeWakeUpAccountHours)));
        if (this.settingsSaveStatus() === 'saving') {
          this.settingsSaveStatus.set('saved');
          setTimeout(() => this.settingsSaveStatus.set('idle'), 1500);
        }
        return;
      }

      // 新增來源的結果後端會單獨送一則。Claude/Codex 擷取成功後停在這一頁，方便接著換帳再擷取。
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
          const captured = addedAccounts[0].sourceType === 'subscription' &&
            (addedAccounts[0].source.startsWith('claude:') || addedAccounts[0].source.startsWith('codex:'));
          this.addResultMessage.set(
            captured
              ? addedAccounts.length === 1
                ? this.t('capturedSuccess', { name: addedAccounts[0].accountLabel ?? addedAccounts[0].displayName })
                : this.t('capturedSuccessMultiple', { count: String(addedAccounts.length) })
              : addedAccounts.length === 1
                ? this.t('addedSuccess', { name: addedAccounts[0].accountLabel ?? addedAccounts[0].displayName })
                : this.t('addedSuccessMultiple', { count: String(addedAccounts.length) }),
          );
          if (!captured) setTimeout(() => this.closeAddView(), 900);
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
        this.pulseJustRefreshed();
        return;
      }

      if (payload.type === 'usage-history-exported') {
        this.historyExportStatus.set('success');
        setTimeout(() => this.historyExportStatus.set('idle'), 1500);
        return;
      }

      // 使用者在「另存新檔」視窗按取消——不算錯誤，只是把按鈕從 pending 收回 idle。
      if (payload.type === 'usage-history-export-cancelled') {
        this.historyExportStatus.set('idle');
        return;
      }

      if (payload.type === 'local-token-usage-exported') {
        this.localUsageExportStatus.set('success');
        setTimeout(() => this.localUsageExportStatus.set('idle'), 1500);
        return;
      }

      if (payload.type === 'local-token-usage-export-cancelled') {
        this.localUsageExportStatus.set('idle');
        return;
      }

      if (payload.error) {
        // 匯出中發生的錯誤（例如還沒有任何記錄）顯示在設定頁按鈕旁邊，不是清單頁那個全域的
        // lastError——使用者這時人在設定頁，清單頁的錯誤提示他根本看不到。
        if (this.localUsageExportStatus() === 'pending') {
          this.localUsageExportStatus.set('error');
          this.localUsageExportError.set(payload.error);
        } else if (this.historyExportStatus() === 'pending') {
          this.historyExportStatus.set('error');
          this.historyExportError.set(payload.error);
        } else {
          this.lastError.set(payload.error);
        }
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
