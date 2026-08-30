namespace UsageMonitor.Desktop.Models;

/// <summary>Wire format sent to the frontend. Matches PRD §7 `UsageSummary`.</summary>
public sealed record UsageSummary(
    string Source,
    string DisplayName,
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
    string? SecondaryDetail = null        // caption for the SECONDARY window — kept separate from Detail so the UI can put each window's caption under its own progress bar instead of one merged line
);
