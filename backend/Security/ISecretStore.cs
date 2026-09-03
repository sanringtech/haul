namespace UsageMonitor.Desktop.Security;

/// <summary>
/// OS-native secret storage for user-supplied API keys (DeepSeek/Kimi — constitution R2/I2).
/// API keys 用 accountId 當 key；訂閱制快照另外加 <c>sub:</c> 前綴（見 SubscriptionSnapshotStore）。
/// Backed by macOS Keychain Services / Windows Credential Manager — never a plain local file.
/// </summary>
public interface ISecretStore
{
    /// <summary>Returns null if nothing is stored for this source.</summary>
    string? Get(string sourceId);

    void Set(string sourceId, string apiKey);

    /// <summary>Must be called on "取消追蹤" (constitution §8) — full deletion, not just hiding.</summary>
    void Delete(string sourceId);
}
