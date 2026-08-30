using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Calls Anthropic's official (but undocumented/beta) usage endpoint using Claude Code's own local
/// OAuth session — the same approach the open-source `claude-swap` tool uses, verified against it on
/// 2026-08-30. This is a deliberate, user-approved trade-off over the safer "read local logs and
/// estimate" approach (constitution R2's original framing): real 5h + 7d percentages and reset times,
/// at the cost of depending on an Anthropic-internal API that could change without notice.
/// If it ever breaks, the fallback is reverting to a ccusage-based estimate like CodexUsageProvider.
/// </summary>
public sealed class ClaudeUsageProvider : IUsageProvider
{
    public string SourceId => "claude";
    public string DisplayName => "Claude Code";
    public string SourceType => "subscription";

    private const string UsageEndpoint = "https://api.anthropic.com/api/oauth/usage";
    private const string OAuthBetaHeader = "oauth-2025-04-20"; // required by the endpoint; value confirmed from claude-swap's source

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<UsageSummary> GetUsageAsync(AppSettings settings, CancellationToken ct)
    {
        var token = ClaudeAuthReader.Read();
        if (token is null)
            return Build("not_configured", detail: "找不到 Claude Code 的登入憑證，請先執行 `claude` 完成登入");

        if (ClaudeAuthReader.IsExpired(token))
            return Build("expired", detail: "登入憑證已過期，請執行一次 `claude` 讓它自動刷新");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, UsageEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
            request.Headers.Add("anthropic-beta", OAuthBetaHeader);
            request.Headers.UserAgent.ParseAdd("SanRingUsageMonitor/0.1 (+https://github.com/sanring)");

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build("expired", detail: "Anthropic 拒絕了目前的登入憑證，請執行一次 `claude` 重新登入");

            if (!response.IsSuccessStatusCode)
                return Build("invalid", detail: $"用量端點回應錯誤：HTTP {(int)response.StatusCode}");

            var body = await response.Content.ReadAsStringAsync(ct);
            var parsed = JsonSerializer.Deserialize<AnthropicUsageResponse>(body, JsonOptions);
            if (parsed is null)
                return Build("invalid", detail: $"用量端點回應內容無法解析：{Truncate(body)}");

            return BuildFromUsage(parsed, settings);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build("invalid", detail: $"呼叫用量端點失敗：{ex.Message}");
        }
    }

    private UsageSummary BuildFromUsage(AnthropicUsageResponse usage, AppSettings settings)
    {
        var threshold = settings.NearLimitThresholdPercent;
        var now = DateTime.Now.ToString("HH:mm:ss");

        double? fiveHourPct = usage.FiveHour?.Utilization;
        double? sevenDayPct = usage.SevenDay?.Utilization;

        // Each window's caption stays with that window's own row in the UI — no more merging
        // "5h resets at X ・ 7d resets at Y" into one line the user has to parse apart themselves.
        string? fiveHourDetail = usage.FiveHour?.ResetsAt is { } h5Reset ? $"{FormatResetLocal(h5Reset)} 重置" : null;
        string? sevenDayDetail = usage.SevenDay?.ResetsAt is { } d7Reset ? $"{FormatResetLocal(d7Reset)} 重置" : null;

        return new UsageSummary(
            Source: SourceId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: fiveHourPct,
            UsageState: ClassifyState(fiveHourPct, threshold),
            ConnectionState: "valid",
            IsEstimated: false, // official Anthropic data now, not a local estimate — constitution R3/I3 only requires the badge for estimates
            AsOf: now,
            Detail: fiveHourDetail,
            PercentUsedLabel: "5 小時",
            SecondaryPercentUsed: sevenDayPct,
            SecondaryUsageState: ClassifyState(sevenDayPct, threshold),
            SecondaryPercentUsedLabel: "7 天",
            SecondaryDetail: sevenDayDetail);
    }

    private static string ClassifyState(double? percent, int threshold) => percent switch
    {
        null => "unknown",
        >= 100 => "exceeded",
        var p when p >= threshold => "near_limit",
        _ => "normal",
    };

    private static string FormatResetLocal(string isoUtc)
    {
        try
        {
            return DateTimeOffset.Parse(isoUtc).ToLocalTime().ToString("HH:mm");
        }
        catch (FormatException)
        {
            return isoUtc;
        }
    }

    private UsageSummary Build(string connectionState, string detail) => new(
        Source: SourceId,
        DisplayName: DisplayName,
        SourceType: SourceType,
        PercentUsed: null,
        UsageState: "unknown",
        ConnectionState: connectionState,
        IsEstimated: false,
        AsOf: DateTime.Now.ToString("HH:mm:ss"),
        Detail: detail);

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200] + "…";
}

internal sealed class AnthropicUsageResponse
{
    [JsonPropertyName("five_hour")]
    public AnthropicUsageWindow? FiveHour { get; set; }

    [JsonPropertyName("seven_day")]
    public AnthropicUsageWindow? SevenDay { get; set; }
}

internal sealed class AnthropicUsageWindow
{
    [JsonPropertyName("utilization")]
    public double Utilization { get; set; }

    [JsonPropertyName("resets_at")]
    public string? ResetsAt { get; set; }
}
