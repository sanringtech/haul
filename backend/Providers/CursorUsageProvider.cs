using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Cursor 用量。設定頁「Included in Pro」畫的是兩個模型桶（Cursor Models / Other Models），不是
/// 單一的美元進度。那兩條百分比來自設定頁自己打的 <c>GET /api/usage-summary</c>
/// （<c>individualUsage.plan.autoPercentUsed</c> / <c>apiPercentUsed</c>），單位就是「百分之 N」，
/// 不要再乘 100、也不要用 <c>totalSpend / limit</c> 去對那兩條——2026-09-02 對過：美元公式算出 35%，
/// 官網 Cursor Models 卻是 1%。卡片只顯示那兩條百分比；美元花費不是設定頁在畫的東西，不算、不顯示。
///
/// 舊端點 <c>GetCurrentPeriodUsage</c> 留作 fallback：若它也帶 auto/api 兩個桶就用，沒有就當這次
/// 讀不到設定頁那套資料，不退回 <c>totalSpend / limit</c> 那條會跟官網對不上的美元進度。
/// </summary>
public sealed class CursorUsageProvider : IUsageProvider
{
    public string SourceId => "cursor";
    public string DisplayName => "Cursor";
    public string SourceType => "subscription";

    private const string UsageSummaryEndpoint = "https://cursor.com/api/usage-summary";
    private const string LegacyUsageEndpoint = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        var token = CursorAuthReader.Read();
        if (token is null)
            return Build(account, "not_configured", L(MessageKeys.CursorCredentialsNotFound));

        if (CursorAuthReader.IsExpired(token))
            return Build(account, "expired", L(MessageKeys.CursorCredentialsExpiredLocal));

        try
        {
            var planLabel = FormatPlanLabel(token.PlanType);
            var summary = await TryGetDashboardSummaryAsync(token, ct);
            if (summary?.Plan is { AutoPercentUsed: not null, ApiPercentUsed: not null } plan)
                return BuildFromBuckets(account, plan, summary.BillingCycleEnd, settings, planLabel);

            var legacy = await TryGetLegacyResponseAsync(token.AccessToken, ct);
            if (legacy is not null)
                return BuildFromLegacy(account, legacy, settings, planLabel);

            return Build(account, "invalid", L(MessageKeys.CallFailed, ("message", "usage-summary and GetCurrentPeriodUsage both failed")));
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            return Build(account, "expired", L(MessageKeys.CursorCredentialsRejected));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", L(MessageKeys.CallFailed, ("message", ex.Message)));
        }
    }

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    /// <returns>null = 這次呼叫失敗或 JSON 對不上，呼叫端改走舊端點。設定頁這支是 Cookie 不是 Bearer；
    /// 401 不代表本機 Cursor session 死了（GetCurrentPeriodUsage 用 Bearer 仍可能成功）。</returns>
    private static async Task<CursorDashboardSummary?> TryGetDashboardSummaryAsync(CursorAuthToken token, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(token.UserId)) return null;

        using var request = new HttpRequestMessage(HttpMethod.Get, UsageSummaryEndpoint);
        request.Headers.UserAgent.ParseAdd("SanRingUsageMonitor/0.1 (+https://github.com/sanring)");
        // HttpClient 預設擋 Cookie 這個受限標頭，TryAddWithoutValidation 才能塞進跟設定頁同一顆。
        var session = Uri.EscapeDataString($"{token.UserId}::{token.AccessToken}");
        request.Headers.TryAddWithoutValidation("Cookie", $"WorkosCursorSessionToken={session}");

        using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) return null;

        var body = await response.Content.ReadAsStringAsync(ct);
        var parsed = JsonSerializer.Deserialize<CursorUsageSummaryResponse>(body, JsonOptions);
        var plan = parsed?.IndividualUsage?.Plan;
        if (plan is null) return null;

        return new CursorDashboardSummary(plan, parsed!.BillingCycleEnd);
    }

    private static async Task<CursorUsageResponse?> TryGetLegacyResponseAsync(string accessToken, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, LegacyUsageEndpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");
        request.Headers.UserAgent.ParseAdd("SanRingUsageMonitor/0.1 (+https://github.com/sanring)");

        using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            throw new HttpRequestException("Cursor credentials rejected", null, response.StatusCode);

        if (!response.IsSuccessStatusCode) return null;

        var body = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<CursorUsageResponse>(body, JsonOptions);
    }

    private UsageSummary BuildFromLegacy(TrackedAccount account, CursorUsageResponse parsed, AppSettings settings, string? planLabel)
    {
        var plan = parsed.PlanUsage;
        if (plan is null) return Build(account, "invalid", L(MessageKeys.ParseError, ("body", "planUsage missing")));

        if (plan.AutoPercentUsed is not null && plan.ApiPercentUsed is not null)
        {
            var buckets = new CursorSummaryPlan
            {
                AutoPercentUsed = plan.AutoPercentUsed,
                ApiPercentUsed = plan.ApiPercentUsed,
            };
            return BuildFromBuckets(account, buckets, parsed.BillingCycleEndMs?.ToString(CultureInfo.InvariantCulture), settings, planLabel);
        }

        return Build(account, "invalid", L(MessageKeys.ParseError, ("body", "no autoPercentUsed/apiPercentUsed")));
    }

    private UsageSummary BuildFromBuckets(
        TrackedAccount account,
        CursorSummaryPlan plan,
        string? billingCycleEnd,
        AppSettings settings,
        string? planLabel)
    {
        var autoPct = plan.AutoPercentUsed!.Value;
        var apiPct = plan.ApiPercentUsed!.Value;
        var attentionThreshold = settings.AttentionThresholdPercent;
        var threshold = settings.NearLimitThresholdPercent;

        var reset = FormatReset(billingCycleEnd);
        LocalizedText? resetDetail = reset is null ? null : L(MessageKeys.WindowReset, ("time", reset));

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: autoPct,
            UsageState: ClassifyState(autoPct, attentionThreshold, threshold),
            ConnectionState: "valid",
            IsEstimated: false,
            AsOf: DateTime.Now.ToString("HH:mm:ss"),
            Detail: resetDetail,
            PercentUsedLabel: L(MessageKeys.CursorModelsLabel),
            SecondaryPercentUsed: apiPct,
            SecondaryUsageState: ClassifyState(apiPct, attentionThreshold, threshold),
            SecondaryPercentUsedLabel: L(MessageKeys.OtherModelsLabel),
            SecondaryDetail: resetDetail,
            AccountLabel: account.Label,
            PlanLabel: planLabel);
    }

    private static string ClassifyState(double? percent, int attentionThreshold, int nearLimitThreshold) => percent switch
    {
        null => "unknown",
        >= 100 => "exceeded",
        var p when p >= nearLimitThreshold => "near_limit",
        var p when p >= attentionThreshold => "attention",
        _ => "normal",
    };

    private static string? FormatPlanLabel(string? value) => string.IsNullOrWhiteSpace(value)
        ? null
        : char.ToUpperInvariant(value.Trim()[0]) + value.Trim()[1..].ToLowerInvariant();

    private static string? FormatReset(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
            return dto.ToLocalTime().ToString("M/d HH:mm");
        if (long.TryParse(value, out var unixMs))
            return FormatResetFromUnixMs(unixMs);
        return null;
    }

    private static string? FormatResetFromUnixMs(long? unixMs)
    {
        if (unixMs is not { } ms) return null;
        try
        {
            return DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime().ToString("M/d HH:mm");
        }
        catch (ArgumentOutOfRangeException)
        {
            return null;
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
}

internal sealed record CursorDashboardSummary(CursorSummaryPlan Plan, string? BillingCycleEnd);

internal sealed class CursorUsageSummaryResponse
{
    [JsonPropertyName("billingCycleEnd")]
    public string? BillingCycleEnd { get; set; }

    [JsonPropertyName("individualUsage")]
    public CursorIndividualUsage? IndividualUsage { get; set; }
}

internal sealed class CursorIndividualUsage
{
    [JsonPropertyName("plan")]
    public CursorSummaryPlan? Plan { get; set; }
}

internal sealed class CursorSummaryPlan
{
    [JsonPropertyName("autoPercentUsed")]
    public double? AutoPercentUsed { get; set; }

    [JsonPropertyName("apiPercentUsed")]
    public double? ApiPercentUsed { get; set; }
}

internal sealed class CursorUsageResponse
{
    [JsonPropertyName("billingCycleEnd")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public long? BillingCycleEndMs { get; set; }

    [JsonPropertyName("planUsage")]
    public CursorPlanUsage? PlanUsage { get; set; }
}

internal sealed class CursorPlanUsage
{
    [JsonPropertyName("totalSpend")]
    public double TotalSpend { get; set; }

    [JsonPropertyName("limit")]
    public double Limit { get; set; }

    [JsonPropertyName("autoPercentUsed")]
    public double? AutoPercentUsed { get; set; }

    [JsonPropertyName("apiPercentUsed")]
    public double? ApiPercentUsed { get; set; }
}
