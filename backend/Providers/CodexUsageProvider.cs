using System.Text.Json;
using UsageMonitor.Desktop.Models;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Reads Codex CLI's local usage logs via `ccusage codex daily` (constitution R1/R2 — same "shell
/// out to ccusage" decision as Claude, PRD §5/§12). Unlike Claude, ccusage has no "active billing
/// block" concept for Codex — OpenAI doesn't publish a rolling-window quota the way Anthropic's Claude
/// Max plans do — so this only ever reports today's raw token count, never a percentage.
/// </summary>
public sealed class CodexUsageProvider : IUsageProvider
{
    public string SourceId => "codex";
    public string DisplayName => "Codex";
    public string SourceType => "subscription";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        var today = DateTime.UtcNow.ToString("yyyyMMdd");
        var command = $"npx --yes ccusage@latest codex daily --json --since {today}";

        (int ExitCode, string StdOut, string StdErr) result;
        try
        {
            result = await ShellCommandRunner.RunAsync(command, TimeSpan.FromSeconds(20), ct);
        }
        catch (Exception ex) when (ex is TimeoutException or InvalidOperationException)
        {
            return NotConfigured(account, $"無法執行 ccusage：{ex.Message}");
        }

        if (result.ExitCode != 0)
            return NotConfigured(account, $"ccusage 執行失敗：{Truncate(result.StdErr)}");

        CcusageCodexDailyResponse? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<CcusageCodexDailyResponse>(result.StdOut, JsonOptions);
        }
        catch (JsonException)
        {
            return NotConfigured(account, "ccusage 回傳的內容無法解析（可能是版本輸出格式變動）");
        }

        if (parsed is null)
            return NotConfigured(account, "ccusage 沒有回傳任何資料");

        // A totals block with zero everywhere and no daily rows either means "no Codex data ever
        // found on this machine" (not configured) or "found Codex, just nothing used today" (valid).
        // ccusage doesn't distinguish these for us, so treat "ran successfully" as valid either way —
        // consistent with how ClaudeUsageProvider treats an empty active-block list.
        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: null,
            UsageState: "unknown",
            ConnectionState: "valid",
            IsEstimated: true,
            AsOf: DateTime.Now.ToString("HH:mm:ss"),
            Detail: $"今日 {parsed.Totals.TotalTokens:N0} tokens（Codex 無已知額度上限，僅顯示原始用量）",
            AccountLabel: account.Label);
    }

    private UsageSummary NotConfigured(TrackedAccount account, string detail) => new(
        Source: account.AccountId,
        DisplayName: DisplayName,
        SourceType: SourceType,
        PercentUsed: null,
        UsageState: "unknown",
        ConnectionState: "not_configured",
        IsEstimated: true,
        AsOf: DateTime.Now.ToString("HH:mm:ss"),
        Detail: detail,
        AccountLabel: account.Label);

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200] + "…";
}

internal sealed class CcusageCodexDailyResponse
{
    public CcusageCodexTotals Totals { get; set; } = new();
}

internal sealed class CcusageCodexTotals
{
    public double TotalTokens { get; set; }
}
