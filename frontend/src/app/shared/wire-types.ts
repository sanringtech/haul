// 主視窗（app.ts）跟浮動小工具（widget/widget-app.ts）都是獨立的 PhotinoWindow，各自載入同一份
// index.html（見 backend/Program.cs），但都要跟同一支 C# 後端講同一種 wire format——這份檔案是
// 兩邊共用的型別定義，避免兩份重複維護、定義飄走。

declare global {
  // lib.dom.d.ts already declares `Window.external: External`. Photino.NET
  // injects these two methods onto it at runtime; merge them in rather than
  // redeclaring `external` itself (that would conflict with the DOM lib).
  interface External {
    sendMessage?: (message: string) => void;
    receiveMessage?: (callback: (message: string) => void) => void;
  }
}

export type SourceType = 'subscription' | 'api_key';
export type UsageState = 'normal' | 'near_limit' | 'exceeded' | 'unknown';
export type ConnectionState = 'not_configured' | 'valid' | 'invalid' | 'expired';

/** Mirrors backend/Models/LocalizedText.cs — a message key + interpolation params, rendered via t(). */
export interface LocalizedMessage {
  key: string;
  params?: Record<string, string> | null;
}

/** Mirrors backend/Models/UsageSummary.cs (camelCase on the wire, see Program.cs jsonOptions). */
export interface UsageSummary {
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
  detail: LocalizedMessage | null;
  /** Set when a source has more than one quota window (Claude: 5h + 7d) — see backend for why. */
  percentUsedLabel: LocalizedMessage | null;
  secondaryPercentUsed: number | null;
  secondaryUsageState: UsageState | null;
  secondaryPercentUsedLabel: LocalizedMessage | null;
  secondaryDetail: LocalizedMessage | null;
  /** 帳號副標題（例如 "DeepSeek #2"）——null 時代表這個來源目前只有單一帳號，不用另外標示。 */
  accountLabel: string | null;
  /** Short plan name only (Max / Pro / Plus); null when the provider cannot detect it reliably. */
  planLabel: string | null;
}

/** Mirrors backend/UsageService.cs's HiddenAccountEntry — 「已隱藏的來源」列表用，不含即時用量。 */
export interface HiddenAccountEntry {
  accountId: string;
  displayName: string;
  accountLabel: string | null;
  sourceType: SourceType;
}
