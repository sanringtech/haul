using UsageMonitor.Desktop.Models;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// One source = one implementation (constitution R1: Claude / Codex / DeepSeek / Kimi).
/// Adding a fifth source later should only mean adding a new class here, per PRD §9 risk mitigation.
/// </summary>
public interface IUsageProvider
{
    string SourceId { get; }        // "claude" | "codex" | "deepseek" | "kimi"
    string DisplayName { get; }
    string SourceType { get; }      // "subscription" | "api_key"

    Task<UsageSummary> GetUsageAsync(AppSettings settings, CancellationToken ct);
}
