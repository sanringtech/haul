using UsageMonitor.Desktop.Models;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// One implementation per AI type (constitution R1: Claude / Codex / DeepSeek / Kimi). A single
/// provider instance can serve multiple <see cref="TrackedAccount"/>s of that type (e.g. two DeepSeek
/// accounts each call GetUsageAsync with their own account, same provider).
/// </summary>
public interface IUsageProvider
{
    string SourceId { get; }        // "claude" | "codex" | "deepseek" | "kimi"
    string DisplayName { get; }
    string SourceType { get; }      // "subscription" | "api_key"

    Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct);
}
