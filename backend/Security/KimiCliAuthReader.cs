using System.Text.Json;

namespace UsageMonitor.Desktop.Security;

/// <summary>
/// Reads Kimi Code CLI's own OAuth session — same read-only spirit as <see cref="ClaudeAuthReader"/> /
/// <see cref="CodexAuthReader"/>. Storage location per `MoonshotAI/kimi-code`'s open-source `packages/
/// oauth/src/storage.ts`: `~/.kimi-code/credentials/kimi-code.json`, snake_case wire format
/// (`access_token`/`refresh_token`/`expires_at`/...), plaintext with 0600/0700 permissions.
/// NOT VERIFIED against a real Kimi Code login — nobody on this project has an account yet (see PRD).
/// </summary>
public static class KimiCliAuthReader
{
    public static string? Read()
    {
        var path = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".kimi-code", "credentials", "kimi-code.json");

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
            var accessToken = doc.RootElement.TryGetProperty("access_token", out var at) ? at.GetString() : null;
            return string.IsNullOrEmpty(accessToken) ? null : accessToken;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
