namespace UsageMonitor.Desktop.Models;

/// <summary>
/// Wire format sent to the frontend. Matches PRD §7 `UsageSummary`.
///
/// <see cref="Detail"/>/<see cref="PercentUsedLabel"/>/<see cref="SecondaryDetail"/>/
/// <see cref="SecondaryPercentUsedLabel"/> are <see cref="LocalizedText"/>, not plain strings — every
/// human-readable message a provider produces (errors, reset times, window labels) goes through the
/// frontend's own i18n table instead of being pre-rendered in Chinese here (2026-08-31，跟主題/語系一起
/// 做，見 README）。<see cref="DisplayName"/>/<see cref="AccountLabel"/> stay plain strings on purpose —
/// 前者是 "Codex"/"Kimi" 這類跨語言都一樣的英文專有名詞，後者是使用者自己輸入的自訂標籤，兩者都不是
/// 「後端組出來的句子」，沒有語言可言。
/// </summary>
public sealed record UsageSummary(
    string Source,               // now an accountId, not a bare sourceId — unique per tracked account (multi-account support)
    string DisplayName,          // AI 類型顯示名稱（例如 "DeepSeek"）— shared by every account of that type
    string SourceType,          // "subscription" | "api_key"
    double? PercentUsed,        // null when there's no known quota to divide by
    string UsageState,          // "normal" | "attention" | "near_limit" | "exceeded" | "unknown"
    string ConnectionState,     // "not_configured" | "valid" | "invalid" | "expired"
    bool IsEstimated,
    string AsOf,
    LocalizedText? Detail = null,               // caption for the PRIMARY window (raw token count, error message, reset time, ...)
    LocalizedText? PercentUsedLabel = null,      // e.g. "5 小時" — only set when a source has more than one window
    double? SecondaryPercentUsed = null,  // e.g. Claude's 7-day window alongside the 5-hour one above
    string? SecondaryUsageState = null,
    LocalizedText? SecondaryPercentUsedLabel = null,
    LocalizedText? SecondaryDetail = null,       // caption for the SECONDARY window — kept separate from Detail so the UI can put each window's caption under its own progress bar instead of one merged line
    string? AccountLabel = null,          // 帳號副標題（例如 "DeepSeek #2"）— null 時前端不顯示副標題列，維持單帳號來源原本的乾淨畫面
    string? PlanLabel = null              // 只放簡短方案名（Max / Pro / Plus）；無法可靠偵測時為 null，不猜測
);
