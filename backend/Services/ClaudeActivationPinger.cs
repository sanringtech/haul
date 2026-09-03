using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Providers;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// 「Claude 用量喚醒」——對快照庫裡的 Claude 帳號，每天在設定時刻送一則最小 Messages API 請求
/// 把懶初始化的 5h/7d 視窗叫醒。這是這個 app 唯一會消耗用量額度的功能。
///
/// 沒有背景常駐排程：搭 RespondWithSummaries 便車，best-effort。token 從
/// <see cref="SubscriptionSnapshotStore"/> 讀並自行 refresh，不再 fork cswap。
/// Codex 視窗是否同樣懶初始化尚未查證，這裡不 ping Codex。
/// </summary>
public static class ClaudeActivationPinger
{
    private const string MessagesEndpoint = "https://api.anthropic.com/v1/messages";
    private const string OAuthBetaHeader = "oauth-2025-04-20";
    private const string AnthropicVersion = "2023-06-01";
    private const string Model = "claude-haiku-4-5-20251001";
    private const int MaxTokens = 8;

    public static async Task PingIfDueAsync(SubscriptionSnapshotStore store, CancellationToken ct = default)
    {
        var settings = SettingsStore.Load();
        if (!settings.ClaudeWakeUpEnabled || settings.ClaudeWakeUpAccountHours.Count == 0) return;

        var now = DateTime.Now;
        var today = now.ToString("yyyy-MM-dd");
        var changed = false;

        foreach (var (accountId, hour) in settings.ClaudeWakeUpAccountHours)
        {
            if (settings.ClaudeWakeUpLastPingDate.TryGetValue(accountId, out var lastDate) && lastDate == today)
                continue;

            if (now.Hour < hour) continue;

            if (!accountId.StartsWith(ClaudeUsageProvider.AccountPrefix, StringComparison.Ordinal)) continue;

            var snap = await store.GetFreshAsync(accountId, ct);
            if (snap is null) continue;

            if (await TrySendPingAsync(snap.AccessToken, ct))
            {
                settings.ClaudeWakeUpLastPingDate[accountId] = today;
                changed = true;
            }
        }

        if (changed) SettingsStore.Save(settings);
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
