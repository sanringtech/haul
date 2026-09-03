using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Grok Build 訂閱制用量。端點與 5 個 header 來自開源 <c>xai-org/grok-build</c>
/// <c>crates/codegen/xai-grok-shell/src/extensions/billing.rs</c> 的
/// <c>GET {cli-chat-proxy}/billing?format=credits</c>，不是 ccusage、也不猜。
/// 憑證只讀 <c>~/.grok/auth.json</c>，不寫回、不 refresh（會跟 CLI 搶票）。
/// 本機尚未有 Grok CLI 登入時會是 <c>not_configured</c>；有登入後才算實測。
/// API KEY 制不做（xAI 沒有餘額查詢端點，憲法／PRD 已拍板）。
/// </summary>
public sealed class GrokUsageProvider : IUsageProvider
{
    public string SourceId => "grok";
    public string DisplayName => "Grok";
    public string SourceType => "subscription";

    private const string BillingEndpoint = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
    private const string TokenAuthHeader = "X-XAI-Token-Auth";
    private const string TokenAuthValue = "xai-grok-cli";
    private const string ClientModeHeader = "x-grok-client-mode";
    /// <summary>
    /// grok-build <c>xai-grok-version::VERSION</c> (crate 1.0.16 as of 2026-09-03).
    /// Not Haul's VERSION — the proxy sees this as the CLI client.
    /// </summary>
    private const string GrokCliClientVersion = "1.0.16";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        var token = GrokAuthReader.Read();
        if (token is null)
            return Build(account, "not_configured", L(MessageKeys.GrokCredentialsNotFound));

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, BillingEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
            request.Headers.TryAddWithoutValidation(TokenAuthHeader, TokenAuthValue);
            request.Headers.TryAddWithoutValidation("x-userid", token.UserId);
            request.Headers.TryAddWithoutValidation("x-grok-client-version", GrokCliClientVersion);
            request.Headers.TryAddWithoutValidation(ClientModeHeader, "interactive");
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "expired", L(MessageKeys.GrokCredentialsRejected));

            if (response.StatusCode is System.Net.HttpStatusCode.TooManyRequests)
                return Build(account, "invalid", L(MessageKeys.RateLimited, ("provider", "Grok")));

            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", L(MessageKeys.GrokHttpErrorWithBody, ("status", ((int)response.StatusCode).ToString()), ("body", Truncate(body))));

            var parsed = JsonSerializer.Deserialize<GrokBillingResponse>(body, JsonOptions);
            if (parsed?.Config is null)
                return Build(account, "invalid", L(MessageKeys.GrokParseErrorUnverified, ("body", Truncate(body))));

            return BuildFromConfig(account, parsed.Config, token.Email, settings);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", L(MessageKeys.CallFailed, ("message", ex.Message)));
        }
    }

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    private UsageSummary BuildFromConfig(TrackedAccount account, GrokBillingConfig config, string? email, AppSettings settings)
    {
        var percent = config.CreditUsagePercent;
        if (percent is null && config.MonthlyLimit is { Val: > 0 } limit)
            percent = Math.Min(100.0, (config.Used?.Val ?? 0) / (double)limit.Val * 100.0);

        var resetIso = config.CurrentPeriod?.End ?? config.BillingPeriodEnd;
        LocalizedText? detail = resetIso is { Length: > 0 }
            ? L(MessageKeys.WindowReset, ("time", FormatResetLocal(resetIso)))
            : null;

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: percent,
            UsageState: ClassifyState(percent, settings.AttentionThresholdPercent, settings.NearLimitThresholdPercent),
            ConnectionState: "valid",
            IsEstimated: false,
            AsOf: DateTime.Now.ToString("HH:mm:ss"),
            Detail: detail,
            AccountLabel: account.Label ?? email);
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
            return DateTimeOffset.Parse(isoUtc).ToLocalTime().ToString("M/d HH:mm");
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

internal sealed class GrokBillingResponse
{
    [JsonPropertyName("config")]
    public GrokBillingConfig? Config { get; set; }
}

internal sealed class GrokBillingConfig
{
    [JsonPropertyName("creditUsagePercent")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public double? CreditUsagePercent { get; set; }

    [JsonPropertyName("currentPeriod")]
    public GrokUsagePeriod? CurrentPeriod { get; set; }

    [JsonPropertyName("monthlyLimit")]
    public GrokCent? MonthlyLimit { get; set; }

    [JsonPropertyName("used")]
    public GrokCent? Used { get; set; }

    [JsonPropertyName("billingPeriodEnd")]
    public string? BillingPeriodEnd { get; set; }
}

internal sealed class GrokUsagePeriod
{
    [JsonPropertyName("type")]
    public string? PeriodType { get; set; }

    [JsonPropertyName("end")]
    public string? End { get; set; }
}

internal sealed class GrokCent
{
    [JsonPropertyName("val")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public long Val { get; set; }
}
