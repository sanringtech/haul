using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Calls Anthropic's official (but undocumented/beta) usage endpoint using a captured Claude Code
/// OAuth snapshot — never writes back to Claude Code's own Keychain / <c>.credentials.json</c>
/// (constitution R4). Multi-account is "capture current CLI login" repeated, not wrapping cswap.
/// Legacy AccountId <c>claude</c> still reads the live CLI session until the user recaptures.
/// </summary>
public sealed class ClaudeUsageProvider : IUsageProvider
{
    public string SourceId => "claude";
    public string DisplayName => "Claude Code";
    public string SourceType => "subscription";

    internal const string AccountPrefix = "claude:";
    internal static string AccountIdFor(string email) => AccountPrefix + email;

    private const string UsageEndpoint = "https://api.anthropic.com/api/oauth/usage";
    private const string OAuthBetaHeader = "oauth-2025-04-20";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly SubscriptionSnapshotStore _store;

    public ClaudeUsageProvider(SubscriptionSnapshotStore store) => _store = store;

    /// <summary>讀目前 CLI 登入、組成快照。失敗時 ErrorKey 對應 i18n，Snapshot 為 null。</summary>
    internal (SubscriptionSnapshot? Snapshot, string? ErrorKey) TryCaptureCurrent()
    {
        var token = ClaudeAuthReader.Read();
        if (token is null) return (null, MessageKeys.ClaudeCredentialsNotFound);
        if (string.IsNullOrEmpty(token.RefreshToken)) return (null, MessageKeys.CaptureRefreshMissing);
        var identity = token.Email ?? token.AccountUuid;
        if (string.IsNullOrEmpty(identity)) return (null, MessageKeys.CaptureEmailMissing);
        return (new SubscriptionSnapshot(
            AccountIdFor(identity),
            SourceId,
            token.Email ?? identity,
            token.AccessToken,
            token.RefreshToken,
            token.ExpiresAtMs,
            token.SubscriptionType,
            token.AccountUuid), null);
    }

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        if (account.AccountId.StartsWith(AccountPrefix, StringComparison.Ordinal))
            return await GetUsageFromStoreAsync(account, settings, ct);

        var token = ClaudeAuthReader.Read();
        if (token is null)
            return Build(account, "not_configured", L(MessageKeys.ClaudeCredentialsNotFound));

        if (ClaudeAuthReader.IsExpired(token))
            return Build(account, "expired", L(MessageKeys.ClaudeCredentialsExpiredLocal));

        return await FetchOfficialAsync(account, token.AccessToken, settings, ct, token.SubscriptionType);
    }

    private async Task<UsageSummary> GetUsageFromStoreAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        var snap = await _store.GetFreshAsync(account.AccountId, ct);
        if (snap is null)
            return Build(account, "not_configured", L(MessageKeys.SnapshotNotFound));

        var summary = await FetchOfficialAsync(account, snap.AccessToken, settings, ct, snap.SubscriptionType);
        if (summary.ConnectionState != "expired") return summary;

        var refreshed = await _store.RefreshNowAsync(snap, ct);
        if (refreshed is null) return summary;
        return await FetchOfficialAsync(account, refreshed.AccessToken, settings, ct, refreshed.SubscriptionType);
    }

    private async Task<UsageSummary> FetchOfficialAsync(
        TrackedAccount account, string accessToken, AppSettings settings, CancellationToken ct, string? subscriptionType)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, UsageEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("anthropic-beta", OAuthBetaHeader);
            request.Headers.UserAgent.ParseAdd("SanRingUsageMonitor/0.1 (+https://github.com/sanring)");

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "expired", L(MessageKeys.ClaudeCredentialsRejected));

            if (response.StatusCode is System.Net.HttpStatusCode.TooManyRequests)
                return Build(account, "invalid", L(MessageKeys.RateLimited, ("provider", "Anthropic")));

            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", L(MessageKeys.HttpError, ("status", ((int)response.StatusCode).ToString())));

            var body = await response.Content.ReadAsStringAsync(ct);
            var parsed = JsonSerializer.Deserialize<AnthropicUsageResponse>(body, JsonOptions);
            if (parsed is null)
                return Build(account, "invalid", L(MessageKeys.ParseError, ("body", Truncate(body))));

            return BuildFromUsage(account, parsed, settings, FormatPlanLabel(subscriptionType));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", L(MessageKeys.CallFailed, ("message", ex.Message)));
        }
    }

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    private UsageSummary BuildFromUsage(TrackedAccount account, AnthropicUsageResponse usage, AppSettings settings, string? planLabel = null)
    {
        var attentionThreshold = settings.AttentionThresholdPercent;
        var threshold = settings.NearLimitThresholdPercent;
        var now = DateTime.Now.ToString("HH:mm:ss");

        double? fiveHourPct = usage.FiveHour?.Utilization;
        double? sevenDayPct = usage.SevenDay?.Utilization;

        LocalizedText? fiveHourDetail = usage.FiveHour?.ResetsAt is { } h5Reset ? L(MessageKeys.WindowReset, ("time", FormatResetLocal(h5Reset))) : null;
        LocalizedText? sevenDayDetail = usage.SevenDay?.ResetsAt is { } d7Reset ? L(MessageKeys.WindowReset, ("time", FormatResetLocalWithDate(d7Reset))) : null;

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: fiveHourPct,
            UsageState: ClassifyState(fiveHourPct, attentionThreshold, threshold),
            ConnectionState: "valid",
            IsEstimated: false,
            AsOf: now,
            Detail: fiveHourDetail,
            PercentUsedLabel: L(MessageKeys.FiveHourLabel),
            SecondaryPercentUsed: sevenDayPct,
            SecondaryUsageState: ClassifyState(sevenDayPct, attentionThreshold, threshold),
            SecondaryPercentUsedLabel: L(MessageKeys.SevenDayLabel),
            SecondaryDetail: sevenDayDetail,
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

    private static string FormatResetLocalWithDate(string isoUtc)
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
