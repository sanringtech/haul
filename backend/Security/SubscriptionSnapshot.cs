namespace UsageMonitor.Desktop.Security;

/// <summary>
/// 一組訂閱制 CLI 登入的本機快照。Haul 用自己的 refresh 續期，絕不寫回 Claude Code /
/// Codex CLI 的登入檔（憲法 R4：不自動切帳）。
/// </summary>
public sealed record SubscriptionSnapshot(
    string AccountId,
    string SourceId,
    string Email,
    string AccessToken,
    string RefreshToken,
    long? AccessExpiresAtMs,
    string? SubscriptionType,
    string? ExternalAccountId);
