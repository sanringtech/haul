using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Security;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Calls Anthropic's official (but undocumented/beta) usage endpoint using Claude Code's own local
/// OAuth session — the same approach the open-source `claude-swap` tool uses, verified against it on
/// 2026-08-30. This is a deliberate, user-approved trade-off over the safer "read local logs and
/// estimate" approach (constitution R2's original framing): real 5h + 7d percentages and reset times,
/// at the cost of depending on an Anthropic-internal API that could change without notice.
/// If it ever breaks, the fallback is reverting to a ccusage-based estimate like CodexUsageProvider.
///
/// <para>
/// <b>多帳號（2026-08-31，新增）</b>：Claude 是唯一支援多個訂閱制帳號同時追蹤的來源，靠 shell out
/// 呼叫使用者選用安裝的 <c>cswap</c>（claude-swap，見 <see href="https://pypi.org/project/claude-swap/"/>）
/// 的 <c>cswap list --json</c>——已用真實輸出核對過格式，`resetsAt` 是跟 Anthropic 官方 API 一樣的
/// ISO8601，直接沿用同一套 FormatResetLocal。單一帳號的既有行為（AccountId 就是字面上的 "claude"）
/// 完全不變，只有 AccountId 帶 <see cref="CswapAccountPrefix"/> 前綴的才會走 cswap 這條路——見
/// UsageService.AddSourceAsync 怎麼決定要不要建立 cswap 帳號。
/// </para>
/// </summary>
public sealed class ClaudeUsageProvider : IUsageProvider
{
    public string SourceId => "claude";
    public string DisplayName => "Claude Code";
    public string SourceType => "subscription";

    /// <summary>cswap 帳號的 AccountId 格式是 "claude:{email}"——用 email 當識別，不是 cswap 的
    /// account number（number 只是清單裡的序號，帳號增減會變動，email 才是穩定的）。</summary>
    internal const string CswapAccountPrefix = "claude:";
    internal static string CswapAccountId(string email) => CswapAccountPrefix + email;

    private const string UsageEndpoint = "https://api.anthropic.com/api/oauth/usage";
    private const string OAuthBetaHeader = "oauth-2025-04-20"; // required by the endpoint; value confirmed from claude-swap's source
    private const string CswapListCommand = "cswap list --json";
    private static readonly TimeSpan CswapTimeout = TimeSpan.FromSeconds(10);

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <summary>
    /// 偵測本機是否裝了 cswap，有的話回傳它目前看到的「所有」帳號（不管有沒有已經被追蹤，篩選/
    /// 去重是呼叫端 <see cref="UsageService"/> 的事）。回傳 null＝沒裝 cswap，或執行失敗/逾時/JSON
    /// 解析不出來——呼叫端要當成「這台機器沒有 cswap」退回單帳號行為，不是當成錯誤攔下來。
    /// </summary>
    internal async Task<CswapAccount[]?> TryDetectCswapAccountsAsync(CancellationToken ct)
    {
        try
        {
            var (exitCode, stdout, _) = await ShellCommandRunner.RunAsync(CswapListCommand, CswapTimeout, ct);
            if (exitCode != 0) return null;
            return JsonSerializer.Deserialize<CswapListResponse>(stdout, JsonOptions)?.Accounts?.ToArray();
        }
        catch
        {
            return null;
        }
    }

    public async Task<UsageSummary> GetUsageAsync(TrackedAccount account, AppSettings settings, CancellationToken ct)
    {
        if (account.AccountId.StartsWith(CswapAccountPrefix, StringComparison.Ordinal))
            return await GetUsageViaCswapAsync(account, account.AccountId[CswapAccountPrefix.Length..], settings, ct);

        var token = ClaudeAuthReader.Read();
        if (token is null)
            return Build(account, "not_configured", L(MessageKeys.ClaudeCredentialsNotFound));

        if (ClaudeAuthReader.IsExpired(token))
            return Build(account, "expired", L(MessageKeys.ClaudeCredentialsExpiredLocal));

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, UsageEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
            request.Headers.Add("anthropic-beta", OAuthBetaHeader);
            request.Headers.UserAgent.ParseAdd("SanRingUsageMonitor/0.1 (+https://github.com/sanring)");

            using var response = await SharedHttpClient.Instance.SendAsync(request, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return Build(account, "expired", L(MessageKeys.ClaudeCredentialsRejected));

            if (response.StatusCode is System.Net.HttpStatusCode.TooManyRequests)
                return Build(account, "invalid", L(MessageKeys.RateLimited, ("provider", "Anthropic")));

            if (!response.IsSuccessStatusCode)
                return Build(account, "invalid", L(MessageKeys.HttpError, ("status", ((int)response.StatusCode).ToString())));

            var body = await response.Content.ReadAsStringAsync(ct);
            var parsed = JsonSerializer.Deserialize<AnthropicUsageResponse>(body, JsonOptions);
            if (parsed is null)
                return Build(account, "invalid", L(MessageKeys.ParseError, ("body", Truncate(body))));

            return BuildFromUsage(account, parsed, settings);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return Build(account, "invalid", L(MessageKeys.CallFailed, ("message", ex.Message)));
        }
    }

    private static LocalizedText L(string key, params (string Name, string Value)[] p) =>
        new(key, p.Length == 0 ? null : p.ToDictionary(x => x.Name, x => x.Value));

    // cswap 偶爾會對單一帳號回報暫時性的異常（例如那次剛好向 Anthropic 拿資料失敗），不代表帳號
    // 真的壞了——下一次刷新常常就自己恢復。原本任何一次失敗（cswap 本身叫不動、JSON 解析不出來、
    // 帳號從清單消失、usageStatus 不是 "ok"）都立刻顯示錯誤卡片，等於把一次性的雜訊直接攤在使用者
    // 面前，要等下一次刷新（可能一小時後）才會自動恢復。改成同一次呼叫裡先重試幾次，只有連續都
    // 失敗才真的顯示錯誤——不是加一層跨刷新週期的「沿用上次數值」快取（那要動到 UsageService 的
    // 狀態管理，範圍大很多），單純把「打一次 cswap」這個動作本身變得更耐瞬斷。
    private const int CswapRetryAttempts = 3;
    private static readonly TimeSpan CswapRetryDelay = TimeSpan.FromSeconds(2);

    private async Task<UsageSummary> GetUsageViaCswapAsync(TrackedAccount account, string email, AppSettings settings, CancellationToken ct)
    {
        UsageSummary? lastFailure = null;
        for (var attempt = 1; attempt <= CswapRetryAttempts; attempt++)
        {
            var (summary, succeeded) = await TryGetUsageViaCswapOnceAsync(account, email, settings, ct);
            if (succeeded) return summary;

            lastFailure = summary;
            if (attempt < CswapRetryAttempts)
                await Task.Delay(CswapRetryDelay, ct);
        }
        return lastFailure!;
    }

    /// <returns>(Summary, Succeeded) — Succeeded=false 時 Summary 是失敗當下要顯示的錯誤卡片，
    /// 呼叫端決定要不要重試或直接把它顯示出來（重試耗盡時）。</returns>
    private async Task<(UsageSummary Summary, bool Succeeded)> TryGetUsageViaCswapOnceAsync(TrackedAccount account, string email, AppSettings settings, CancellationToken ct)
    {
        (int ExitCode, string StdOut, string StdErr) result;
        try
        {
            result = await ShellCommandRunner.RunAsync(CswapListCommand, CswapTimeout, ct);
        }
        catch (Exception ex) when (ex is InvalidOperationException or TimeoutException)
        {
            return (Build(account, "invalid", L(MessageKeys.CswapCallFailed, ("message", ex.Message))), false);
        }

        if (result.ExitCode != 0)
        {
            var errorOutput = string.IsNullOrWhiteSpace(result.StdErr) ? result.StdOut : result.StdErr;
            return (Build(account, "invalid", L(MessageKeys.CswapCallFailed, ("message", Truncate(errorOutput)))), false);
        }

        CswapListResponse? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<CswapListResponse>(result.StdOut, JsonOptions);
        }
        catch (JsonException)
        {
            return (Build(account, "invalid", L(MessageKeys.ParseError, ("body", Truncate(result.StdOut)))), false);
        }

        // cswap 的 account number 只是清單裡的序號，帳號增減會變動——用 email 比對才穩定。
        var match = parsed?.Accounts?.FirstOrDefault(a => string.Equals(a.Email, email, StringComparison.OrdinalIgnoreCase));
        if (match is null)
            return (Build(account, "invalid", L(MessageKeys.CswapAccountNotFound, ("email", email))), false);

        if (!string.IsNullOrEmpty(match.UsageStatus) && match.UsageStatus != "ok")
            return (Build(account, "invalid", L(MessageKeys.CswapUsageStatusNotOk, ("status", match.UsageStatus))), false);

        return (BuildFromCswapUsage(account, match, settings), true);
    }

    private UsageSummary BuildFromCswapUsage(TrackedAccount account, CswapAccount cswapAccount, AppSettings settings)
    {
        var threshold = settings.NearLimitThresholdPercent;
        var now = DateTime.Now.ToString("HH:mm:ss");

        double? fiveHourPct = cswapAccount.Usage?.FiveHour?.Pct;
        double? sevenDayPct = cswapAccount.Usage?.SevenDay?.Pct;

        LocalizedText? fiveHourDetail = cswapAccount.Usage?.FiveHour?.ResetsAt is { } h5Reset ? L(MessageKeys.WindowReset, ("time", FormatResetLocal(h5Reset))) : null;
        LocalizedText? sevenDayDetail = cswapAccount.Usage?.SevenDay?.ResetsAt is { } d7Reset ? L(MessageKeys.WindowReset, ("time", FormatResetLocalWithDate(d7Reset))) : null;

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: fiveHourPct,
            UsageState: ClassifyState(fiveHourPct, threshold),
            ConnectionState: "valid",
            IsEstimated: false, // cswap 直接轉述官方 API 的數字，不是本機估算
            AsOf: now,
            Detail: fiveHourDetail,
            PercentUsedLabel: L(MessageKeys.FiveHourLabel),
            SecondaryPercentUsed: sevenDayPct,
            SecondaryUsageState: ClassifyState(sevenDayPct, threshold),
            SecondaryPercentUsedLabel: L(MessageKeys.SevenDayLabel),
            SecondaryDetail: sevenDayDetail,
            AccountLabel: account.Label);
    }

    private UsageSummary BuildFromUsage(TrackedAccount account, AnthropicUsageResponse usage, AppSettings settings)
    {
        var threshold = settings.NearLimitThresholdPercent;
        var now = DateTime.Now.ToString("HH:mm:ss");

        double? fiveHourPct = usage.FiveHour?.Utilization;
        double? sevenDayPct = usage.SevenDay?.Utilization;

        // Each window's caption stays with that window's own row in the UI — no more merging
        // "5h resets at X ・ 7d resets at Y" into one line the user has to parse apart themselves.
        LocalizedText? fiveHourDetail = usage.FiveHour?.ResetsAt is { } h5Reset ? L(MessageKeys.WindowReset, ("time", FormatResetLocal(h5Reset))) : null;
        // 7 天的視窗只顯示 HH:mm 會讓人搞不清楚是哪一天重置（跟 5 小時那個不一樣，5 小時幾乎一定
        // 當天就到期，7 天不會）——補上日期，見 FormatResetLocalWithDate。
        LocalizedText? sevenDayDetail = usage.SevenDay?.ResetsAt is { } d7Reset ? L(MessageKeys.WindowReset, ("time", FormatResetLocalWithDate(d7Reset))) : null;

        return new UsageSummary(
            Source: account.AccountId,
            DisplayName: DisplayName,
            SourceType: SourceType,
            PercentUsed: fiveHourPct,
            UsageState: ClassifyState(fiveHourPct, threshold),
            ConnectionState: "valid",
            IsEstimated: false, // official Anthropic data now, not a local estimate — constitution R3/I3 only requires the badge for estimates
            AsOf: now,
            Detail: fiveHourDetail,
            PercentUsedLabel: L(MessageKeys.FiveHourLabel),
            SecondaryPercentUsed: sevenDayPct,
            SecondaryUsageState: ClassifyState(sevenDayPct, threshold),
            SecondaryPercentUsedLabel: L(MessageKeys.SevenDayLabel),
            SecondaryDetail: sevenDayDetail,
            AccountLabel: account.Label);
    }

    private static string ClassifyState(double? percent, int threshold) => percent switch
    {
        null => "unknown",
        >= 100 => "exceeded",
        var p when p >= threshold => "near_limit",
        _ => "normal",
    };

    private static string FormatResetLocal(string isoUtc)
    {
        try
        {
            return DateTimeOffset.Parse(isoUtc).ToLocalTime().ToString("HH:mm");
        }
        catch (FormatException)
        {
            return isoUtc;
        }
    }

    private static string FormatResetLocalWithDate(string isoUtc)
    {
        try
        {
            return DateTimeOffset.Parse(isoUtc).ToLocalTime().ToString("M/d HH:mm");
        }
        catch (FormatException)
        {
            return isoUtc;
        }
    }

    private UsageSummary Build(TrackedAccount account, string connectionState, LocalizedText detail) => new(
        Source: account.AccountId,
        DisplayName: DisplayName,
        SourceType: SourceType,
        PercentUsed: null,
        UsageState: "unknown",
        ConnectionState: connectionState,
        IsEstimated: false,
        AsOf: DateTime.Now.ToString("HH:mm:ss"),
        Detail: detail,
        AccountLabel: account.Label);

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200] + "…";
}

internal sealed class AnthropicUsageResponse
{
    [JsonPropertyName("five_hour")]
    public AnthropicUsageWindow? FiveHour { get; set; }

    [JsonPropertyName("seven_day")]
    public AnthropicUsageWindow? SevenDay { get; set; }
}

internal sealed class AnthropicUsageWindow
{
    [JsonPropertyName("utilization")]
    public double Utilization { get; set; }

    [JsonPropertyName("resets_at")]
    public string? ResetsAt { get; set; }
}

// cswap 的 JSON 是 camelCase（跟上面 Anthropic 官方 API 的 snake_case 不一樣），PropertyNameCaseInsensitive
// 只忽略大小寫、不轉換命名慣例，但 camelCase↔PascalCase 剛好只差大小寫，不用另外寫 [JsonPropertyName]。
// 已用真實 `cswap list --json` 輸出核對過欄位名稱（2026-08-31）；只留這裡用得到的欄位，cswap 回傳的
// 其他欄位（countdown/clock/expectedPct/...）沒對應的 property 就自動被忽略，不會壞。
internal sealed class CswapListResponse
{
    public List<CswapAccount>? Accounts { get; set; }
}

internal sealed class CswapAccount
{
    public string Email { get; set; } = "";
    public string? OrganizationName { get; set; }
    public bool Active { get; set; }
    public string? UsageStatus { get; set; }
    public CswapUsage? Usage { get; set; }
}

internal sealed class CswapUsage
{
    public CswapWindow? FiveHour { get; set; }
    public CswapWindow? SevenDay { get; set; }
}

internal sealed class CswapWindow
{
    public double Pct { get; set; }
    public string? ResetsAt { get; set; }
}
