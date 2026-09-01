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
            return Build(account, "not_configured", L(MessageKeys.CodexCredentialsNotFound));

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, UsageEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
            request.Headers.Add("chatgpt-account-id", auth.AccountId);
            request.Headers.UserAgent.ParseAdd("SanRingUsageMonitor/0.1 (+https://github.com/sanring)");

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "expired", L(MessageKeys.CodexCredentialsRejected));

            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", L(MessageKeys.HttpError, ("status", ((int)response.StatusCode).ToString())));

            var body = await response.Content.ReadAsStringAsync(ct);
            var parsed = JsonSerializer.Deserialize<WhamUsageResponse>(body, JsonOptions);
            if (parsed?.RateLimit is null)
                return Build(account, "invalid", L(MessageKeys.ParseError, ("body", Truncate(body))));

            return BuildFromUsage(account, parsed, settings);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", L(MessageKeys.CallFailed, ("message", ex.Message)));
        }
    }

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    private UsageSummary BuildFromUsage(TrackedAccount account, WhamUsageResponse usage, AppSettings settings)
    {
        var threshold = settings.NearLimitThresholdPercent;
        var now = DateTime.Now.ToString("HH:mm:ss");

        double? primaryPct = usage.RateLimit!.PrimaryWindow?.UsedPercent;
        double? secondaryPct = usage.RateLimit.SecondaryWindow?.UsedPercent;

        LocalizedText? primaryDetail = usage.RateLimit.PrimaryWindow?.ResetAt is { } r1 ? L(MessageKeys.WindowReset, ("time", FormatResetLocal(r1))) : null;
        // 7 天的視窗只顯示 HH:mm 會讓人搞不清楚是哪一天重置（5 小時那個幾乎一定當天到期，7 天不會）
        // ——補上日期，見 FormatResetLocalWithDate。
        LocalizedText? secondaryDetail = usage.RateLimit.SecondaryWindow?.ResetAt is { } r2 ? L(MessageKeys.WindowReset, ("time", FormatResetLocalWithDate(r2))) : null;

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
            PercentUsedLabel: L(MessageKeys.FiveHourLabel),
            SecondaryPercentUsed: secondaryPct,
            SecondaryUsageState: ClassifyState(secondaryPct, threshold),
            SecondaryPercentUsedLabel: L(MessageKeys.SevenDayLabel),
            SecondaryDetail: secondaryDetail,
            AccountLabel: account.Label,
            PlanLabel: FormatPlanLabel(usage.PlanType));
    }

    private static string ClassifyState(double? percent, int threshold) => percent switch
    {
        null => "unknown",
        >= 100 => "exceeded",
        var p when p >= threshold => "near_limit",
        _ => "normal",
    };

    private static string? FormatPlanLabel(string? value) => string.IsNullOrWhiteSpace(value)
        ? null
        : char.ToUpperInvariant(value.Trim()[0]) + value.Trim()[1..].ToLowerInvariant();

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

    private static string FormatResetLocalWithDate(long unixSeconds)
    {
        try
        {
            return DateTimeOffset.FromUnixTimeSeconds(unixSeconds).ToLocalTime().ToString("M/d HH:mm");
        }
        catch (ArgumentOutOfRangeException)
        {
            return "—";
        }
    }

    private UsageSummary Build(TrackedAccount account, string connectionState, LocalizedText detail) => new(
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

    [JsonPropertyName("plan_type")]
    public string? PlanType { get; set; }

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
