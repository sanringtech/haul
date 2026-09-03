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

/// <summary>
/// 本機 JSONL 加總。切過帳的 log 沒有可靠帳號欄，整桶標 <c>local-combined</c>。
/// <see cref="Entries"/> 對 Claude 是 assistant 列數，對 Codex 是納入的 session 檔數。
/// </summary>
public sealed record TokenLedger(
    string Source,
    string Bucket,
    TokenRow[] Models,
    long Entries,
    string? OldestUtc,
    string? NewestUtc);
