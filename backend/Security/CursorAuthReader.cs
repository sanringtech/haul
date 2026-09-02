using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace UsageMonitor.Desktop.Security;

public sealed record CursorAuthToken(string AccessToken, long? ExpiresAtMs, string? PlanType, string? UserId);

/// <summary>
/// Reads Cursor's own local login session — same read-only spirit as <see cref="ClaudeAuthReader"/> /
/// <see cref="CodexAuthReader"/>, but a different storage mechanism: Cursor (an Electron/VS Code fork)
/// keeps its session in a SQLite database, not the macOS Keychain or a plaintext JSON file. Verified
/// 2026-09-01 against a real local Cursor login on this machine (see AI-LANDSCAPE.md for the full
/// investigation) — <c>cursorAuth/accessToken</c> is a JWT; its own <c>exp</c> claim tells us when it
/// expires, no need to call anything to find out. Unlike Claude's multi-account problem, there is only
/// ever one "currently logged in" Cursor session (no swap-file complexity), so this mirrors the plain
/// single-account read-only pattern <see cref="CodexAuthReader"/> already uses — no refresh
/// implementation needed; an expired token just means "open Cursor to refresh your login", same as
/// Claude's local-credentials-expired path.
///
/// Storage location:
///   - macOS: <c>~/Library/Application Support/Cursor/User/globalStorage/state.vscdb</c>
///   - Windows (unverified, per Electron/VS Code convention): <c>%AppData%\Cursor\User\globalStorage\state.vscdb</c>
///   - Linux (unverified): <c>~/.config/Cursor/User/globalStorage/state.vscdb</c>
/// </summary>
public static class CursorAuthReader
{
    private const long ExpiryBufferMs = 60_000; // same "about to expire = expired" buffer as ClaudeAuthReader

    public static CursorAuthToken? Read()
    {
        var path = DatabasePath();
        if (path is null || !File.Exists(path)) return null;

        string? accessToken;
        string? planType;
        try
        {
            // Mode=ReadOnly: Cursor itself may have the file open — never contend for a write lock on
            // someone else's live session database. (Tried adding Immutable=1 too, to skip SQLite's
            // locking entirely — Microsoft.Data.Sqlite's connection string builder doesn't support that
            // keyword despite the underlying SQLite C library supporting it as a URI parameter; ReadOnly
            // alone is enough for our purposes, just no longer completely lock-free.)
            using var connection = new SqliteConnection($"Data Source={path};Mode=ReadOnly");
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'";
            accessToken = command.ExecuteScalar() as string;
            command.CommandText = "SELECT value FROM ItemTable WHERE key = 'cursorAuth/stripeMembershipType'";
            planType = command.ExecuteScalar() as string;
        }
        catch (SqliteException)
        {
            return null;
        }

        if (string.IsNullOrEmpty(accessToken)) return null;
        var (expiresAtMs, userId) = ReadJwtClaims(accessToken);
        return new CursorAuthToken(accessToken, expiresAtMs, planType, userId);
    }

    public static bool IsExpired(CursorAuthToken token)
    {
        if (token.ExpiresAtMs is not { } expiresAt) return false;
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        return nowMs + ExpiryBufferMs >= expiresAt;
    }

    /// <summary>Decodes the JWT payload for <c>exp</c> and <c>sub</c> — no signature verification.
    /// <c>sub</c> is the Cursor user id needed for the dashboard session cookie
    /// (<c>WorkosCursorSessionToken={sub}::{accessToken}</c>), same as the settings page.</summary>
    private static (long? ExpiresAtMs, string? UserId) ReadJwtClaims(string jwt)
    {
        var parts = jwt.Split('.');
        if (parts.Length != 3) return (null, null);

        try
        {
            var payloadJson = Base64UrlDecode(parts[1]);
            using var doc = JsonDocument.Parse(payloadJson);
            long? expiresAtMs = null;
            if (doc.RootElement.TryGetProperty("exp", out var exp) && exp.TryGetInt64(out var expSeconds))
                expiresAtMs = expSeconds * 1000;
            var userId = doc.RootElement.TryGetProperty("sub", out var sub) ? sub.GetString() : null;
            return (expiresAtMs, string.IsNullOrEmpty(userId) ? null : userId);
        }
        catch (Exception ex) when (ex is FormatException or JsonException)
        {
            // Malformed/unexpected token shape — treat as "expiry unknown", same as ClaudeAuthReader
            // does when the OAuth JSON has no expiresAt: caller proceeds and lets the actual HTTP call
            // surface a 401 if the token really is dead, rather than guessing.
        }
        return (null, null);
    }

    private static string Base64UrlDecode(string input)
    {
        var s = input.Replace('-', '+').Replace('_', '/');
        s += new string('=', (4 - s.Length % 4) % 4);
        return System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(s));
    }

    private static string? DatabasePath()
    {
        var appData = OperatingSystem.IsMacOS()
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Library", "Application Support")
            : OperatingSystem.IsWindows()
                ? Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".config");
        return Path.Combine(appData, "Cursor", "User", "globalStorage", "state.vscdb");
    }
}
