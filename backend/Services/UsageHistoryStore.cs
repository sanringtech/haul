using Microsoft.Data.Sqlite;
using UsageMonitor.Desktop.Models;

namespace UsageMonitor.Desktop.Services;

/// <summary>One recorded sample of a single window's usage percentage, ready for export.</summary>
public sealed record UsageHistoryPoint(
    string RecordedAtUtc,
    string AccountId,
    string DisplayName,
    string? AccountLabel,
    string? WindowLabelKey,
    double PercentUsed,
    string UsageState);

/// <summary>
/// 用量歷史記錄——設定頁「記錄用量歷史」開關開啟後才會有東西寫進來，存在
/// <see cref="AppPaths.UsageHistoryDbPath"/> 的 SQLite 檔（跟 CursorAuthReader 讀 Cursor 自己的
/// session 那份是不同檔案，這份是這個 app 自己的）。
///
/// 只記錄有百分比概念的視窗（訂閱制的 5h/7d 等）——API KEY 制的絕對餘額（DeepSeek/Kimi）沒有可
/// 比較的分母，不記錄，跟卡片列表頂端「用量健康度」那塊區域走同一個篩選邏輯（見 app.ts 的
/// usageHealth()）。
///
/// 寫入節奏完全由前端控制：開啟開關時，自動刷新固定接管成 5 分鐘一次（見 app.ts 建構子的自動
/// 刷新 effect），這裡每次收到一輪新的 GetSummariesAsync() 結果就檢查一輪——沒有獨立的背景輪詢
/// 計時器，避免多開一條打外部 API 的路徑（這些大多是非官方端點，見 AI-LANDSCAPE.md，能不多打就
/// 不多打）。實際寫不寫進資料庫另外看 Record() 的增量過濾邏輯（跟上一筆比對，沒變化就不寫）。
/// </summary>
public static class UsageHistoryStore
{
    /// <summary>「資料如果最大維持 1 個月合理嗎？」——合理，5 分鐘一筆、5 個帳號一個月也才約 6 萬列，
    /// SQLite 毫無壓力。每次寫入/查詢都順手清一次超過這個天數的舊列，跟 log rotation 同樣概念。</summary>
    private const int RetentionDays = 30;

    /// <summary>
    /// 增量過濾（delta filtering）：跟這個系列（同一個帳號＋同一個視窗）上一筆存的值一樣，就不寫——
    /// 原本每 5 分鐘不管有沒有變化都寫一筆，累積下來大部分是重複值，噪音蓋過真正有意義的變化。
    /// 「重置歸零」本身就是一種數值變化（從某個 % 掉回 0%），自然會被寫下來，不用特別處理。
    /// </summary>
    public static void Record(IEnumerable<UsageSummary> summaries)
    {
        using var connection = Open();
        var now = DateTime.UtcNow.ToString("o");

        using var transaction = connection.BeginTransaction();

        using var lastValueCommand = connection.CreateCommand();
        lastValueCommand.Transaction = transaction;
        lastValueCommand.CommandText = """
            SELECT percent_used FROM usage_history
            WHERE account_id = $accountId AND window_label_key IS $windowLabelKey
            ORDER BY recorded_at DESC LIMIT 1;
            """;
        var lvAccountId = lastValueCommand.Parameters.Add("$accountId", SqliteType.Text);
        var lvWindowLabelKey = lastValueCommand.Parameters.Add("$windowLabelKey", SqliteType.Text);

        using var insertCommand = connection.CreateCommand();
        insertCommand.Transaction = transaction;
        insertCommand.CommandText = """
            INSERT INTO usage_history (recorded_at, account_id, display_name, account_label, window_label_key, percent_used, usage_state)
            VALUES ($recordedAt, $accountId, $displayName, $accountLabel, $windowLabelKey, $percentUsed, $usageState);
            """;
        var pRecordedAt = insertCommand.Parameters.Add("$recordedAt", SqliteType.Text);
        var pAccountId = insertCommand.Parameters.Add("$accountId", SqliteType.Text);
        var pDisplayName = insertCommand.Parameters.Add("$displayName", SqliteType.Text);
        var pAccountLabel = insertCommand.Parameters.Add("$accountLabel", SqliteType.Text);
        var pWindowLabelKey = insertCommand.Parameters.Add("$windowLabelKey", SqliteType.Text);
        var pPercentUsed = insertCommand.Parameters.Add("$percentUsed", SqliteType.Real);
        var pUsageState = insertCommand.Parameters.Add("$usageState", SqliteType.Text);

        foreach (var s in summaries)
        {
            // api_key 制（DeepSeek/Kimi 絕對餘額）PercentUsed 本來就固定是 null，這裡再篩一次
            // sourceType 純粹是讓意圖更明確，不是必要的防呆。
            if (s.SourceType != "subscription") continue;

            if (s.PercentUsed is { } primary)
            {
                Bind(s, primary, s.UsageState, s.PercentUsedLabel?.Key);
            }
            if (s.SecondaryPercentUsed is { } secondary)
            {
                Bind(s, secondary, s.SecondaryUsageState ?? "unknown", s.SecondaryPercentUsedLabel?.Key);
            }
        }
        transaction.Commit();

        Prune(connection);

        void Bind(UsageSummary s, double percent, string state, string? windowKey)
        {
            lvAccountId.Value = s.Source;
            lvWindowLabelKey.Value = (object?)windowKey ?? DBNull.Value;
            var lastValue = lastValueCommand.ExecuteScalar();
            if (lastValue is double lastPercent && lastPercent == percent) return;

            pRecordedAt.Value = now;
            pAccountId.Value = s.Source;
            pDisplayName.Value = s.DisplayName;
            pAccountLabel.Value = (object?)s.AccountLabel ?? DBNull.Value;
            pWindowLabelKey.Value = (object?)windowKey ?? DBNull.Value;
            pPercentUsed.Value = percent;
            pUsageState.Value = state;
            insertCommand.ExecuteNonQuery();
        }
    }

    /// <summary>All points within the retention window, oldest first — ready to hand to the exporter.</summary>
    public static List<UsageHistoryPoint> QueryAll()
    {
        using var connection = Open();
        Prune(connection);

        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT recorded_at, account_id, display_name, account_label, window_label_key, percent_used, usage_state
            FROM usage_history
            ORDER BY recorded_at ASC;
            """;
        using var reader = command.ExecuteReader();
        var result = new List<UsageHistoryPoint>();
        while (reader.Read())
        {
            result.Add(new UsageHistoryPoint(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.GetDouble(5),
                reader.GetString(6)));
        }
        return result;
    }

    private static void Prune(SqliteConnection connection)
    {
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays).ToString("o");
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM usage_history WHERE recorded_at < $cutoff;";
        command.Parameters.AddWithValue("$cutoff", cutoff);
        command.ExecuteNonQuery();
    }

    private static SqliteConnection Open()
    {
        var connection = new SqliteConnection($"Data Source={AppPaths.UsageHistoryDbPath}");
        connection.Open();
        EnsureSchema(connection);
        return connection;
    }

    private static void EnsureSchema(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS usage_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recorded_at TEXT NOT NULL,
                account_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                account_label TEXT,
                window_label_key TEXT,
                percent_used REAL NOT NULL,
                usage_state TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_usage_history_recorded_at ON usage_history(recorded_at);
            CREATE INDEX IF NOT EXISTS idx_usage_history_series ON usage_history(account_id, window_label_key, recorded_at DESC);
            """;
        command.ExecuteNonQuery();
    }
}
