using System.Text.Json;
using UsageMonitor.Desktop.Services;

namespace UsageMonitor.Desktop.Security;

public sealed record CodexAuthToken(string AccessToken, string? RefreshToken, string AccountId, string? Email);

/// <summary>
/// Reads Codex CLI's own ChatGPT-login session — same read-only spirit as <see cref="ClaudeAuthReader"/>.
/// Storage location mirrors Codex CLI itself: <c>{CODEX_HOME ?? ~/.codex}/auth.json</c>, holding
/// `{ "tokens": { "access_token", "refresh_token", "account_id", ... } }`. On Windows,
/// <see cref="CliHomeRoots"/> also includes running WSL homes. Duplicate account ids keep one
/// copy: has refresh token, then Windows home over WSL.
/// </summary>
public static class CodexAuthReader
{
    public static CodexAuthToken? Read() => ReadAll().FirstOrDefault();

    public static IReadOnlyList<CodexAuthToken> ReadAll()
    {
        var ranked = new List<(CodexAuthToken Token, int Rank, string Key)>();
        var homes = CliHomeRoots.CodexHomes().ToList();
        var windowsCodex = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".codex");

        foreach (var home in homes)
        {
            var token = Parse(Path.Combine(home, "auth.json"));
            if (token is null) continue;
            var isWindows = CliHomeRoots.PathsEqual(home, windowsCodex);
            ranked.Add((token, Rank(token, isWindows), token.Email ?? token.AccountId));
        }

        return [.. ranked
            .GroupBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderBy(x => x.Rank).First().Token)];
    }

    private static int Rank(CodexAuthToken token, bool isWindowsProfile) =>
        (string.IsNullOrEmpty(token.RefreshToken) ? 2 : 0) + (isWindowsProfile ? 0 : 1);

    private static CodexAuthToken? Parse(string path)
    {
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
            var refreshToken = tokens.TryGetProperty("refresh_token", out var rft) ? rft.GetString() : null;
            var accountId = tokens.TryGetProperty("account_id", out var aid) ? aid.GetString() : null;
            if (string.IsNullOrEmpty(accessToken) || string.IsNullOrEmpty(accountId)) return null;
            var email = JwtEmail.TryRead(accessToken);

            return new CodexAuthToken(accessToken, refreshToken, accountId, email);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
