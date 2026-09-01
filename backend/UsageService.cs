using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Providers;
using UsageMonitor.Desktop.Security;
using UsageMonitor.Desktop.Services;

namespace UsageMonitor.Desktop;

/// <summary>One known provider type's metadata, for the "＋ 新增來源" picker — not tied to a specific account.</summary>
public sealed record SourceCatalogEntry(string SourceId, string DisplayName, string SourceType, bool IsTracked);

/// <summary>
/// 設定頁（PRD M3）看得到、改得到的子集——AppSettings 裡跟帳號無關的全域設定。
///
/// 2026-09-01：原本這裡還有 RetentionDays（歷史資料保留期），已經移除——PRD Story 6 假設這個 app
/// 會存一份本機用量歷史序列（隨時間累積的時間序列，可以回頭看用量趨勢），保留期是控制這份歷史存
/// 幾天、超過自動清掉，概念上像 log rotation。但這個歷史紀錄功能從來沒有真的做出來：現在每次刷新
/// 都是純即時查詢，不落地存歷史，沒有任何時間序列資料存在，保留期自然沒有東西可以清。與其留一個
/// 「存得下去但完全沒作用」的裝飾性設定，直接拿掉；要不要真的做歷史紀錄/趨勢圖是另一個功能，見
/// AI-LANDSCAPE.md 或之後另外開的 issue。
/// </summary>
public sealed record UserSettings(
    int? RefreshIntervalMinutes,
    int AttentionThresholdPercent,
    int NearLimitThresholdPercent,
    double? DeepSeekAttentionBalanceThresholdUsd,
    double? DeepSeekLowBalanceThresholdUsd,
    double? KimiAttentionBalanceThresholdUsd,
    double? KimiLowBalanceThresholdUsd);

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
            new CursorUsageProvider(),                   // 訂閱制（2026-09-01 新增，已實測，見 AI-LANDSCAPE.md）
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
            // Claude 是唯一支援多個訂閱制帳號的來源（靠 cswap，見 AddClaudeAccountsAsync）——已經追蹤
            // 一個不代表不能再偵測到新的，所以「＋ 新增來源」清單裡永遠讓它可以再按一次，不像其他
            // 訂閱制來源（Codex）那樣一有帳號就整個變灰。
            var isTracked = p.SourceType == "subscription" && alreadyHasAccount && p.SourceId != "claude";
            return new SourceCatalogEntry(p.SourceId, p.DisplayName, p.SourceType, isTracked);
        })];
    }

    /// <summary>
    /// Adds a new account (or several — see the Claude/cswap branch) and does one immediate probe —
    /// for api_key sources that's validating the key against the real endpoint; for subscription
    /// sources it's "try to detect the local CLI/session right now" (constitution R2: nothing to
    /// type, just something to find). Returns one UsageSummary per account actually added — usually
    /// one, but Claude-via-cswap can add several in a single click; an empty array means "nothing new
    /// to add" (e.g. cswap detected accounts but all of them were already tracked).
    /// </summary>
    public async Task<UsageSummary[]> AddSourceAsync(string sourceId, string? apiKey, CancellationToken ct = default)
    {
        var provider = FindProvider(sourceId);
        var settings = SettingsStore.Load();

        if (sourceId == "claude")
            return await AddClaudeAccountsAsync((ClaudeUsageProvider)provider, settings, ct);

        TrackedAccount account;
        if (provider.SourceType == "subscription")
        {
            // Singleton — reuse the existing entry if this is a retry, don't spawn a second one.
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
        return [await GetOneAsync(account, settings, ct)];
    }

    /// <summary>
    /// Claude 是唯一支援多個訂閱制帳號同時追蹤的來源，靠偵測本機是否裝了使用者選用安裝的 cswap
    /// （claude-swap）——有裝就把它回報的「每一個」帳號各自變成一個 TrackedAccount（AccountId 用
    /// email 識別，見 ClaudeUsageProvider.CswapAccountId），已經追蹤過的跳過不重複加；沒裝 cswap
    /// 就退回原本的單帳號行為（讀本機唯一登入中的 Claude Code session，AccountId 就是 "claude"）。
    /// </summary>
    private async Task<UsageSummary[]> AddClaudeAccountsAsync(ClaudeUsageProvider provider, AppSettings settings, CancellationToken ct)
    {
        var cswapAccounts = await provider.TryDetectCswapAccountsAsync(ct);

        if (cswapAccounts is { Length: > 0 })
        {
            // 舊版單帳號模式留下的 TrackedAccount（AccountId 字面上就是 "claude"）如果還在，代表
            // 使用者升級這個功能前就已經在追蹤——它讀的正是「目前登入中」那個 session，對應到
            // cswap 清單裡 active=true 的那個帳號。原地「升級」成新的 email 格式（保留使用者可能
            // 已經改過的 Label），不是留著兩份重複顯示同一個帳號的用量。
            var upgraded = false;
            var legacyIndex = settings.TrackedAccounts.FindIndex(a => a.AccountId == "claude");
            if (legacyIndex >= 0)
            {
                var activeEmail = cswapAccounts.FirstOrDefault(c => c.Active)?.Email;
                if (!string.IsNullOrEmpty(activeEmail))
                {
                    var upgradedId = ClaudeUsageProvider.CswapAccountId(activeEmail);
                    if (settings.TrackedAccounts.Any(a => a.AccountId == upgradedId))
                    {
                        // 新格式理論上不該已經存在（防禦性處理）——與其硬升級造成衝突，直接把舊的
                        // 重複條目丟掉，讓新格式那筆（下面 newAccounts 的邏輯會跳過它，因為已存在）繼續運作。
                        settings.TrackedAccounts.RemoveAt(legacyIndex);
                    }
                    else
                    {
                        var legacyAccount = settings.TrackedAccounts[legacyIndex];
                        settings.TrackedAccounts[legacyIndex] = legacyAccount with { AccountId = upgradedId };
                        if (settings.HiddenAccountIds.Remove("claude"))
                            settings.HiddenAccountIds.Add(upgradedId);
                    }
                    upgraded = true;
                }
                // activeEmail 拿不到（cswap 清單裡沒有任何 active=true 的帳號，理論上不該發生）就
                // 不動舊格式——保守起見寧可讓它繼續用原本的直接呼叫邏輯運作，也不要亂猜升級成哪個帳號。
            }

            var newAccounts = cswapAccounts
                .Where(c => !string.IsNullOrEmpty(c.Email))
                .Select(c => new TrackedAccount(ClaudeUsageProvider.CswapAccountId(c.Email), "claude", c.Email))
                .Where(a => !settings.TrackedAccounts.Any(existing => existing.AccountId == a.AccountId))
                .ToList();

            if (newAccounts.Count == 0 && !upgraded)
                return []; // cswap 有裝，但偵測到的帳號全部都已經追蹤過了，沒有任何異動可存

            settings.TrackedAccounts.AddRange(newAccounts);
            foreach (var a in newAccounts) settings.HiddenAccountIds.Remove(a.AccountId);
            SettingsStore.Save(settings); // upgraded 或 newAccounts 任一有變動都要存，不能只在有新帳號時才存

            return await Task.WhenAll(newAccounts.Select(a => GetOneAsync(a, settings, ct)));
        }

        // cswap 沒裝（或偵測失敗/逾時）——退回原本的單帳號直接呼叫，行為完全不變。
        var legacy = settings.TrackedAccounts.FirstOrDefault(a => a.AccountId == "claude")
            ?? new TrackedAccount("claude", "claude", Label: null);
        if (!settings.TrackedAccounts.Any(a => a.AccountId == legacy.AccountId))
        {
            settings.TrackedAccounts.Add(legacy);
            SettingsStore.Save(settings);
        }
        return [await GetOneAsync(legacy, settings, ct)];
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
        return new UserSettings(
            settings.RefreshIntervalMinutes,
            settings.AttentionThresholdPercent,
            settings.NearLimitThresholdPercent,
            settings.DeepSeekAttentionBalanceThresholdUsd,
            settings.DeepSeekLowBalanceThresholdUsd,
            settings.KimiAttentionBalanceThresholdUsd,
            settings.KimiLowBalanceThresholdUsd);
    }

    /// <summary>設定頁儲存（PRD：即時儲存即時生效）。閾值 clamp 在 50-95（憲法 §4 三態顏色的定義範圍）。</summary>
    public UserSettings UpdateSettings(
        int? refreshIntervalMinutes,
        int attentionThresholdPercent,
        int nearLimitThresholdPercent,
        double? deepSeekAttentionBalanceThresholdUsd,
        double? deepSeekLowBalanceThresholdUsd,
        double? kimiAttentionBalanceThresholdUsd,
        double? kimiLowBalanceThresholdUsd)
    {
        var settings = SettingsStore.Load();
        settings.RefreshIntervalMinutes = refreshIntervalMinutes;
        settings.NearLimitThresholdPercent = Math.Clamp(nearLimitThresholdPercent, 50, 95);
        settings.AttentionThresholdPercent = Math.Clamp(attentionThresholdPercent, 50, settings.NearLimitThresholdPercent);
        (settings.DeepSeekAttentionBalanceThresholdUsd, settings.DeepSeekLowBalanceThresholdUsd) =
            NormalizeBalanceThresholds(deepSeekAttentionBalanceThresholdUsd, deepSeekLowBalanceThresholdUsd);
        (settings.KimiAttentionBalanceThresholdUsd, settings.KimiLowBalanceThresholdUsd) =
            NormalizeBalanceThresholds(kimiAttentionBalanceThresholdUsd, kimiLowBalanceThresholdUsd);
        SettingsStore.Save(settings);
        return GetSettings();
    }

    private static double? NormalizeBalanceThreshold(double? value) => value is { } amount
        ? Math.Round(Math.Max(0, amount), 2)
        : null;

    private static (double? Attention, double? Critical) NormalizeBalanceThresholds(double? attention, double? critical)
    {
        var normalizedAttention = NormalizeBalanceThreshold(attention);
        var normalizedCritical = NormalizeBalanceThreshold(critical);
        if (normalizedAttention is { } a && normalizedCritical is { } c && c >= a)
            normalizedCritical = Math.Max(0, a - 0.01);
        return (normalizedAttention, normalizedCritical);
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
