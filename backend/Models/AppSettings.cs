namespace UsageMonitor.Desktop.Models;

/// <summary>
/// Persisted locally as JSON (see <see cref="Services.AppPaths"/>). Never holds secrets —
/// API keys go through <see cref="Security.ISecretStore"/> (OS keychain), per constitution I2.
/// </summary>
public sealed class AppSettings
{
    /// <summary>Minutes between automatic refreshes. Null = manual only (constitution §9).</summary>
    public int? RefreshIntervalMinutes { get; set; } = 60;

    /// <summary>Yellow "attention" threshold. May equal NearLimit; orange wins when equal.</summary>
    public int AttentionThresholdPercent { get; set; } = 70;

    /// <summary>Orange "near limit" threshold, 50-95. Must not be lower than Attention.</summary>
    public int NearLimitThresholdPercent { get; set; } = 85;

    /// <summary>
    /// Token ceiling for the active Claude 5-hour block, used to compute PercentUsed via `ccusage --token-limit`.
    /// Anthropic doesn't publish this per plan tier, so it's left for the user to set — until then Claude's
    /// UsageState reports "unknown" instead of guessing (PRD §12 TODO).
    /// </summary>
    public int? ClaudeTokenLimit { get; set; }

    /// <summary>
    /// DeepSeek/Kimi report an absolute USD balance, not a percentage — there's no "total budget" to
    /// divide by unless the user tells us one. Null = can't compute a state, just show the raw balance.
    /// </summary>
    public double? DeepSeekLowBalanceThresholdUsd { get; set; }

    public double? DeepSeekAttentionBalanceThresholdUsd { get; set; }

    public double? KimiLowBalanceThresholdUsd { get; set; }

    public double? KimiAttentionBalanceThresholdUsd { get; set; }

    /// <summary>
    /// 「記錄用量歷史」開關（見 Services/UsageHistoryStore.cs）。開啟時前端自動刷新固定接管成 3
    /// 分鐘一次，每輪結果都會寫進本機 SQLite；關閉時完全不寫、也不影響自動刷新間隔。預設關閉——
    /// 這會讓非官方端點的請求頻率提高到每小時 20 次，不該是預設行為，得使用者自己選擇開啟。
    /// </summary>
    public bool UsageHistoryEnabled { get; set; }

    /// <summary>
    /// 「Claude 用量喚醒」開關（見 Services/ClaudeActivationPinger.cs）。Claude 的 5 小時／7 天用量
    /// 視窗是懶初始化的——沒送過訊息（或上一輪視窗到期後還沒送新訊息）就會停在「尚未開始」的狀態，
    /// 開啟這個開關後，每天第一次刷新、且本機時間已經過了 <see cref="ClaudeWakeUpAccountHours"/> 設定
    /// 的時刻，會對選中的帳號各送一則最小訊息喚醒視窗。**這是這個 app 唯一會真的消耗使用者用量額度
    /// 的功能**（其餘都是唯讀查詢），預設關閉，且要使用者自己選帳號才會生效（查證見 AI-LANDSCAPE.md
    /// 「Claude 視窗『懶初始化』行為」）。
    /// </summary>
    public bool ClaudeWakeUpEnabled { get; set; }

    /// <summary>
    /// 要喚醒哪些追蹤中的 Claude 帳號，以及各自要幾點（本機時間，0-23）才觸發——key 是
    /// TrackedAccount.AccountId（"claude:{email}" 格式），value 是小時。有在這個字典裡＝已勾選。
    /// 快照庫裡有 access token 的 Claude 帳號都能喚醒；舊版單帳號 <c>claude</c> 沒有獨立快照，不支援。
    /// </summary>
    public Dictionary<string, int> ClaudeWakeUpAccountHours { get; set; } = [];

    /// <summary>
    /// 是否已做過一次性 cswap Keychain 匯入。true 之後執行期不再 fork cswap。
    /// 沒裝 cswap、非 macOS、或匯入失敗也會標 true，避免每次啟動重試。
    /// </summary>
    public bool CswapImported { get; set; }

    /// <summary>每個帳號最後一次成功喚醒的本機日期（"yyyy-MM-dd"）——純內部記帳用，判斷「今天是否
    /// 已經打過」，不會顯示在設定頁、也不是使用者能編輯的東西，跟上面兩個欄位性質不同。</summary>
    public Dictionary<string, string> ClaudeWakeUpLastPingDate { get; set; } = [];

    /// <summary>Account ids the user has hidden (constitution §8 "關閉顯示") — data/keys stay, just not shown.</summary>
    public List<string> HiddenAccountIds { get; set; } = [];

    /// <summary>
    /// Accounts the user has explicitly added via the "＋ 新增來源" flow (憲法 R5：多帳號各自獨立).
    /// Default empty — a fresh install shows nothing until the user adds something. Subscription-type
    /// sources (Claude/Codex) can have several captured logins; api_key-type sources (DeepSeek/Kimi)
    /// likewise, each its own TrackedAccount with its own AccountId.
    /// </summary>
    public List<TrackedAccount> TrackedAccounts { get; set; } = [];
}
