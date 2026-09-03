using System.Diagnostics;
using System.Text.Json;

namespace UsageMonitor.Desktop.Security;

public sealed record ClaudeAuthToken(
    string AccessToken,
    string? RefreshToken,
    long? ExpiresAtMs,
    string? SubscriptionType,
    string? Email,
    string? AccountUuid);

/// <summary>
/// Reads Claude Code's own OAuth session — the same one `claude` itself uses — so
/// <see cref="Providers.ClaudeUsageProvider"/> can call Anthropic's official usage endpoint instead of
/// estimating from local logs. This is deliberately read-only: we never write, refresh, or otherwise
/// touch Claude Code's session, only look at it.
///
/// Storage location mirrors Claude Code itself (reverse-engineered from the open-source `claude-swap`
/// tool, which does the same lookup for its account-switching feature):
///   - macOS: Keychain service "Claude Code-credentials", account = current username
///   - Everywhere else (and as a macOS fallback): plaintext `&lt;CLAUDE_CONFIG_DIR ?? ~/.claude&gt;/.credentials.json`
/// Both hold `{ "claudeAiOauth": { "accessToken", "refreshToken", "expiresAt", ... } }`.
/// Account identity (email) is usually in <c>~/.claude.json</c> <c>oauthAccount</c>, not the oauth blob.
/// </summary>
public static class ClaudeAuthReader
{
    private const string KeychainService = "Claude Code-credentials";
    private const long ExpiryBufferMs = 60_000; // treat "about to expire" the same as "expired"

    public static ClaudeAuthToken? Read()
    {
        var json = (OperatingSystem.IsMacOS() ? ReadFromMacKeychain() : null) ?? ReadFromPlaintextFile();
        if (json is null) return null;

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("claudeAiOauth", out var oauth)) return null;

            var accessToken = oauth.TryGetProperty("accessToken", out var at) ? at.GetString() : null;
            if (string.IsNullOrEmpty(accessToken)) return null;

            var refreshToken = oauth.TryGetProperty("refreshToken", out var rft) ? rft.GetString() : null;
            long? expiresAt = oauth.TryGetProperty("expiresAt", out var exp) && exp.TryGetInt64(out var v) ? v : null;
            var subscriptionType = oauth.TryGetProperty("subscriptionType", out var sub) ? sub.GetString() : null;
            var (configEmail, configUuid) = ReadOauthAccountFromClaudeJson();
            var email = FirstNonEmpty(
                oauth.TryGetProperty("email", out var em) ? em.GetString() : null,
                JwtEmail.TryRead(accessToken),
                configEmail);
            var accountUuid = FirstNonEmpty(
                oauth.TryGetProperty("accountUuid", out var au) ? au.GetString() : null,
                configUuid);
            return new ClaudeAuthToken(accessToken, refreshToken, expiresAt, subscriptionType, email, accountUuid);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static bool IsExpired(ClaudeAuthToken token)
    {
        if (token.ExpiresAtMs is not { } expiresAt) return false;
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        return nowMs + ExpiryBufferMs >= expiresAt;
    }

    private static string? ReadFromMacKeychain()
    {
        try
        {
            var psi = new ProcessStartInfo("/usr/bin/security")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            var account = Environment.GetEnvironmentVariable("USER") is { Length: > 0 } user ? user : Environment.UserName;
            foreach (var arg in new[] { "find-generic-password", "-a", account, "-s", KeychainService, "-w" })
                psi.ArgumentList.Add(arg);

            using var process = Process.Start(psi);
            if (process is null) return null;
            var stdout = process.StandardOutput.ReadToEnd();
            process.WaitForExit();
            return process.ExitCode == 0 && !string.IsNullOrWhiteSpace(stdout) ? stdout.Trim() : null;
        }
        catch
        {
            return null; // Keychain unavailable/locked — caller falls back to the plaintext file.
        }
    }

    /// <summary>
    /// Claude Code 把「目前登入是誰」寫在家目錄 <c>~/.claude.json</c> 的
    /// <c>oauthAccount.emailAddress</c>，Keychain oauth blob 通常沒有 email。
    /// </summary>
    private static (string? Email, string? AccountUuid) ReadOauthAccountFromClaudeJson()
    {
        var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude.json");
        try
        {
            if (!File.Exists(path)) return (null, null);
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            if (!doc.RootElement.TryGetProperty("oauthAccount", out var acc)) return (null, null);
            var email = acc.TryGetProperty("emailAddress", out var em) ? em.GetString() : null;
            var uuid = acc.TryGetProperty("accountUuid", out var id) ? id.GetString() : null;
            return (email, uuid);
        }
        catch
        {
            return (null, null);
        }
    }

    private static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var v in values)
            if (!string.IsNullOrEmpty(v)) return v;
        return null;
    }

    private static string? ReadFromPlaintextFile()
    {
        var configHome = Environment.GetEnvironmentVariable("CLAUDE_CONFIG_DIR");
        var baseDir = string.IsNullOrEmpty(configHome)
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude")
            : configHome;
        var path = Path.Combine(baseDir, ".credentials.json");
        try
        {
            return File.Exists(path) ? File.ReadAllText(path) : null;
        }
        catch
        {
            return null;
        }
    }
}
