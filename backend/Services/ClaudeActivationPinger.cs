using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Providers;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// 「Claude 用量喚醒」——Claude 的 5 小時／7 天用量視窗是懶初始化的：帳號（或上一輪視窗到期後）
/// 沒送過訊息，視窗就停在「尚未開始」的狀態（`utilization: 0`、`resets_at: null`），跟 claude.ai
/// 網頁上「Starts when a message is sent」是同一回事，不是資料抓錯——完整查證見 AI-LANDSCAPE.md
/// 「Claude 視窗『懶初始化』行為」那節。這個服務對使用者在設定頁勾選的帳號，每天在各自設定的
/// 時刻（0-23 小時，本機時間）第一次送一則最小訊息把視窗喚醒。
///
/// **這是這個 app 唯一會真的消耗使用者用量額度的功能**——其餘所有請求（含這裡本身在讀的用量查詢）
/// 都是唯讀查詢，不花錢；這裡不一樣，會真的呼叫 Messages API、真的產生一筆對話紀錄。預設關閉，
/// 且要使用者自己在設定頁勾選帳號、設定時刻才會生效（見 AppSettings.ClaudeWakeUpEnabled 的文件
/// 註解）。
///
/// 沒有背景常駐排程——這個 app 沒有 tray/daemon 模式，時刻是 best-effort：每次
/// RespondWithSummaries()（一般的用量刷新）都會檢查一次，只有「今天這個帳號還沒打過、而且本機
/// 時間已經過了設定的時刻」才會真的送出請求，不是精準對時的鬧鐘——app 沒開、或使用者一直沒刷新，
/// 就不會準時觸發，只會等到下次真的有刷新時補打。
/// </summary>
public static class ClaudeActivationPinger
{
    private const string MessagesEndpoint = "https://api.anthropic.com/v1/messages";
    private const string OAuthBetaHeader = "oauth-2025-04-20"; // 跟 ClaudeUsageProvider 打 usage 端點同一組認證方式，2026-09-02 對 /v1/messages 實測過同樣有效
    private const string AnthropicVersion = "2023-06-01";
    // 特意選最小的模型 + 最短的 max_tokens——這個請求的唯一目的是「喚醒視窗」，不是要真的對話，
    // 要花的代價越小越好（實測過：8 個 input token + 8 個 output token，代價很小）。
    private const string Model = "claude-haiku-4-5-20251001";
    private const int MaxTokens = 8;
    private static readonly TimeSpan CswapTimeout = TimeSpan.FromSeconds(10);

    public static async Task PingIfDueAsync(CancellationToken ct = default)
    {
        var settings = SettingsStore.Load();
        if (!settings.ClaudeWakeUpEnabled || settings.ClaudeWakeUpAccountHours.Count == 0) return;

        var now = DateTime.Now;
        var today = now.ToString("yyyy-MM-dd");
        var changed = false;

        foreach (var (accountId, hour) in settings.ClaudeWakeUpAccountHours)
        {
            if (settings.ClaudeWakeUpLastPingDate.TryGetValue(accountId, out var lastDate) && lastDate == today)
                continue; // 今天已經打過，不用再打第二次

            if (now.Hour < hour) continue; // 還沒到使用者設定的時刻——best-effort，不是精準鬧鐘，
            // 只是「本機時間已經過了這個時刻」才觸發，下次刷新（或明天）再檢查一次。

            if (!accountId.StartsWith(ClaudeUsageProvider.CswapAccountPrefix, StringComparison.Ordinal)) continue;
            var email = accountId[ClaudeUsageProvider.CswapAccountPrefix.Length..];

            var token = await TryReadCswapAccessTokenAsync(email, ct);
            if (token is null) continue; // 讀不到（帳號被移除、cswap 掛了、不是 macOS…）就跳過，明天再試

            if (await TrySendPingAsync(token, ct))
            {
                settings.ClaudeWakeUpLastPingDate[accountId] = today;
                changed = true;
            }
        }

        if (changed) SettingsStore.Save(settings);
    }

    /// <summary>
    /// 讀 cswap 存在 Keychain 的完整憑證取出 accessToken——跟 ClaudeUsageProvider.
    /// TryReadCswapSubscriptionType 同一套讀法（service "claude-swap"，帳號名
    /// "account-{number}-{email}"），只是這裡要的是 accessToken 不是 subscriptionType。
    /// number 沒有存在 AppSettings 裡（cswap 自己的序號，帳號增減會變動），所以每次都重新
    /// 呼叫 cswap list --json 現查對應這個 email 的 number——一天最多一次，成本可以接受。
    /// token 是否還新鮮不在這裡處理：cswap 每次自己 list 的時候就會確保 token 沒過期，這裡
    /// 讀到的通常已經是它剛整理過的結果；萬一真的過期，Messages API 會回 401，這次喚醒
    /// 失敗、跳過，等明天下一輪重試，不在這裡另外實作一套 OAuth refresh。
    /// </summary>
    private static async Task<string?> TryReadCswapAccessTokenAsync(string email, CancellationToken ct)
    {
        if (!OperatingSystem.IsMacOS()) return null;

        try
        {
            var (exitCode, stdout, _) = await ShellCommandRunner.RunAsync("cswap list --json", CswapTimeout, ct);
            if (exitCode != 0) return null;

            using var listDoc = JsonDocument.Parse(stdout);
            if (!listDoc.RootElement.TryGetProperty("accounts", out var accounts)) return null;

            var number = -1;
            foreach (var acc in accounts.EnumerateArray())
            {
                if (acc.TryGetProperty("email", out var emailProp) &&
                    string.Equals(emailProp.GetString(), email, StringComparison.OrdinalIgnoreCase) &&
                    acc.TryGetProperty("number", out var numberProp))
                {
                    number = numberProp.GetInt32();
                    break;
                }
            }
            if (number <= 0) return null;

            var psi = new System.Diagnostics.ProcessStartInfo("/usr/bin/security")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            foreach (var arg in new[] { "find-generic-password", "-a", $"account-{number}-{email}", "-s", "claude-swap", "-w" })
                psi.ArgumentList.Add(arg);

            using var process = System.Diagnostics.Process.Start(psi);
            if (process is null) return null;
            var keychainOut = await process.StandardOutput.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);
            if (process.ExitCode != 0 || string.IsNullOrWhiteSpace(keychainOut)) return null;

            using var credDoc = JsonDocument.Parse(keychainOut);
            return credDoc.RootElement.TryGetProperty("claudeAiOauth", out var oauth) &&
                oauth.TryGetProperty("accessToken", out var tokenProp)
                ? tokenProp.GetString()
                : null;
        }
        catch
        {
            return null;
        }
    }

    private static async Task<bool> TrySendPingAsync(string accessToken, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, MessagesEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("anthropic-version", AnthropicVersion);
            request.Headers.Add("anthropic-beta", OAuthBetaHeader);
            request.Headers.UserAgent.ParseAdd("SanRingUsageMonitor/0.1 (+https://github.com/sanring)");

            var payload = JsonSerializer.Serialize(new
            {
                model = Model,
                max_tokens = MaxTokens,
                messages = new[] { new { role = "user", content = "hi" } },
            });
            request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
