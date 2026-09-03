using System.Text.Json;

namespace UsageMonitor.Desktop.Security;

/// <summary>
/// Reads Kimi Code CLI's own OAuth session — same read-only spirit as <see cref="ClaudeAuthReader"/> /
/// <see cref="CodexAuthReader"/>. Tokens live in <c>~/.kimi-code/credentials/</c> as snake_case JSON
/// (<c>access_token</c>/…), mode 0600. Older CLI wrote <c>kimi-code.json</c>; current CLI on this
/// machine writes <c>kimi-code-env-{hash}.json</c> (storage name is the OAuth key, see kimi-code
/// <c>packages/oauth/src/storage.ts</c> <c>pathFor(name)</c>). Prefer the legacy filename, else the
/// newest <c>*.json</c> in that directory.
/// </summary>
public static class KimiCliAuthReader
{
    public static string? Read()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".kimi-code", "credentials");
        var path = ResolvePath(dir);
        if (path is null) return null;

        string json;
        try
        {
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

    private static string? ResolvePath(string dir)
    {
        var legacy = Path.Combine(dir, "kimi-code.json");
        if (File.Exists(legacy)) return legacy;
        if (!Directory.Exists(dir)) return null;
        try
        {
            return Directory.GetFiles(dir, "*.json")
                .OrderByDescending(File.GetLastWriteTimeUtc)
                .FirstOrDefault();
        }
        catch
        {
            return null;
        }
    }
}
