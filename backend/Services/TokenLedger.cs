namespace UsageMonitor.Desktop.Services;

/// <summary>One model's aggregated tokens. Cost is API-list 估算, never a bill.</summary>
public sealed record TokenRow(
    string Model,
    long InputTokens,
    long OutputTokens,
    long CacheCreation5mTokens,
    long CacheCreation1hTokens,
    long CacheReadTokens,
    double? EstimatedCostUsd);

/// <summary>按日或按 session 的一小桶——模型列形狀跟合計列相同。</summary>
public sealed record TokenSlice(
    string Key,
    string Label,
    TokenRow[] Models,
    long Entries,
    string? OldestUtc,
    string? NewestUtc);

/// <summary>
/// 本機 JSONL 加總。切過帳的 log 沒有可靠帳號欄，整桶標 <c>local-combined</c>。
/// <see cref="Entries"/> 對 Claude 是 assistant 列數，對 Codex 是納入的 session 檔數。
/// Days／Sessions 是同一輪掃描的切面，不是再掃一次。
/// </summary>
public sealed record TokenLedger(
    string Source,
    string Bucket,
    TokenRow[] Models,
    long Entries,
    string? OldestUtc,
    string? NewestUtc,
    TokenSlice[] Days,
    TokenSlice[] Sessions);

internal static class TokenSliceUi
{
    public static bool IsClaudeSubagent(string file) =>
        Path.GetFileNameWithoutExtension(file).StartsWith("agent-", StringComparison.OrdinalIgnoreCase);

    public static string SessionLabel(string file, DateTime? oldest, DateTime? newest)
    {
        var project = ClaudeProjectLabel(file);
        var when = DateRangeLabel(oldest, newest);
        if (string.IsNullOrEmpty(project)) return when;
        if (string.IsNullOrEmpty(when)) return project;
        return $"{project} · {when}";
    }

    public static string DateRangeLabel(DateTime? oldest, DateTime? newest)
    {
        if (oldest is null && newest is null) return "";
        var start = (oldest ?? newest)!.Value.ToLocalTime();
        var end = (newest ?? oldest)!.Value.ToLocalTime();
        if (start.Date == end.Date)
        {
            if ((end - start).TotalMinutes < 1) return $"{end:yyyy-MM-dd HH:mm}";
            return $"{end:yyyy-MM-dd} {start:HH:mm}–{end:HH:mm}";
        }
        return $"{start:yyyy-MM-dd}–{end:yyyy-MM-dd}";
    }

    // ponytail: Claude 資料夾是把 cwd 的 / 換成 -。有 Project- 就取後面當專案名，沒有就用資料夾名。
    private static string ClaudeProjectLabel(string file)
    {
        var dir = Path.GetFileName(Path.GetDirectoryName(file) ?? "");
        if (string.IsNullOrEmpty(dir) || dir.Equals("sessions", StringComparison.OrdinalIgnoreCase))
            return "";
        const string marker = "-Project-";
        var i = dir.LastIndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (i >= 0) return dir[(i + marker.Length)..];
        return dir.TrimStart('-');
    }
}
