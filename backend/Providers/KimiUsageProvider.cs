using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Kimi (Moonshot AI) is a pure API-key service (constitution R2), same shape as DeepSeek. Calls
/// Moonshot's own balance endpoint (https://platform.moonshot.ai/docs/api/balance).
/// NOTE: keys issued on platform.kimi.ai/kimi.com are reportedly independent from moonshot.ai/.cn
/// and not interchangeable (PRD §12-style caveat) — this targets the moonshot.ai international
/// endpoint; a key from the separate kimi.com platform may 401 here even if valid.
/// </summary>
public sealed class KimiUsageProvider(ISecretStore secretStore) : IUsageProvider
{
    public string SourceId => "kimi";
    public string DisplayName => "Kimi";
    public string SourceType => "api_key";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        var apiKey = secretStore.Get(account.AccountId);
        if (string.IsNullOrEmpty(apiKey))
            return Build(account, "not_configured", null, L(MessageKeys.ApiKeyNotConfigured));

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.moonshot.ai/v1/users/me/balance");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "invalid", null, L(MessageKeys.KimiInvalidKey));

            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", null, L(MessageKeys.KimiHttpError, ("status", ((int)response.StatusCode).ToString())));

            var body = await response.Content.ReadAsStringAsync(ct);
            var parsed = JsonSerializer.Deserialize<KimiBalanceResponse>(body, JsonOptions);
            if (parsed is null || !parsed.Status || parsed.Data is null)
                return Build(account, "invalid", null, L(MessageKeys.KimiParseError, ("body", Truncate(body))));

            var balance = parsed.Data.AvailableBalance;
            var attentionThreshold = settings.KimiAttentionBalanceThresholdUsd;
            var threshold = settings.KimiLowBalanceThresholdUsd;
            var usageState = balance <= 0 ? "exceeded"
                : threshold is { } t && balance <= t ? "near_limit"
                : attentionThreshold is { } a && balance <= a ? "attention"
                : "normal";

            return Build(account, "valid", usageState, L(MessageKeys.KimiBalance, ("balance", balance.ToString("0.00", CultureInfo.InvariantCulture))), isEstimated: false);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", null, L(MessageKeys.KimiCallFailed, ("message", ex.Message)));
        }
    }

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200] + "…";

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    private UsageSummary Build(TrackedAccount account, string connectionState, string? usageState, LocalizedText detail, bool isEstimated = false) => new(
        Source: account.AccountId,
        DisplayName: DisplayName,
        SourceType: SourceType,
        PercentUsed: null,
        UsageState: usageState ?? "unknown",
        ConnectionState: connectionState,
        IsEstimated: isEstimated,
        AsOf: DateTime.Now.ToString("HH:mm:ss"),
        Detail: detail,
        AccountLabel: account.Label);
}

internal sealed class KimiBalanceResponse
{
    public int Code { get; set; }
    public bool Status { get; set; }
    public KimiBalanceData? Data { get; set; }
}

internal sealed class KimiBalanceData
{
    // Same snake_case gotcha as DeepSeek — see DeepSeekUsageProvider's DTO comment.
    [JsonPropertyName("available_balance")]
    public double AvailableBalance { get; set; }
}
