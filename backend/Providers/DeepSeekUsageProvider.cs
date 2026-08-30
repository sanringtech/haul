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

    public async Task<UsageSummary> GetUsageAsync(AppSettings settings, CancellationToken ct)
    {
        var apiKey = secretStore.Get(SourceId);
        if (string.IsNullOrEmpty(apiKey))
            return Build("not_configured", null, null, "尚未設定 API key");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.deepseek.com/user/balance");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build("invalid", null, null, "API key 被拒絕（撤銷或格式錯誤）");

            if (!response.IsSuccessStatusCode)
                return Build("invalid", null, null, $"DeepSeek 回應錯誤：HTTP {(int)response.StatusCode}");

            var body = await response.Content.ReadAsStringAsync(ct);
            var parsed = JsonSerializer.Deserialize<DeepSeekBalanceResponse>(body, JsonOptions);
            var info = parsed?.BalanceInfos?.FirstOrDefault();
            if (info is null || !double.TryParse(info.TotalBalance, out var balance))
                // Include the raw body (truncated) instead of a bare "can't parse" — it's the
                // user's own balance figures on their own machine, safe to surface, and the only
                // way to actually debug a future schema mismatch without guessing again.
                return Build("invalid", null, null, $"DeepSeek 回應內容無法解析：{Truncate(body)}");

            var threshold = settings.DeepSeekLowBalanceThresholdUsd;
            var usageState = !parsed!.IsAvailable ? "exceeded"
                : threshold is { } t && balance <= t ? "near_limit"
                : "normal";

            return Build("valid", usageState, null, $"剩餘額度 {info.Currency} {balance:N2}");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build("invalid", null, null, $"呼叫 DeepSeek 用量端點失敗：{ex.Message}");
        }
    }

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200] + "…";

    private UsageSummary Build(string connectionState, string? usageState, double? percentUsed, string detail) => new(
        Source: SourceId,
        DisplayName: DisplayName,
        SourceType: SourceType,
        PercentUsed: percentUsed,
        UsageState: usageState ?? "unknown",
        ConnectionState: connectionState,
        IsEstimated: false, // DeepSeek's own official balance endpoint — not a local estimate (constitution R3 only requires the badge for local estimates).
        AsOf: DateTime.Now.ToString("HH:mm:ss"),
        Detail: detail);
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
