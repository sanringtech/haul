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
    double? KimiLowBalanceThresholdUsd,
    bool UsageHistoryEnabled,
    bool ClaudeWakeUpEnabled,
    Dictionary<string, int> ClaudeWakeUpAccountHours);

/// <summary>
/// 「已隱藏的來源」列表要顯示的最小資訊——關閉顯示（憲法 §8）之後，帳號從 GetSummariesAsync() 消失，
/// 得靠這個另外查才找得回來重新顯示。故意不查即時用量（隱藏中不需要），只給足夠辨識帳號的資訊。
/// </summary>
public sealed record HiddenAccountEntry(string AccountId, string DisplayName, string? AccountLabel, string SourceType);

/// <summary>
/// Orchestrates all <see cref="IUsageProvider"/>s (constitution R1: Claude/Codex/DeepSeek/Kimi) across
/// however many <see cref="TrackedAccount"/>s the user has added (constitution R5: multi-account —
/// api_key-type sources like DeepSeek/Kimi can have several accounts; Claude/Codex are captured
/// CLI logins stored in <see cref="SubscriptionSnapshotStore"/>, also several) plus the
/// add/remove/visibility operations from PRD §7.
/// </summary>
public sealed class UsageService
{
    private readonly ISecretStore _secretStore;
    private readonly SubscriptionSnapshotStore _snapshots;
    private readonly IReadOnlyDictionary<string, IUsageProvider> _providersBySourceId;

    public UsageService()
    {
        _secretStore = SecretStoreFactory.Create();
        _snapshots = new SubscriptionSnapshotStore(_secretStore);
        IUsageProvider[] providers =
        [
            new ClaudeUsageProvider(_snapshots),
            new CodexUsageProvider(_snapshots),
            new DeepSeekUsageProvider(_secretStore),
            new KimiUsageProvider(_secretStore),        // api_key 制（既有）
            new KimiSubscriptionUsageProvider(),         // 訂閱制（2026-08-31 新增，未實測，見該檔案註解）
            new CursorUsageProvider(),                   // 訂閱制（2026-09-01 新增，已實測，見 AI-LANDSCAPE.md）
        ];
        _providersBySourceId = providers.ToDictionary(p => p.SourceId);
    }

    public Task ImportCswapIfNeededAsync(CancellationToken ct = default) =>
        CswapImporter.ImportIfNeededAsync(_snapshots, ct);

    public Task PingWakeUpsAsync(CancellationToken ct = default) =>
        ClaudeActivationPinger.PingIfDueAsync(_snapshots, ct);

    /// <summary>Only accounts the user has explicitly added and not hidden. A fresh install returns an empty array.</summary>
    public async Task<UsageSummary[]> GetSummariesAsync(CancellationToken ct = default)
    {
        var settings = SettingsStore.Load();
        var visible = settings.TrackedAccounts.Where(a => !settings.HiddenAccountIds.Contains(a.AccountId));
        return await Task.WhenAll(visible.Select(a => GetOneAsync(a, settings, ct)));
    }

    /// <summary>
    /// All known provider types for the "＋ 新增來源" picker. Singleton subscription types
    /// (Cursor, Kimi sub) grey out once tracked; Claude/Codex stay clickable so more logins
    /// can be captured. api_key types never grey out.
    /// </summary>
    public SourceCatalogEntry[] GetCatalog()
    {
        var settings = SettingsStore.Load();
        return [.. _providersBySourceId.Values.Select(p =>
        {
            var alreadyHasAccount = settings.TrackedAccounts.Any(a => a.SourceId == p.SourceId);
            // Claude / Codex 走「擷取目前 CLI 登入」，可重複加帳號，清單永遠不灰。
            // 其他訂閱制（Cursor、Kimi 訂閱）仍是本機單一 session，追蹤過就變灰。
            var capturable = p.SourceId is "claude" or "codex";
            var isTracked = p.SourceType == "subscription" && alreadyHasAccount && !capturable;
            return new SourceCatalogEntry(p.SourceId, p.DisplayName, p.SourceType, isTracked);
        })];
    }

    /// <summary>
    /// Adds a new account and does one immediate probe. Claude/Codex capture the current CLI login
    /// into the snapshot store (repeatable per account). api_key sources validate the key.
    /// </summary>
    public async Task<UsageSummary[]> AddSourceAsync(string sourceId, string? apiKey, CancellationToken ct = default)
    {
        var provider = FindProvider(sourceId);
        var settings = SettingsStore.Load();

        if (sourceId is "claude" or "codex")
            return await CaptureSubscriptionAsync(sourceId, provider, settings, ct);

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
    /// 擷取目前 CLI 登入進快照庫。同一 email 再擷取一次會覆蓋快照（換票）；不同帳號則新加一筆。
    /// 舊版 AccountId 字面 <c>claude</c> / <c>codex</c> 在第一次成功擷取時升級成 <c>{source}:{email}</c>。
    /// </summary>
    private async Task<UsageSummary[]> CaptureSubscriptionAsync(
        string sourceId, IUsageProvider provider, AppSettings settings, CancellationToken ct)
    {
        SubscriptionSnapshot? snap;
        string? errorKey;
        if (sourceId == "claude")
            (snap, errorKey) = ((ClaudeUsageProvider)provider).TryCaptureCurrent();
        else
            (snap, errorKey) = await ((CodexUsageProvider)provider).TryCaptureCurrentAsync(ct);

        if (snap is null)
        {
            return [new UsageSummary(
                Source: sourceId,
                DisplayName: provider.DisplayName,
                SourceType: provider.SourceType,
                PercentUsed: null,
                UsageState: "unknown",
                ConnectionState: "not_configured",
                IsEstimated: false,
                AsOf: DateTime.Now.ToString("HH:mm:ss"),
                Detail: new LocalizedText(errorKey ?? MessageKeys.UnexpectedError),
                AccountLabel: null)];
        }

        _snapshots.Save(snap);

        var legacyIndex = settings.TrackedAccounts.FindIndex(a => a.AccountId == sourceId);
        if (legacyIndex >= 0)
        {
            if (settings.TrackedAccounts.Any(a => a.AccountId == snap.AccountId && a.AccountId != sourceId))
                settings.TrackedAccounts.RemoveAt(legacyIndex);
            else
                settings.TrackedAccounts[legacyIndex] = settings.TrackedAccounts[legacyIndex] with
                {
                    AccountId = snap.AccountId,
                    Label = settings.TrackedAccounts[legacyIndex].Label ?? snap.Email,
                };
            if (settings.HiddenAccountIds.Remove(sourceId))
                settings.HiddenAccountIds.Add(snap.AccountId);
        }

        if (!settings.TrackedAccounts.Any(a => a.AccountId == snap.AccountId))
            settings.TrackedAccounts.Add(new TrackedAccount(snap.AccountId, sourceId, snap.Email));
        settings.HiddenAccountIds.Remove(snap.AccountId);
        SettingsStore.Save(settings);

        var tracked = settings.TrackedAccounts.First(a => a.AccountId == snap.AccountId);
        return [await GetOneAsync(tracked, settings, ct)];
    }

    /// <summary>取消追蹤（constitution §8）— full deletion of this one account, siblings of the same source untouched (R5).</summary>
    public void RemoveSource(string accountId)
    {
        _secretStore.Delete(accountId);
        _snapshots.Delete(accountId);

        var settings = SettingsStore.Load();
        var changed = settings.TrackedAccounts.RemoveAll(a => a.AccountId == accountId) > 0;
        changed |= settings.HiddenAccountIds.Remove(accountId);
        // 「Claude 用量喚醒」是唯一會真的消耗用量額度的功能——帳號被取消追蹤後，殘留的選取跟時刻
        // 不能留著沒清，不然使用者以為「取消追蹤＝這個帳號的一切都停了」，實際上背景還在繼續真的
        // 打對話請求（cswap 本身沒有被告知要忘記這個帳號，Keychain 憑證還在，還是打得通）。跟其他
        // 設定欄位（例如 DeepSeek 的餘額閾值）不一樣，那些殘留只是安靜的死資料，這個殘留是會繼續
        // 花錢的動作，必須主動清掉，不能只靠設定頁下次存檔時才順便篩掉。
        changed |= settings.ClaudeWakeUpAccountHours.Remove(accountId);
        changed |= settings.ClaudeWakeUpLastPingDate.Remove(accountId);
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
            settings.KimiLowBalanceThresholdUsd,
            settings.UsageHistoryEnabled,
            settings.ClaudeWakeUpEnabled,
            settings.ClaudeWakeUpAccountHours);
    }

    /// <summary>設定頁儲存（PRD：即時儲存即時生效）。閾值 clamp 在 50-95（憲法 §4 三態顏色的定義範圍）。</summary>
    public UserSettings UpdateSettings(
        int? refreshIntervalMinutes,
        int attentionThresholdPercent,
        int nearLimitThresholdPercent,
        double? deepSeekAttentionBalanceThresholdUsd,
        double? deepSeekLowBalanceThresholdUsd,
        double? kimiAttentionBalanceThresholdUsd,
        double? kimiLowBalanceThresholdUsd,
        bool usageHistoryEnabled,
        bool claudeWakeUpEnabled,
        Dictionary<string, int>? claudeWakeUpAccountHours)
    {
        var settings = SettingsStore.Load();
        settings.RefreshIntervalMinutes = refreshIntervalMinutes;
        settings.NearLimitThresholdPercent = Math.Clamp(nearLimitThresholdPercent, 50, 95);
        settings.AttentionThresholdPercent = Math.Clamp(attentionThresholdPercent, 50, settings.NearLimitThresholdPercent);
        (settings.DeepSeekAttentionBalanceThresholdUsd, settings.DeepSeekLowBalanceThresholdUsd) =
            NormalizeBalanceThresholds(deepSeekAttentionBalanceThresholdUsd, deepSeekLowBalanceThresholdUsd);
        (settings.KimiAttentionBalanceThresholdUsd, settings.KimiLowBalanceThresholdUsd) =
            NormalizeBalanceThresholds(kimiAttentionBalanceThresholdUsd, kimiLowBalanceThresholdUsd);
        settings.UsageHistoryEnabled = usageHistoryEnabled;
        settings.ClaudeWakeUpEnabled = claudeWakeUpEnabled;
        // 只接受「目前真的追蹤中、而且是 cswap 多帳號路徑」的 accountId、小時 clamp 在 0-23——前端
        // 傳來的資料理論上已經是合法值，這裡再篩一次是防呆，不是信任前端沒送過怪資料。
        var trackedClaudeIds = settings.TrackedAccounts
            .Where(a => a.SourceId == "claude" && a.AccountId.StartsWith(ClaudeUsageProvider.AccountPrefix, StringComparison.Ordinal))
            .Select(a => a.AccountId)
            .ToHashSet();
        settings.ClaudeWakeUpAccountHours = (claudeWakeUpAccountHours ?? [])
            .Where(kv => trackedClaudeIds.Contains(kv.Key))
            .ToDictionary(kv => kv.Key, kv => Math.Clamp(kv.Value, 0, 23));
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
