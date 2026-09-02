namespace UsageMonitor.Desktop.Models;

/// <summary>
/// String constants for <see cref="LocalizedText.Key"/> — typo-proofs the C#↔TypeScript contract and
/// gives one place to see every key that must also exist (both zh-TW and en) in
/// frontend/src/app/i18n.ts's <c>Translations</c> interface. Grouped by: shared across providers,
/// then one section per provider for its own messages.
/// </summary>
public static class MessageKeys
{
    // ── 多個 provider 共用、文字完全一樣的訊息 ──────────────────────────────────
    public const string HttpError = "httpError";
    public const string ParseError = "usageEndpointParseError"; // "parseError" 已被前端 chrome 的 JSON 解析失敗訊息用掉
    public const string CallFailed = "callFailed";
    public const string WindowReset = "windowReset";
    public const string FiveHourLabel = "fiveHourLabel";
    public const string SevenDayLabel = "sevenDayLabel";
    public const string ApiKeyNotConfigured = "apiKeyNotConfigured";
    public const string RateLimited = "rateLimited";
    public const string UnexpectedError = "unexpectedError";

    // ── ClaudeUsageProvider ──────────────────────────────────────────────────
    public const string ClaudeCredentialsNotFound = "claudeCredentialsNotFound";
    public const string ClaudeCredentialsExpiredLocal = "claudeCredentialsExpiredLocal";
    public const string ClaudeCredentialsRejected = "claudeCredentialsRejected";

    // ── ClaudeUsageProvider 的 cswap 多帳號路徑（2026-08-31 新增）─────────────
    public const string CswapCallFailed = "cswapCallFailed";
    public const string CswapAccountNotFound = "cswapAccountNotFound";
    public const string CswapUsageStatusNotOk = "cswapUsageStatusNotOk";

    // ── CodexUsageProvider ───────────────────────────────────────────────────
    public const string CodexCredentialsNotFound = "codexCredentialsNotFound";
    public const string CodexCredentialsRejected = "codexCredentialsRejected";

    // ── DeepSeekUsageProvider ────────────────────────────────────────────────
    public const string DeepSeekInvalidKey = "deepSeekInvalidKey";
    public const string DeepSeekHttpError = "deepSeekHttpError";
    public const string DeepSeekParseError = "deepSeekParseError";
    public const string DeepSeekBalance = "deepSeekBalance";
    public const string DeepSeekCallFailed = "deepSeekCallFailed";

    // ── KimiUsageProvider（API key 制）───────────────────────────────────────
    public const string KimiInvalidKey = "kimiInvalidKey";
    public const string KimiHttpError = "kimiHttpError";
    public const string KimiParseError = "kimiParseError";
    public const string KimiBalance = "kimiBalance";
    public const string KimiCallFailed = "kimiCallFailed";

    // ── KimiSubscriptionUsageProvider（訂閱制）─────────────────────────────
    public const string KimiSubCredentialsNotFound = "kimiSubCredentialsNotFound";
    public const string KimiSubCredentialsRejected = "kimiSubCredentialsRejected";
    public const string KimiSubHttpErrorWithBody = "kimiSubHttpErrorWithBody";
    public const string KimiSubParseErrorUnverified = "kimiSubParseErrorUnverified";

    // ── CursorUsageProvider（2026-09-01 新增，已實測，見 AI-LANDSCAPE.md）───────
    public const string CursorCredentialsNotFound = "cursorCredentialsNotFound";
    public const string CursorCredentialsExpiredLocal = "cursorCredentialsExpiredLocal";
    public const string CursorCredentialsRejected = "cursorCredentialsRejected";
    public const string CursorModelsLabel = "cursorModelsLabel";
    public const string OtherModelsLabel = "otherModelsLabel";
    public const string CursorIncludedLabel = "cursorIncludedLabel";
    public const string CursorIncludedSpend = "cursorIncludedSpend";
}
