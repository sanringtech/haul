using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// DeepSeek is a pure API-key service (constitution R2) — no local CLI, no login flow. The user's
/// key is read from the OS keychain and used to call DeepSeek's own official balance endpoint
/// (https://api-docs.deepseek.com/api/get-user-balance/), never sent anywhere but there.
/// </summary>
public sealed class DeepSeekUsageProvider(ISecretStore secretStore) : IUsageProvider
{
    public string SourceId => "deepseek";
    public string DisplayName => "DeepSeek";
    public string SourceType => "api_key";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        // Keyed by AccountId, not SourceId — that's what lets two DeepSeek accounts hold two different keys.
        var apiKey = secretStore.Get(account.AccountId);
        if (string.IsNullOrEmpty(apiKey))
            return Build(account, "not_configured", null, null, L(MessageKeys.ApiKeyNotConfigured));

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.deepseek.com/user/balance");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "invalid", null, null, L(MessageKeys.DeepSeekInvalidKey));

            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", null, null, L(MessageKeys.DeepSeekHttpError, ("status", ((int)response.StatusCode).ToString())));

            var body = await response.Content.ReadAsStringAsync(ct);
            var parsed = JsonSerializer.Deserialize<DeepSeekBalanceResponse>(body, JsonOptions);
            var info = parsed?.BalanceInfos?.FirstOrDefault();
            if (info is null || !double.TryParse(info.TotalBalance, out var balance))
                // Include the raw body (truncated) instead of a bare "can't parse" — it's the
                // user's own balance figures on their own machine, safe to surface, and the only
                // way to actually debug a future schema mismatch without guessing again.
                return Build(account, "invalid", null, null, L(MessageKeys.DeepSeekParseError, ("body", Truncate(body))));

            var attentionThreshold = settings.DeepSeekAttentionBalanceThresholdUsd;
            var threshold = settings.DeepSeekLowBalanceThresholdUsd;
            var usageState = !parsed!.IsAvailable ? "exceeded"
                : threshold is { } t && balance <= t ? "near_limit"
                : attentionThreshold is { } a && balance <= a ? "attention"
                : "normal";

            return Build(account, "valid", usageState, null, L(MessageKeys.DeepSeekBalance, ("currency", info.Currency), ("balance", balance.ToString("N2"))));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", null, null, L(MessageKeys.DeepSeekCallFailed, ("message", ex.Message)));
        }
    }

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200] + "…";

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    private UsageSummary Build(TrackedAccount account, string connectionState, string? usageState, double? percentUsed, LocalizedText detail) => new(
        Source: account.AccountId,
        DisplayName: DisplayName,
        SourceType: SourceType,
        PercentUsed: percentUsed,
        UsageState: usageState ?? "unknown",
        ConnectionState: connectionState,
        IsEstimated: false, // DeepSeek's own official balance endpoint — not a local estimate (constitution R3 only requires the badge for local estimates).
        AsOf: DateTime.Now.ToString("HH:mm:ss"),
        Detail: detail,
        AccountLabel: account.Label);
}

internal sealed class DeepSeekBalanceResponse
{
    // DeepSeek's API is snake_case (is_available, balance_infos, ...). PropertyNameCaseInsensitive
    // only ignores letter case, NOT underscores — "is_available" never matches "IsAvailable" without
    // an explicit mapping like this. (This is exactly the bug that made every response "unparseable".)
    [JsonPropertyName("is_available")]
    public bool IsAvailable { get; set; }

    [JsonPropertyName("balance_infos")]
    public List<DeepSeekBalanceInfo>? BalanceInfos { get; set; }
}

internal sealed class DeepSeekBalanceInfo
{
    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "USD";

    [JsonPropertyName("total_balance")]
    public string TotalBalance { get; set; } = "0";
}
