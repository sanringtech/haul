using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Calls Codex CLI's own (undocumented) ChatGPT-backend usage endpoint using its local login
/// session — the same pattern as <see cref="ClaudeUsageProvider"/>. Multi-account is capture of
/// the current <c>~/.codex/auth.json</c> into Haul's snapshot store; this file is never written
/// back (constitution R4). Refresh tokens are near-single-use — capture A, then immediately
/// <c>codex login</c> B before the CLI itself refreshes. Legacy AccountId <c>codex</c> still
/// reads the live CLI file until recapture.
/// </summary>
public sealed class CodexUsageProvider : IUsageProvider
{
    public string SourceId => "codex";
    public string DisplayName => "Codex";
    public string SourceType => "subscription";

    internal const string AccountPrefix = "codex:";
    internal static string AccountIdFor(string emailOrId) => AccountPrefix + emailOrId;

    private const string UsageEndpoint = "https://chatgpt.com/backend-api/wham/usage";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly SubscriptionSnapshotStore _store;

    public CodexUsageProvider(SubscriptionSnapshotStore store) => _store = store;

    internal async Task<(IReadOnlyList<SubscriptionSnapshot> Snapshots, string? ErrorKey)> TryCaptureAllAsync(CancellationToken ct)
    {
        var auths = CodexAuthReader.ReadAll();
        if (auths.Count == 0) return ([], MessageKeys.CodexCredentialsNotFound);

        var snaps = new List<SubscriptionSnapshot>();
        foreach (var auth in auths)
        {
            if (string.IsNullOrEmpty(auth.RefreshToken)) continue;

            string? email = auth.Email;
            string? plan = null;
            var parsed = await TryFetchWhamAsync(auth.AccessToken, auth.AccountId, ct);
            if (parsed is not null)
            {
                email ??= parsed.Email;
                plan = parsed.PlanType;
            }

            email ??= auth.AccountId;
            snaps.Add(new SubscriptionSnapshot(
                AccountIdFor(email),
                SourceId,
                email,
                auth.AccessToken,
                auth.RefreshToken,
                AccessExpiresAtMs: null,
                plan,
                auth.AccountId));
        }

        if (snaps.Count == 0) return ([], MessageKeys.CaptureRefreshMissing);
        return (snaps, null);
    }

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        if (account.AccountId.StartsWith(AccountPrefix, StringComparison.Ordinal))
            return await GetUsageFromStoreAsync(account, settings, ct);

        var auth = CodexAuthReader.Read();
        if (auth is null)
            return Build(account, "not_configured", L(MessageKeys.CodexCredentialsNotFound));

        return await FetchOfficialAsync(account, auth.AccessToken, auth.AccountId, settings, ct);
    }

    private async Task<UsageSummary> GetUsageFromStoreAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        var snap = await _store.GetFreshAsync(account.AccountId, ct);
        if (snap is null)
            return Build(account, "not_configured", L(MessageKeys.SnapshotNotFound));

        var chatgptId = snap.ExternalAccountId ?? "";
        var summary = await FetchOfficialAsync(account, snap.AccessToken, chatgptId, settings, ct);
        if (summary.ConnectionState != "expired") return summary;

        var refreshed = await _store.RefreshNowAsync(snap, ct);
        if (refreshed is null) return summary;
        return await FetchOfficialAsync(account, refreshed.AccessToken, refreshed.ExternalAccountId ?? chatgptId, settings, ct);
    }

    private async Task<UsageSummary> FetchOfficialAsync(
        TrackedAccount account, string accessToken, string chatgptAccountId, AppSettings settings, CancellationToken ct)
    {
        try
        {
            using var request = BuildWhamRequest(accessToken, chatgptAccountId);
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

    private static async Task<WhamUsageResponse?> TryFetchWhamAsync(string accessToken, string chatgptAccountId, CancellationToken ct)
    {
        try
        {
            using var request = BuildWhamRequest(accessToken, chatgptAccountId);
            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return null;
            return JsonSerializer.Deserialize<WhamUsageResponse>(await response.Content.ReadAsStringAsync(ct), JsonOptions);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return null;
        }
    }

    private static HttpRequestMessage BuildWhamRequest(string accessToken, string chatgptAccountId)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, UsageEndpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        if (!string.IsNullOrEmpty(chatgptAccountId))
            request.Headers.Add("chatgpt-account-id", chatgptAccountId);
        request.Headers.UserAgent.ParseAdd("SanRingUsageMonitor/0.1 (+https://github.com/sanring)");
        return request;
    }

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    private UsageSummary BuildFromUsage(TrackedAccount account, WhamUsageResponse usage, AppSettings settings)
    {
        var attentionThreshold = settings.AttentionThresholdPercent;
        var threshold = settings.NearLimitThresholdPercent;
        var now = DateTime.Now.ToString("HH:mm:ss");

        double? primaryPct = usage.RateLimit!.PrimaryWindow?.UsedPercent;
        double? secondaryPct = usage.RateLimit.SecondaryWindow?.UsedPercent;

        LocalizedText? primaryDetail = ActiveReset(usage.RateLimit.PrimaryWindow?.ResetAt) is { } r1
            ? L(MessageKeys.WindowReset, ("time", FormatResetLocal(r1))) : null;
        // 7 天的視窗只顯示 HH:mm 會讓人搞不清楚是哪一天重置（5 小時那個幾乎一定當天到期，7 天不會）
        // ——補上日期，見 FormatResetLocalWithDate。
        LocalizedText? secondaryDetail = ActiveReset(usage.RateLimit.SecondaryWindow?.ResetAt) is { } r2
            ? L(MessageKeys.WindowReset, ("time", FormatResetLocalWithDate(r2))) : null;

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: primaryPct,
            UsageState: ClassifyState(primaryPct, attentionThreshold, threshold),
            ConnectionState: "valid",
            IsEstimated: false, // official ChatGPT backend data now, not a local ccusage estimate
            AsOf: now,
            Detail: primaryDetail,
            PercentUsedLabel: L(MessageKeys.FiveHourLabel),
            SecondaryPercentUsed: secondaryPct,
            SecondaryUsageState: ClassifyState(secondaryPct, attentionThreshold, threshold),
            SecondaryPercentUsedLabel: L(MessageKeys.SevenDayLabel),
            SecondaryDetail: secondaryDetail,
            AccountLabel: account.Label,
            PlanLabel: FormatPlanLabel(usage.PlanType));
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

    /// <summary>0 / missing = window not started (first-request anchoring). Don't render 1970.</summary>
    private static long? ActiveReset(long? resetAt) =>
        resetAt is { } value && value > 0 ? value : null;

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
    public long? ResetAt { get; set; }
}
