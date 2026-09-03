using System.Diagnostics;
using System.Text.Json;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Providers;
using UsageMonitor.Desktop.Services;

namespace UsageMonitor.Desktop.Security;

/// <summary>
/// 一次性從本機 cswap Keychain 匯入既有 Claude 帳號。匯入後不再 fork cswap。
/// list --json 只在這條升級路徑用，不是執行期 SSOT。
/// </summary>
public static class CswapImporter
{
    public static async Task<int> ImportIfNeededAsync(SubscriptionSnapshotStore store, CancellationToken ct)
    {
        var settings = SettingsStore.Load();
        if (settings.CswapImported) return 0;
        if (!OperatingSystem.IsMacOS())
        {
            settings.CswapImported = true;
            SettingsStore.Save(settings);
            return 0;
        }

        try
        {
            var (exitCode, stdout, _) = await ShellCommandRunner.RunAsync("cswap list --json", TimeSpan.FromSeconds(10), ct);
            if (exitCode != 0)
            {
                settings.CswapImported = true;
                SettingsStore.Save(settings);
                return 0;
            }

            using var listDoc = JsonDocument.Parse(stdout);
            if (!listDoc.RootElement.TryGetProperty("accounts", out var accounts))
            {
                settings.CswapImported = true;
                SettingsStore.Save(settings);
                return 0;
            }

            var imported = 0;
            foreach (var acc in accounts.EnumerateArray())
            {
                var email = acc.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
                var number = acc.TryGetProperty("number", out var numberProp) ? numberProp.GetInt32() : 0;
                if (string.IsNullOrEmpty(email) || number <= 0) continue;

                var json = ReadCswapKeychain(number, email);
                if (json is null) continue;
                var snap = ParseCswapOauth(json, email);
                if (snap is null) continue;

                store.Save(snap);
                var accountId = snap.AccountId;
                if (!settings.TrackedAccounts.Any(a => a.AccountId == accountId))
                    settings.TrackedAccounts.Add(new TrackedAccount(accountId, "claude", email));
                settings.HiddenAccountIds.Remove(accountId);
                imported++;
            }

            if (imported > 0)
            {
                settings.TrackedAccounts.RemoveAll(a => a.AccountId == "claude");
                settings.HiddenAccountIds.Remove("claude");
            }

            settings.CswapImported = true;
            SettingsStore.Save(settings);
            return imported;
        }
        catch
        {
            settings.CswapImported = true;
            SettingsStore.Save(settings);
            return 0;
        }
    }

    private static string? ReadCswapKeychain(int number, string email)
    {
        try
        {
            var psi = new ProcessStartInfo("/usr/bin/security")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            foreach (var arg in new[] { "find-generic-password", "-a", $"account-{number}-{email}", "-s", "claude-swap", "-w" })
                psi.ArgumentList.Add(arg);
            using var process = Process.Start(psi);
            if (process is null) return null;
            var stdout = process.StandardOutput.ReadToEnd();
            process.WaitForExit();
            return process.ExitCode == 0 && !string.IsNullOrWhiteSpace(stdout) ? stdout.Trim() : null;
        }
        catch
        {
            return null;
        }
    }

    private static SubscriptionSnapshot? ParseCswapOauth(string json, string email)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("claudeAiOauth", out var oauth)) return null;
            var access = oauth.TryGetProperty("accessToken", out var at) ? at.GetString() : null;
            var refresh = oauth.TryGetProperty("refreshToken", out var rt) ? rt.GetString() : null;
            if (string.IsNullOrEmpty(access) || string.IsNullOrEmpty(refresh)) return null;
            long? expires = oauth.TryGetProperty("expiresAt", out var exp) && exp.TryGetInt64(out var v) ? v : null;
            var sub = oauth.TryGetProperty("subscriptionType", out var st) ? st.GetString() : null;
            return new SubscriptionSnapshot(
                ClaudeUsageProvider.AccountIdFor(email),
                "claude",
                email,
                access,
                refresh,
                expires,
                sub,
                ExternalAccountId: null);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
