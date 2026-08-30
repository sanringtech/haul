namespace UsageMonitor.Desktop.Models;

/// <summary>Wire format sent to the frontend. Matches PRD §7 `UsageSummary`.</summary>
public sealed record UsageSummary(
    string Source,               // now an accountId, not a bare sourceId — unique per tracked account (multi-account support)
    string DisplayName,          // AI 類型顯示名稱（例如 "DeepSeek"）— shared by every account of that type
    string SourceType,          // "subscription" | "api_key"
    double? PercentUsed,        // null when there's no known quota to divide by
    string UsageState,          // "normal" | "near_limit" | "exceeded" | "unknown"
    string ConnectionState,     // "not_configured" | "valid" | "invalid" | "expired"
    bool IsEstimated,
    string AsOf,
    string? Detail = null,               // human-readable caption for the PRIMARY window (raw token count, error message, reset time, ...)
    string? PercentUsedLabel = null,      // e.g. "5 小時" — only set when a source has more than one window
    double? SecondaryPercentUsed = null,  // e.g. Claude's 7-day window alongside the 5-hour one above
    string? SecondaryUsageState = null,
    string? SecondaryPercentUsedLabel = null,
    string? SecondaryDetail = null,       // caption for the SECONDARY window — kept separate from Detail so the UI can put each window's caption under its own progress bar instead of one merged line
    string? AccountLabel = null           // 帳號副標題（例如 "DeepSeek #2"）— null 時前端不顯示副標題列，維持單帳號來源原本的乾淨畫面
);
