using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Calls Kimi Code CLI's own managed-usage endpoint using its local OAuth session — same pattern as
/// <see cref="ClaudeUsageProvider"/>/<see cref="CodexUsageProvider"/>, found by reading the open-source
/// `MoonshotAI/kimi-code` repo (`packages/oauth/src/managed-usage.ts`) rather than a bug report, so the
/// URL/headers/response shape are read straight from the real HTTP client, not reverse-engineered.
///
/// <para>
/// <b>2026-09-02</b>：本機憑證是 <c>kimi-code-env-*.json</c>；reader 已改對路徑後打用量端點得到
/// HTTP 401（access token 過期）。不在這裡 refresh——會跟 Kimi Code CLI 搶 refresh token，也違反
/// 憲法「不寫回 CLI 登入檔」。Distinct SourceId "kimi-subscription" vs API-key "kimi"。
/// </para>
/// </summary>
public sealed class KimiSubscriptionUsageProvider : IUsageProvider
{
    public string SourceId => "kimi-subscription";
    public string DisplayName => "Kimi";
    public string SourceType => "subscription";

    private const string UsageEndpoint = "https://api.kimi.com/coding/v1/usages";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        var accessToken = KimiCliAuthReader.Read();
        if (accessToken is null)
            return Build(account, "not_configured", L(MessageKeys.KimiSubCredentialsNotFound));

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, UsageEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "expired", L(MessageKeys.KimiSubCredentialsRejected));

            if (response.StatusCode is System.Net.HttpStatusCode.TooManyRequests)
                return Build(account, "invalid", L(MessageKeys.RateLimited, ("provider", "Kimi")));

            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", L(MessageKeys.KimiSubHttpErrorWithBody, ("status", ((int)response.StatusCode).ToString()), ("body", Truncate(body))));

            var parsed = JsonSerializer.Deserialize<KimiManagedUsageResponse>(body, JsonOptions);
            if (parsed?.Usage is null || parsed.Usage.Limit <= 0)
                return Build(account, "invalid", L(MessageKeys.KimiSubParseErrorUnverified, ("body", Truncate(body))));

            return BuildFromUsage(account, parsed, settings);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", L(MessageKeys.CallFailed, ("message", ex.Message)));
        }
    }

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    private UsageSummary BuildFromUsage(TrackedAccount account, KimiManagedUsageResponse parsed, AppSettings settings)
    {
        var attentionThreshold = settings.AttentionThresholdPercent;
        var threshold = settings.NearLimitThresholdPercent;
        var usage = parsed.Usage!;
        var percent = usage.Limit > 0 ? Math.Min(100.0, usage.Used / usage.Limit * 100.0) : (double?)null;

        LocalizedText? detail = usage.ResetTime is { } resetIso ? L(MessageKeys.WindowReset, ("time", FormatResetLocal(resetIso))) : null;

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: percent,
            UsageState: ClassifyState(percent, attentionThreshold, threshold),
            ConnectionState: "valid",
            IsEstimated: false, // official Kimi Code data, not a local estimate — assuming the schema guess above holds
            AsOf: DateTime.Now.ToString("HH:mm:ss"),
            Detail: detail,
            AccountLabel: account.Label);
    }

    private static string ClassifyState(double? percent, int attentionThreshold, int nearLimitThreshold) => percent switch
    {
        null => "unknown",
        >= 100 => "exceeded",
        var p when p >= nearLimitThreshold => "near_limit",
        var p when p >= attentionThreshold => "attention",
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

    private static string Truncate(string s) => s.Length <= 300 ? s : s[..300] + "…";
}

internal sealed class KimiManagedUsageResponse
{
    [JsonPropertyName("usage")]
    public KimiUsageSummaryRow? Usage { get; set; }
}

internal sealed class KimiUsageSummaryRow
{
    // Per the official "Managed Platform Usage API Reference" (docs.kimi.com/code, checked 2026-08-31),
    // used/limit "arrive as decimal strings" and the CLI's own parser (toInt()) accepts either a
    // number or a string — so this must too, or a real (string-typed) response throws JsonException
    // and gets misreported as "呼叫用量端點失敗" instead of actually parsing.
    [JsonPropertyName("used")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public double Used { get; set; }

    [JsonPropertyName("limit")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public double Limit { get; set; }

    [JsonPropertyName("resetTime")]
    public string? ResetTime { get; set; }
}
