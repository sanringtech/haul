using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Calls Codex CLI's own (undocumented) ChatGPT-backend usage endpoint using its local login
/// session — the same pattern as <see cref="ClaudeUsageProvider"/>, discovered the same way (public
/// bug report on the official `openai/codex` repo mentioning the endpoint, then verified directly
/// against this machine's real Codex login on 2026-08-31; the response's 5h/7d windows matched
/// ChatGPT Settings → Usage exactly). Same trade-off as Claude: real 5h/weekly percentages instead of
/// a local token-count estimate, at the cost of depending on an OpenAI-internal endpoint that could
/// change without notice. If it ever breaks, the fallback is a ccusage-based token-count estimate.
/// </summary>
public sealed class CodexUsageProvider : IUsageProvider
{
    public string SourceId => "codex";
    public string DisplayName => "Codex";
    public string SourceType => "subscription";

    private const string UsageEndpoint = "https://chatgpt.com/backend-api/wham/usage";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        var auth = CodexAuthReader.Read();
        if (auth is null)
            return Build(account, "not_configured", detail: "找不到 Codex 的登入憑證，請先執行 `codex login` 完成登入");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, UsageEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
            request.Headers.Add("chatgpt-account-id", auth.AccountId);
            request.Headers.UserAgent.ParseAdd("SanRingUsageMonitor/0.1 (+https://github.com/sanring)");

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "expired", detail: "ChatGPT 拒絕了目前的登入憑證，請執行一次 `codex login` 重新登入");

            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", detail: $"用量端點回應錯誤：HTTP {(int)response.StatusCode}");

            var body = await response.Content.ReadAsStringAsync(ct);
            var parsed = JsonSerializer.Deserialize<WhamUsageResponse>(body, JsonOptions);
            if (parsed?.RateLimit is null)
                return Build(account, "invalid", detail: $"用量端點回應內容無法解析：{Truncate(body)}");

            return BuildFromUsage(account, parsed, settings);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", detail: $"呼叫用量端點失敗：{ex.Message}");
        }
    }

    private UsageSummary BuildFromUsage(TrackedAccount account, WhamUsageResponse usage, AppSettings settings)
    {
        var threshold = settings.NearLimitThresholdPercent;
        var now = DateTime.Now.ToString("HH:mm:ss");

        double? primaryPct = usage.RateLimit!.PrimaryWindow?.UsedPercent;
        double? secondaryPct = usage.RateLimit.SecondaryWindow?.UsedPercent;

        string? primaryDetail = usage.RateLimit.PrimaryWindow?.ResetAt is { } r1 ? $"{FormatResetLocal(r1)} 重置" : null;
        string? secondaryDetail = usage.RateLimit.SecondaryWindow?.ResetAt is { } r2 ? $"{FormatResetLocal(r2)} 重置" : null;

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: primaryPct,
            UsageState: ClassifyState(primaryPct, threshold),
            ConnectionState: "valid",
            IsEstimated: false, // official ChatGPT backend data now, not a local ccusage estimate
            AsOf: now,
            Detail: primaryDetail,
            PercentUsedLabel: "5 小時",
            SecondaryPercentUsed: secondaryPct,
            SecondaryUsageState: ClassifyState(secondaryPct, threshold),
            SecondaryPercentUsedLabel: "7 天",
            SecondaryDetail: secondaryDetail,
            AccountLabel: account.Label);
    }

    private static string ClassifyState(double? percent, int threshold) => percent switch
    {
        null => "unknown",
        >= 100 => "exceeded",
        var p when p >= threshold => "near_limit",
        _ => "normal",
    };

    private static string FormatResetLocal(long unixSeconds)
    {
        try
        {
            return DateTimeOffset.FromUnixTimeSeconds(unixSeconds).ToLocalTime().ToString("HH:mm");
        }
        catch (ArgumentOutOfRangeException)
        {
            return "—";
        }
    }

    private UsageSummary Build(TrackedAccount account, string connectionState, string detail) => new(
        Source: account.AccountId,
        DisplayName: DisplayName,
        SourceType: SourceType,
        PercentUsed: null,
        UsageState: "unknown",
        ConnectionState: connectionState,
        IsEstimated: false,
        AsOf: DateTime.Now.ToString("HH:mm:ss"),
        Detail: detail,
        AccountLabel: account.Label);

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200] + "…";
}

internal sealed class WhamUsageResponse
{
    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("rate_limit")]
    public WhamRateLimit? RateLimit { get; set; }
}

internal sealed class WhamRateLimit
{
    [JsonPropertyName("primary_window")]
    public WhamWindow? PrimaryWindow { get; set; }

    [JsonPropertyName("secondary_window")]
    public WhamWindow? SecondaryWindow { get; set; }
}

internal sealed class WhamWindow
{
    [JsonPropertyName("used_percent")]
    public double UsedPercent { get; set; }

    [JsonPropertyName("reset_at")]
    public long ResetAt { get; set; }
}
