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
/// <b>NOT VERIFIED</b> — nobody on this project has a real Kimi Code login to test against (2026-08-31,
/// see PRD §9/§12). Two things could be wrong on first real use: (1) the repo's own
/// `docs/en/reference/server-api.md` documents a *different* endpoint (`/api/v1/oauth/usage`, envelope
/// `{code,msg,data:{kind,summary,limits,extra_usage}}`) for what might be the same feature — this
/// provider deliberately uses the endpoint the CLI's `/usage` command actually calls instead, since
/// that's the higher-confidence "real behavior" source, but the two could diverge. (2) `used`/`limit`
/// field types/units are inferred, not confirmed against a live response. Failures are surfaced with
/// the raw response body (see <see cref="Truncate"/>) specifically so a first real run is debuggable
/// instead of just silently wrong. Distinct SourceId ("kimi-subscription") from the existing
/// API-key-based <see cref="KimiUsageProvider"/> ("kimi") — same AI type, different access type,
/// constitution R1's two-dimensional model (見 2026-08-31 憲法修訂).
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
            return Build(account, "not_configured", detail: "找不到 Kimi Code 的登入憑證，請先在 Kimi Code CLI 裡執行 `/login`");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, UsageEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "expired", detail: "Kimi Code 拒絕了目前的登入憑證，請重新執行 `/login`");

            if (response.StatusCode is System.Net.HttpStatusCode.TooManyRequests)
                return Build(account, "invalid", detail: "請求太頻繁被 Kimi 限流（HTTP 429），稍後再按重新整理即可，不是憑證壞了");

            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", detail: $"用量端點回應錯誤：HTTP {(int)response.StatusCode}　{Truncate(body)}");

            var parsed = JsonSerializer.Deserialize<KimiManagedUsageResponse>(body, JsonOptions);
            if (parsed?.Usage is null || parsed.Usage.Limit <= 0)
                return Build(account, "invalid", detail: $"用量端點回應內容無法解析（未驗證過的端點，第一次遇到請把這段回傳貼給開發者）：{Truncate(body)}");

            return BuildFromUsage(account, parsed, settings);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", detail: $"呼叫用量端點失敗：{ex.Message}");
        }
    }

    private UsageSummary BuildFromUsage(TrackedAccount account, KimiManagedUsageResponse parsed, AppSettings settings)
    {
        var threshold = settings.NearLimitThresholdPercent;
        var usage = parsed.Usage!;
        var percent = usage.Limit > 0 ? Math.Min(100.0, usage.Used / usage.Limit * 100.0) : (double?)null;

        string? detail = usage.ResetTime is { } resetIso ? $"{FormatResetLocal(resetIso)} 重置" : null;

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: percent,
            UsageState: ClassifyState(percent, threshold),
            ConnectionState: "valid",
            IsEstimated: false, // official Kimi Code data, not a local estimate — assuming the schema guess above holds
            AsOf: DateTime.Now.ToString("HH:mm:ss"),
            Detail: detail,
            AccountLabel: account.Label);
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

    private static string Truncate(string s) => s.Length <= 300 ? s : s[..300] + "…";
}

internal sealed class KimiManagedUsageResponse
{
    [JsonPropertyName("usage")]
    public KimiUsageSummaryRow? Usage { get; set; }
}

internal sealed class KimiUsageSummaryRow
{
    [JsonPropertyName("used")]
    public double Used { get; set; }

    [JsonPropertyName("limit")]
    public double Limit { get; set; }

    [JsonPropertyName("resetTime")]
    public string? ResetTime { get; set; }
}
