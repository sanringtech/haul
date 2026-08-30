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

    public async Task<UsageSummary> GetUsageAsync(AppSettings settings, CancellationToken ct)
    {
        var apiKey = secretStore.Get(SourceId);
        if (string.IsNullOrEmpty(apiKey))
            return Build("not_configured", null, "尚未設定 API key");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.moonshot.ai/v1/users/me/balance");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build("invalid", null, "API key 被拒絕（撤銷、格式錯誤，或這是 platform.kimi.ai 而非 moonshot.ai 發的 key）");

            if (!response.IsSuccessStatusCode)
                return Build("invalid", null, $"Kimi 回應錯誤：HTTP {(int)response.StatusCode}");

            var body = await response.Content.ReadAsStringAsync(ct);
            var parsed = JsonSerializer.Deserialize<KimiBalanceResponse>(body, JsonOptions);
            if (parsed is null || !parsed.Status || parsed.Data is null)
                return Build("invalid", null, $"Kimi 回應內容無法解析或回報失敗：{Truncate(body)}");

            var balance = parsed.Data.AvailableBalance;
            var threshold = settings.KimiLowBalanceThresholdUsd;
            var usageState = balance <= 0 ? "exceeded"
                : threshold is { } t && balance <= t ? "near_limit"
                : "normal";

            return Build("valid", usageState, $"剩餘額度 {balance:N2}", isEstimated: false);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build("invalid", null, $"呼叫 Kimi 用量端點失敗：{ex.Message}");
        }
    }

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200] + "…";

    private UsageSummary Build(string connectionState, string? usageState, string detail, bool isEstimated = false) => new(
        Source: SourceId,
        DisplayName: DisplayName,
        SourceType: SourceType,
        PercentUsed: null,
        UsageState: usageState ?? "unknown",
        ConnectionState: connectionState,
        IsEstimated: isEstimated,
        AsOf: DateTime.Now.ToString("HH:mm:ss"),
        Detail: detail);
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
