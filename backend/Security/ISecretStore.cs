namespace UsageMonitor.Desktop.Security;

/// <summary>
/// OS-native secret storage for user-supplied API keys (DeepSeek/Kimi — constitution R2/I2).
/// Never used for Claude/Codex, which read existing local CLI usage logs instead of holding a secret.
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
