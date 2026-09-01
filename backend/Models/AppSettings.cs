namespace UsageMonitor.Desktop.Models;

/// <summary>
/// Persisted locally as JSON (see <see cref="Services.AppPaths"/>). Never holds secrets —
/// API keys go through <see cref="Security.ISecretStore"/> (OS keychain), per constitution I2.
/// </summary>
public sealed class AppSettings
{
    /// <summary>Minutes between automatic refreshes. Null = manual only (constitution §9).</summary>
    public int? RefreshIntervalMinutes { get; set; } = 60;

    /// <summary>Yellow "attention" threshold. May equal NearLimit; orange wins when equal.</summary>
    public int AttentionThresholdPercent { get; set; } = 70;

    /// <summary>Orange "near limit" threshold, 50-95. Must not be lower than Attention.</summary>
    public int NearLimitThresholdPercent { get; set; } = 85;

    /// <summary>
    /// Token ceiling for the active Claude 5-hour block, used to compute PercentUsed via `ccusage --token-limit`.
    /// Anthropic doesn't publish this per plan tier, so it's left for the user to set — until then Claude's
    /// UsageState reports "unknown" instead of guessing (PRD §12 TODO).
    /// </summary>
    public int? ClaudeTokenLimit { get; set; }

    /// <summary>
    /// DeepSeek/Kimi report an absolute USD balance, not a percentage — there's no "total budget" to
    /// divide by unless the user tells us one. Null = can't compute a state, just show the raw balance.
    /// </summary>
    public double? DeepSeekLowBalanceThresholdUsd { get; set; }

    public double? DeepSeekAttentionBalanceThresholdUsd { get; set; }

    public double? KimiLowBalanceThresholdUsd { get; set; }

    public double? KimiAttentionBalanceThresholdUsd { get; set; }

    /// <summary>Account ids the user has hidden (constitution §8 "關閉顯示") — data/keys stay, just not shown.</summary>
    public List<string> HiddenAccountIds { get; set; } = [];

    /// <summary>
    /// Accounts the user has explicitly added via the "＋ 新增來源" flow (憲法 R5：多帳號各自獨立).
    /// Default empty — a fresh install shows nothing until the user adds something. Subscription-type
    /// sources (Claude/Codex) only ever have one entry here (one person, one active login); api_key-type
    /// sources (DeepSeek/Kimi) can have several, each its own TrackedAccount with its own AccountId.
    /// </summary>
    public List<TrackedAccount> TrackedAccounts { get; set; } = [];
}
