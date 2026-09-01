using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Calls Cursor's own (undocumented) dashboard usage endpoint using its local login session — same
/// pattern as <see cref="ClaudeUsageProvider"/>/<see cref="CodexUsageProvider"/>, verified 2026-09-01
/// against a real local Cursor login on this machine (see AI-LANDSCAPE.md for the full investigation:
/// endpoint, request/response shape, and a field-semantics trap that would have made the percentage
/// wrong if trusted at face value).
///
/// <para>
/// <b>The endpoint uses Connect Protocol</b> (gRPC-compatible), but its JSON transport is plain HTTP
/// POST + JSON body/response — no gRPC-web binary framing needed, confirmed by a real request.
/// </para>
///
/// <para>
/// <b>Percent is computed, not read from a field</b>: the response's own <c>totalPercentUsed</c> does
/// NOT match the human-readable <c>displayMessage</c> ("used 8%") — real values observed were 0.337 vs
/// a displayed 8%. <c>totalSpend / limit</c> (both in cents) matches <c>displayMessage</c> exactly
/// (167/2000 = 8.35% ≈ "8%"), so that's what this provider actually uses. Don't "fix" this to read
/// <c>totalPercentUsed</c> without re-verifying what it actually measures — see AI-LANDSCAPE.md.
/// </para>
/// </summary>
public sealed class CursorUsageProvider : IUsageProvider
{
    public string SourceId => "cursor";
    public string DisplayName => "Cursor";
    public string SourceType => "subscription";

    private const string UsageEndpoint = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage";

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
            using var request = new HttpRequestMessage(HttpMethod.Post, UsageEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
            request.Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "expired", L(MessageKeys.CursorCredentialsRejected));

            if (response.StatusCode is System.Net.HttpStatusCode.TooManyRequests)
                return Build(account, "invalid", L(MessageKeys.RateLimited, ("provider", "Cursor")));

            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", L(MessageKeys.HttpError, ("status", ((int)response.StatusCode).ToString())));

            var parsed = JsonSerializer.Deserialize<CursorUsageResponse>(body, JsonOptions);
            if (parsed?.PlanUsage is null || parsed.PlanUsage.Limit <= 0)
                return Build(account, "invalid", L(MessageKeys.ParseError, ("body", Truncate(body))));

            return BuildFromUsage(account, parsed, settings, FormatPlanLabel(token.PlanType));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", L(MessageKeys.CallFailed, ("message", ex.Message)));
        }
    }

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    private UsageSummary BuildFromUsage(TrackedAccount account, CursorUsageResponse parsed, AppSettings settings, string? planLabel)
    {
        var attentionThreshold = settings.AttentionThresholdPercent;
        var threshold = settings.NearLimitThresholdPercent;
        var plan = parsed.PlanUsage!;
        var percent = Math.Min(100.0, plan.TotalSpend / plan.Limit * 100.0);

        LocalizedText? detail = parsed.BillingCycleEndMs is { } endMs
            ? L(MessageKeys.WindowReset, ("time", FormatResetLocal(endMs)))
            : null;

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: percent,
            UsageState: ClassifyState(percent, attentionThreshold, threshold),
            ConnectionState: "valid",
            IsEstimated: false, // official Cursor dashboard data, not a local estimate
            AsOf: DateTime.Now.ToString("HH:mm:ss"),
            Detail: detail,
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

    private static string FormatResetLocal(long unixMs)
    {
        try
        {
            return DateTimeOffset.FromUnixTimeMilliseconds(unixMs).ToLocalTime().ToString("M/d HH:mm");
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

    private static string Truncate(string s) => s.Length <= 300 ? s : s[..300] + "…";
}

internal sealed class CursorUsageResponse
{
    [JsonPropertyName("billingCycleEnd")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)] // arrives as a quoted string, not a bare number
    public long? BillingCycleEndMs { get; set; }

    [JsonPropertyName("planUsage")]
    public CursorPlanUsage? PlanUsage { get; set; }
}

internal sealed class CursorPlanUsage
{
    // Cents, not dollars — Pro's $20/mo plan shows up as limit: 2000. See the class doc comment for
    // why percent is computed from these two instead of the response's own totalPercentUsed field.
    [JsonPropertyName("totalSpend")]
    public double TotalSpend { get; set; }

    [JsonPropertyName("limit")]
    public double Limit { get; set; }
}
