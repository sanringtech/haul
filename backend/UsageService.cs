using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Providers;
using UsageMonitor.Desktop.Security;
using UsageMonitor.Desktop.Services;

namespace UsageMonitor.Desktop;

/// <summary>One known provider type's metadata, for the "＋ 新增來源" picker — not tied to a specific account.</summary>
public sealed record SourceCatalogEntry(string SourceId, string DisplayName, string SourceType, bool IsTracked);

/// <summary>
/// 設定頁（PRD M3）看得到、改得到的子集——AppSettings 裡跟帳號無關的全域設定。RetentionDays
/// 目前只會被存起來，不會有任何實際效果：這個 app 從來沒有「歷史用量序列」這種資料可以清除，
/// 每次刷新都是即時查詢、不落地存歷史（PRD Story 6 假設的清除對象目前不存在）。前端 UI 上會誠實
/// 標註這件事，不要假裝這個欄位有在運作。
/// </summary>
public sealed record UserSettings(int? RefreshIntervalMinutes, int? RetentionDays, int NearLimitThresholdPercent);

/// <summary>
/// 「已隱藏的來源」列表要顯示的最小資訊——關閉顯示（憲法 §8）之後，帳號從 GetSummariesAsync() 消失，
/// 得靠這個另外查才找得回來重新顯示。故意不查即時用量（隱藏中不需要），只給足夠辨識帳號的資訊。
/// </summary>
public sealed record HiddenAccountEntry(string AccountId, string DisplayName, string? AccountLabel, string SourceType);

/// <summary>
/// Orchestrates all <see cref="IUsageProvider"/>s (constitution R1: Claude/Codex/DeepSeek/Kimi) across
/// however many <see cref="TrackedAccount"/>s the user has added (constitution R5: multi-account —
/// api_key-type sources like DeepSeek/Kimi can have several accounts; subscription-type sources
/// stay singleton, one login at a time) plus the add/remove/visibility operations from PRD §7.
/// </summary>
public sealed class UsageService
{
    private readonly ISecretStore _secretStore;
    private readonly IReadOnlyDictionary<string, IUsageProvider> _providersBySourceId;

    public UsageService()
    {
        _secretStore = SecretStoreFactory.Create();
        IUsageProvider[] providers =
        [
            new ClaudeUsageProvider(),
            new CodexUsageProvider(),
            new DeepSeekUsageProvider(_secretStore),
            new KimiUsageProvider(_secretStore),        // api_key 制（既有）
            new KimiSubscriptionUsageProvider(),         // 訂閱制（2026-08-31 新增，未實測，見該檔案註解）
        ];
        _providersBySourceId = providers.ToDictionary(p => p.SourceId);
    }

    /// <summary>Only accounts the user has explicitly added and not hidden. A fresh install returns an empty array.</summary>
    public async Task<UsageSummary[]> GetSummariesAsync(CancellationToken ct = default)
    {
        var settings = SettingsStore.Load();
        var visible = settings.TrackedAccounts.Where(a => !settings.HiddenAccountIds.Contains(a.AccountId));
        return await Task.WhenAll(visible.Select(a => GetOneAsync(a, settings, ct)));
    }

    /// <summary>
    /// All known provider types for the "＋ 新增來源" picker. Subscription types (one login at a time)
    /// disappear once tracked; api_key types never do — a second/third DeepSeek account doesn't
    /// conflict with the first, so there's nothing to hide (constitution R5).
    /// </summary>
    public SourceCatalogEntry[] GetCatalog()
    {
        var settings = SettingsStore.Load();
        return [.. _providersBySourceId.Values.Select(p =>
        {
            var alreadyHasAccount = settings.TrackedAccounts.Any(a => a.SourceId == p.SourceId);
            var isTracked = p.SourceType == "subscription" && alreadyHasAccount;
            return new SourceCatalogEntry(p.SourceId, p.DisplayName, p.SourceType, isTracked);
        })];
    }

    /// <summary>
    /// Adds a new account and does one immediate probe — for api_key sources that's validating the
    /// key against the real endpoint; for subscription sources it's "try to detect the local CLI/
    /// session right now" (constitution R2: nothing to type, just something to find).
    /// </summary>
    public async Task<UsageSummary> AddSourceAsync(string sourceId, string? apiKey, CancellationToken ct = default)
    {
        var provider = FindProvider(sourceId);
        var settings = SettingsStore.Load();

        TrackedAccount account;
        if (provider.SourceType == "subscription")
        {
            // Singleton — reuse the existing entry if this is a retry, don't spawn a second "claude".
            account = settings.TrackedAccounts.FirstOrDefault(a => a.SourceId == sourceId)
                ?? new TrackedAccount(sourceId, sourceId, Label: null);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new ArgumentException($"{provider.DisplayName} 需要提供 API key");

            // Auto-numbered placeholder label — real per-account naming (with rename support, constitution
            // R5) is bigger multi-account UI work, not in this slice (user explicitly deferred it).
            var existingCount = settings.TrackedAccounts.Count(a => a.SourceId == sourceId);
            var label = existingCount == 0 ? provider.DisplayName : $"{provider.DisplayName} #{existingCount + 1}";
            account = new TrackedAccount($"{sourceId}-{Guid.NewGuid():N}", sourceId, label);
            _secretStore.Set(account.AccountId, apiKey.Trim());
        }

        var changed = false;
        if (!settings.TrackedAccounts.Any(a => a.AccountId == account.AccountId))
        {
            settings.TrackedAccounts.Add(account);
            changed = true;
        }
        changed |= settings.HiddenAccountIds.Remove(account.AccountId);
        if (changed) SettingsStore.Save(settings);

        // Call it once immediately so the caller finds out right away whether it actually worked,
        // rather than waiting for the next refresh cycle.
        return await GetOneAsync(account, settings, ct);
    }

    /// <summary>取消追蹤（constitution §8）— full deletion of this one account, siblings of the same source untouched (R5).</summary>
    public void RemoveSource(string accountId)
    {
        _secretStore.Delete(accountId);

        var settings = SettingsStore.Load();
        var changed = settings.TrackedAccounts.RemoveAll(a => a.AccountId == accountId) > 0;
        changed |= settings.HiddenAccountIds.Remove(accountId);
        if (changed) SettingsStore.Save(settings);
    }

    /// <summary>關閉顯示 / reopen（constitution §8）— data and keys are untouched either way.</summary>
    public void SetVisibility(string accountId, bool visible)
    {
        var settings = SettingsStore.Load();
        var changed = visible ? settings.HiddenAccountIds.Remove(accountId) : EnsureHidden(settings, accountId);
        if (changed) SettingsStore.Save(settings);
    }

    /// <summary>設定頁「已隱藏的來源」清單——找回被關閉顯示、但沒被取消追蹤（沒被刪除）的帳號。</summary>
    public HiddenAccountEntry[] GetHiddenAccounts()
    {
        var settings = SettingsStore.Load();
        return [.. settings.TrackedAccounts
            .Where(a => settings.HiddenAccountIds.Contains(a.AccountId))
            .Select(a =>
            {
                var provider = FindProvider(a.SourceId);
                return new HiddenAccountEntry(a.AccountId, provider.DisplayName, a.Label, provider.SourceType);
            })];
    }

    /// <summary>使用者自訂這個帳號的標籤（不動 displayName——那是 AI 類型，同類型每個帳號都一樣）。空字串視同清除。</summary>
    public void RenameAccount(string accountId, string? label)
    {
        var settings = SettingsStore.Load();
        var index = settings.TrackedAccounts.FindIndex(a => a.AccountId == accountId);
        if (index < 0) return;

        var trimmed = string.IsNullOrWhiteSpace(label) ? null : label.Trim();
        if (settings.TrackedAccounts[index].Label == trimmed) return;

        settings.TrackedAccounts[index] = settings.TrackedAccounts[index] with { Label = trimmed };
        SettingsStore.Save(settings);
    }

    public UserSettings GetSettings()
    {
        var settings = SettingsStore.Load();
        return new UserSettings(settings.RefreshIntervalMinutes, settings.RetentionDays, settings.NearLimitThresholdPercent);
    }

    /// <summary>設定頁儲存（PRD：即時儲存即時生效）。閾值 clamp 在 50-95（憲法 §4 三態顏色的定義範圍）。</summary>
    public UserSettings UpdateSettings(int? refreshIntervalMinutes, int? retentionDays, int nearLimitThresholdPercent)
    {
        var settings = SettingsStore.Load();
        settings.RefreshIntervalMinutes = refreshIntervalMinutes;
        settings.RetentionDays = retentionDays;
        settings.NearLimitThresholdPercent = Math.Clamp(nearLimitThresholdPercent, 50, 95);
        SettingsStore.Save(settings);
        return GetSettings();
    }

    /// <summary>拖曳排序（前端送整批新順序的 accountId）。列表順序即顯示順序，沒有另外的 SortOrder 欄位。</summary>
    public void ReorderAccounts(IReadOnlyList<string> orderedAccountIds)
    {
        var settings = SettingsStore.Load();
        var byId = settings.TrackedAccounts.ToDictionary(a => a.AccountId);

        var reordered = orderedAccountIds.Where(byId.ContainsKey).Select(id => byId[id]).ToList();
        // Defensive: an account this call didn't mention (stale client state, race with add/remove)
        // keeps its relative order appended at the end rather than silently vanishing from settings.
        reordered.AddRange(settings.TrackedAccounts.Where(a => !orderedAccountIds.Contains(a.AccountId)));

        settings.TrackedAccounts = reordered;
        SettingsStore.Save(settings);
    }

    private static bool EnsureHidden(AppSettings settings, string accountId)
    {
        if (settings.HiddenAccountIds.Contains(accountId)) return false;
        settings.HiddenAccountIds.Add(accountId);
        return true;
    }

    private IUsageProvider FindProvider(string sourceId) =>
        _providersBySourceId.TryGetValue(sourceId, out var provider)
            ? provider
            : throw new ArgumentException($"未知的來源: {sourceId}");

    private async Task<UsageSummary> GetOneAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        try
        {
            var provider = FindProvider(account.SourceId);
            return await provider.GetUsageAsync(account, settings, ct);
        }
        catch (Exception ex)
        {
            // A provider must never take the whole refresh down with it.
            return new UsageSummary(
                Source: account.AccountId,
                DisplayName: account.Label ?? account.SourceId,
                SourceType: "unknown",
                PercentUsed: null,
                UsageState: "unknown",
                ConnectionState: "invalid",
                IsEstimated: true,
                AsOf: DateTime.Now.ToString("HH:mm:ss"),
                Detail: new LocalizedText(MessageKeys.UnexpectedError, new Dictionary<string, string> { ["message"] = ex.Message }),
                AccountLabel: account.Label);
        }
    }
}
