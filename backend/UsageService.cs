using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Providers;
using UsageMonitor.Desktop.Security;
using UsageMonitor.Desktop.Services;

namespace UsageMonitor.Desktop;

/// <summary>
/// Orchestrates all <see cref="IUsageProvider"/>s (constitution R1: Claude/Codex/DeepSeek/Kimi, PRD M2
/// complete) plus the add/remove/visibility operations from PRD §7 and constitution §8.
/// </summary>
public sealed class UsageService
{
    private readonly ISecretStore _secretStore;
    private readonly IReadOnlyList<IUsageProvider> _providers;

    public UsageService()
    {
        _secretStore = SecretStoreFactory.Create();
        _providers =
        [
            new ClaudeUsageProvider(),
            new CodexUsageProvider(),
            new DeepSeekUsageProvider(_secretStore),
            new KimiUsageProvider(_secretStore),
        ];
    }

    /// <summary>Everything except sources the user has hidden (constitution §8 "關閉顯示").</summary>
    public async Task<UsageSummary[]> GetSummariesAsync(CancellationToken ct = default)
    {
        var settings = SettingsStore.Load();
        var results = await Task.WhenAll(_providers.Select(p => GetOneAsync(p, settings, ct)));
        return [.. results.Where(r => !settings.HiddenSources.Contains(r.Source))];
    }

    /// <summary>api_key sources only (subscription sources have nothing to store — see constitution R2).</summary>
    public async Task<UsageSummary> AddSourceAsync(string sourceId, string? apiKey, CancellationToken ct = default)
    {
        var provider = FindProvider(sourceId);
        if (provider.SourceType == "api_key")
        {
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new ArgumentException($"{provider.DisplayName} 需要提供 API key");
            _secretStore.Set(sourceId, apiKey.Trim());
        }

        var settings = SettingsStore.Load();
        if (settings.HiddenSources.Remove(sourceId))
            SettingsStore.Save(settings);

        // Call it once immediately so the caller finds out right away whether the key actually works,
        // rather than waiting for the next refresh cycle.
        return await GetOneAsync(provider, settings, ct);
    }

    /// <summary>取消追蹤（constitution §8）— full deletion, not just hiding: deletes the stored key too.</summary>
    public void RemoveSource(string sourceId)
    {
        _secretStore.Delete(sourceId);

        var settings = SettingsStore.Load();
        if (!settings.HiddenSources.Contains(sourceId))
        {
            settings.HiddenSources.Add(sourceId);
            SettingsStore.Save(settings);
        }
    }

    /// <summary>關閉顯示 / reopen（constitution §8）— data and keys are untouched either way.</summary>
    public void SetVisibility(string sourceId, bool visible)
    {
        var settings = SettingsStore.Load();
        var changed = visible ? settings.HiddenSources.Remove(sourceId) : EnsureHidden(settings, sourceId);
        if (changed) SettingsStore.Save(settings);
    }

    private static bool EnsureHidden(AppSettings settings, string sourceId)
    {
        if (settings.HiddenSources.Contains(sourceId)) return false;
        settings.HiddenSources.Add(sourceId);
        return true;
    }

    private IUsageProvider FindProvider(string sourceId) =>
        _providers.FirstOrDefault(p => p.SourceId == sourceId)
        ?? throw new ArgumentException($"未知的來源: {sourceId}");

    private static async Task<UsageSummary> GetOneAsync(IUsageProvider provider, AppSettings settings, CancellationToken ct)
    {
        try
        {
            return await provider.GetUsageAsync(settings, ct);
        }
        catch (Exception ex)
        {
            // A provider must never take the whole refresh down with it.
            return new UsageSummary(
                Source: provider.SourceId,
                DisplayName: provider.DisplayName,
                SourceType: provider.SourceType,
                PercentUsed: null,
                UsageState: "unknown",
                ConnectionState: "invalid",
                IsEstimated: true,
                AsOf: DateTime.Now.ToString("HH:mm:ss"),
                Detail: $"未預期的錯誤：{ex.Message}");
        }
    }
}
