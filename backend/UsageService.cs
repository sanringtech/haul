using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Providers;
using UsageMonitor.Desktop.Security;
using UsageMonitor.Desktop.Services;

namespace UsageMonitor.Desktop;

/// <summary>One known provider type's metadata, for the "＋ 新增來源" picker — not tied to a specific account.</summary>
public sealed record SourceCatalogEntry(string SourceId, string DisplayName, string SourceType, bool IsTracked);

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
                Detail: $"未預期的錯誤：{ex.Message}",
                AccountLabel: account.Label);
        }
    }
}
