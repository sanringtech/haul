using System.Text;
using System.Text.Json;
using UsageMonitor.Desktop.Providers;

namespace UsageMonitor.Desktop.Security;

/// <summary>
/// 訂閱制多帳號快照庫。JSON 存在既有 <see cref="ISecretStore"/>（Keychain / Credential Manager），
/// key 加 <c>sub:</c> 前綴，跟 API key 的 accountId 錯開。
/// </summary>
public sealed class SubscriptionSnapshotStore
{
    internal const string KeyPrefix = "sub:";
    private const string ClaudeClientId = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
    private const string CodexClientId = "app_EMoamEEZ73f0CkXaXp7hrann";
    private const string ClaudeRefreshUrl = "https://platform.claude.com/v1/oauth/token";
    private const string CodexRefreshUrl = "https://auth.openai.com/oauth/token";
    private const long ExpiryBufferMs = 60_000;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly ISecretStore _secrets;

    public SubscriptionSnapshotStore(ISecretStore secrets) => _secrets = secrets;

    public SubscriptionSnapshot? Get(string accountId)
    {
        var raw = _secrets.Get(KeyPrefix + accountId);
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            return JsonSerializer.Deserialize<SubscriptionSnapshot>(raw, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public void Save(SubscriptionSnapshot snapshot) =>
        _secrets.Set(KeyPrefix + snapshot.AccountId, JsonSerializer.Serialize(snapshot, JsonOptions));

    public void Delete(string accountId) => _secrets.Delete(KeyPrefix + accountId);

    public async Task<SubscriptionSnapshot?> GetFreshAsync(string accountId, CancellationToken ct)
    {
        var snap = Get(accountId);
        if (snap is null) return null;
        if (!NeedsRefresh(snap)) return snap;

        var refreshed = snap.SourceId == "codex"
            ? await RefreshCodexAsync(snap, ct)
            : await RefreshClaudeAsync(snap, ct);
        if (refreshed is null) return snap;
        Save(refreshed);
        return refreshed;
    }

    /// <summary>401 後強制換票。失敗回 null，呼叫端顯示過期，不覆蓋現有快照。</summary>
    public async Task<SubscriptionSnapshot?> RefreshNowAsync(SubscriptionSnapshot snap, CancellationToken ct)
    {
        var refreshed = snap.SourceId == "codex"
            ? await RefreshCodexAsync(snap, ct)
            : await RefreshClaudeAsync(snap, ct);
        if (refreshed is null) return null;
        Save(refreshed);
        return refreshed;
    }

    private static bool NeedsRefresh(SubscriptionSnapshot snap)
    {
        if (string.IsNullOrEmpty(snap.RefreshToken)) return false;
        if (snap.AccessExpiresAtMs is not { } exp) return false;
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + ExpiryBufferMs >= exp;
    }

    private static async Task<SubscriptionSnapshot?> RefreshClaudeAsync(SubscriptionSnapshot snap, CancellationToken ct)
    {
        try
        {
            var payload = JsonSerializer.Serialize(new
            {
                grant_type = "refresh_token",
                refresh_token = snap.RefreshToken,
                client_id = ClaudeClientId,
            });
            using var request = new HttpRequestMessage(HttpMethod.Post, ClaudeRefreshUrl);
            request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var root = doc.RootElement;
            var access = root.TryGetProperty("access_token", out var at) ? at.GetString() : null;
            if (string.IsNullOrEmpty(access)) return null;
            var refresh = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : snap.RefreshToken;
            long? expires = null;
            if (root.TryGetProperty("expires_in", out var ei) && ei.TryGetInt32(out var seconds))
                expires = DateTimeOffset.UtcNow.AddSeconds(seconds).ToUnixTimeMilliseconds();
            return snap with { AccessToken = access, RefreshToken = refresh ?? snap.RefreshToken, AccessExpiresAtMs = expires };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return null;
        }
    }

    private static async Task<SubscriptionSnapshot?> RefreshCodexAsync(SubscriptionSnapshot snap, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, CodexRefreshUrl);
            request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = snap.RefreshToken,
                ["client_id"] = CodexClientId,
            });
            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var root = doc.RootElement;
            var access = root.TryGetProperty("access_token", out var at) ? at.GetString() : null;
            if (string.IsNullOrEmpty(access)) return null;
            var refresh = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
            if (string.IsNullOrEmpty(refresh)) return null;
            long? expires = null;
            if (root.TryGetProperty("expires_in", out var ei) && ei.TryGetInt32(out var seconds))
                expires = DateTimeOffset.UtcNow.AddSeconds(seconds).ToUnixTimeMilliseconds();
            return snap with { AccessToken = access, RefreshToken = refresh, AccessExpiresAtMs = expires };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return null;
        }
    }
}
