using System.Text.Json;
using UsageMonitor.Desktop.Services;

namespace UsageMonitor.Desktop.Security;

public sealed record GrokAuthToken(string AccessToken, string UserId, string? Email);

/// <summary>
/// Reads Grok Build CLI's session from <c>$GROK_HOME/auth.json</c> (default <c>~/.grok/auth.json</c>).
/// Shape and scope keys come from open-source <c>xai-org/grok-build</c>
/// (<c>crates/codegen/xai-grok-shell/src/auth/{storage,model,config}.rs</c>).
/// Read-only — never writes or refreshes (constitution: do not write CLI login files).
/// </summary>
public static class GrokAuthReader
{
    /// <summary>Default xAI OAuth2 client id from grok-build <c>GrokComConfig::default</c>.</summary>
    internal const string DefaultOauthScope = "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828";

    public static GrokAuthToken? Read()
    {
        foreach (var home in CliHomeRoots.GrokHomes())
        {
            var token = ReadFromPath(Path.Combine(home, "auth.json"));
            if (token is not null) return token;
        }
        return null;
    }

    private static GrokAuthToken? ReadFromPath(string path)
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
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;

            if (TryReadEntry(doc.RootElement, DefaultOauthScope, out var preferred) && preferred is not null)
                return preferred;

            GrokAuthToken? fallback = null;
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.NameEquals(DefaultOauthScope)) continue;
                if (!TryParseUsable(prop.Value, out var token) || token is null) continue;
                if (prop.Name.StartsWith("https://auth.x.ai::", StringComparison.Ordinal))
                    return token;
                fallback ??= token;
            }
            return fallback;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool TryReadEntry(JsonElement root, string scope, out GrokAuthToken? token)
    {
        token = null;
        if (!root.TryGetProperty(scope, out var entry)) return false;
        return TryParseUsable(entry, out token);
    }

    private static bool TryParseUsable(JsonElement entry, out GrokAuthToken? token)
    {
        token = null;
        if (entry.ValueKind != JsonValueKind.Object) return false;

        var mode = entry.TryGetProperty("auth_mode", out var modeEl) ? modeEl.GetString() : null;
        if (IsSkippedMode(mode)) return false;

        var key = entry.TryGetProperty("key", out var keyEl) ? keyEl.GetString() : null;
        var userId = entry.TryGetProperty("user_id", out var uidEl) ? uidEl.GetString() : null;
        if (string.IsNullOrEmpty(key) || string.IsNullOrEmpty(userId)) return false;

        var email = entry.TryGetProperty("email", out var emailEl) ? emailEl.GetString() : null;
        token = new GrokAuthToken(key, userId, string.IsNullOrEmpty(email) ? null : email);
        return true;
    }

    /// <summary>
    /// Billing in grok-build requires grok.com session auth (<c>require_xai_auth</c>).
    /// Legacy WebLogin is skipped by the CLI itself; API-key scope has no subscription credits query.
    /// </summary>
    private static bool IsSkippedMode(string? mode)
    {
        if (string.IsNullOrEmpty(mode)) return false;
        return mode.Equals("web_login", StringComparison.OrdinalIgnoreCase)
            || mode.Equals("grok", StringComparison.OrdinalIgnoreCase)
            || mode.Equals("api_key", StringComparison.OrdinalIgnoreCase);
    }
}
