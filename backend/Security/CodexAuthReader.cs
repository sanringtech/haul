using System.Text.Json;

namespace UsageMonitor.Desktop.Security;

public sealed record CodexAuthToken(string AccessToken, string AccountId);

/// <summary>
/// Reads Codex CLI's own ChatGPT-login session — same read-only spirit as <see cref="ClaudeAuthReader"/>.
/// Storage location mirrors Codex CLI itself: `&lt;CODEX_HOME ?? ~/.codex&gt;/auth.json`, holding
/// `{ "tokens": { "access_token", "refresh_token", "account_id", ... } }`. Cross-platform — Codex CLI
/// doesn't use the macOS Keychain the way Claude Code does, it's a plain file everywhere.
/// </summary>
public static class CodexAuthReader
{
    public static CodexAuthToken? Read()
    {
        var codexHome = Environment.GetEnvironmentVariable("CODEX_HOME");
        var baseDir = string.IsNullOrEmpty(codexHome)
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".codex")
            : codexHome;
        var path = Path.Combine(baseDir, "auth.json");

        string json;
        try
        {
            if (!File.Exists(path)) return null;
            json = File.ReadAllText(path);
        }
        catch
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("tokens", out var tokens)) return null;

            var accessToken = tokens.TryGetProperty("access_token", out var at) ? at.GetString() : null;
            var accountId = tokens.TryGetProperty("account_id", out var aid) ? aid.GetString() : null;
            if (string.IsNullOrEmpty(accessToken) || string.IsNullOrEmpty(accountId)) return null;

            return new CodexAuthToken(accessToken, accountId);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
