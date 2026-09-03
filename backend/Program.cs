using System.Drawing;
using System.Text.Json;
using Photino.NET;
using UsageMonitor.Desktop;
using UsageMonitor.Desktop.Models;
using UsageMonitor.Desktop.Services;

// During `dotnet run --dev` (see scripts/dev.sh) point the window at the Angular
// dev server instead of the bundled wwwroot, so `ng serve`'s hot reload works.
var devServerUrl = Environment.GetEnvironmentVariable("USAGEMONITOR_DEV_SERVER_URL");
var usageService = new UsageService();
await usageService.ImportCswapIfNeededAsync();

// camelCase + case-insensitive so the wire format matches what the TS side expects
// (`percentUsed`, not `PercentUsed`) without hand-writing [JsonPropertyName] everywhere.
var jsonOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true,
};

var quitRequested = 0;

// Debug escape hatch: `dotnet run -- --print-usage` prints one refresh as JSON and exits,
// without opening the GUI window (useful for verifying providers headlessly / in CI).
if (args.Contains("--print-usage"))
{
    var summaries = await usageService.GetSummariesAsync();
    Console.WriteLine(JsonSerializer.Serialize(summaries, new JsonSerializerOptions(jsonOptions) { WriteIndented = true }));
    return;
}

if (args.Contains("--print-claude-ledger"))
{
    var ledger = ClaudeJsonlLedger.Scan();
    Console.WriteLine(JsonSerializer.Serialize(ledger, new JsonSerializerOptions(jsonOptions) { WriteIndented = true }));
    return;
}

if (args.Contains("--probe-kimi-sub"))
{
    var kimi = new UsageMonitor.Desktop.Providers.KimiSubscriptionUsageProvider();
    var probe = await kimi.GetUsageAsync(
        new TrackedAccount("kimi-subscription", "kimi-subscription", Label: null),
        SettingsStore.Load(),
        CancellationToken.None);
    Console.WriteLine(JsonSerializer.Serialize(probe, new JsonSerializerOptions(jsonOptions) { WriteIndented = true }));
    return;
}


var window = new PhotinoWindow()
    .SetTitle("sanring Haul")
    .SetUseOsDefaultSize(false)
    .SetSize(new Size(500, 700))
    .SetResizable(true)
    .Center()
    // 官方文件寫明 SetIconFile 只在 Windows/Linux 有效，macOS 完全不會套用（那邊的 app/dock 圖示要
    // 靠 .app bundle 的 .icns，不是這支 API 的範圍，這次沒做）。這台開發機是 macOS，沒辦法親眼驗證
    // Windows/Linux 上實際顯示效果，純粹照文件接上去。
    // 用相對路徑會直接讓整支 app 啟動時丟 ArgumentException("cannot be found")——實測過，SetIconFile
    // 的路徑驗證基準跟 Load(string) 不一樣，得用絕對路徑，以 AppContext.BaseDirectory（執行檔所在
    // 目錄）為準，不是 Environment.CurrentDirectory（使用者從哪裡打指令會不一樣）。
    .SetIconFile(Path.Combine(AppContext.BaseDirectory, "wwwroot", "browser", "logo.svg"))
    .RegisterWebMessageReceivedHandler(OnWebMessageReceived)
    // 關窗改成隱藏：Photino 的 WaitForClose 關了就結束 process。回 true 取消關閉，改最小化。
    // macOS 最小化進 Dock（點 Dock 圖示可還原）——Photino 沒有 NSStatusItem API，不另寫 Swift。
    // Windows NotifyIcon 要自己接 WndProc，這台開發機沒有 Windows 真機，先最小化到工作列；tray 等 P2。
    .RegisterWindowClosingHandler((sender, _) =>
    {
        if (Volatile.Read(ref quitRequested) != 0) return false;
        ((PhotinoWindow)sender!).Minimized = true;
        return true;
    });

if (!string.IsNullOrEmpty(devServerUrl))
{
    window.Load(new Uri(devServerUrl));
}
else
{
    window.Load("wwwroot/browser/index.html");
}

window.WaitForClose();
return;

// `async void`, not `async Task`: Photino's handler delegate is a plain EventHandler<string>.
// A ccusage-backed refresh can take a couple of seconds (npx cold start), so this must not
// block the caller — but every path below must catch its own errors since nothing awaits this.
async void OnWebMessageReceived(object? sender, string message)
{
    var host = (PhotinoWindow)sender!;
    try
    {
        var request = JsonSerializer.Deserialize<HostRequest>(message, jsonOptions);

        // add/remove/visibility all end the same way: mutate, then reply with a fresh full list —
        // one response shape for the frontend to handle, no delta-merging logic needed client-side.
        switch (request?.Type)
        {
            case "get-usage-summary":
                await RespondWithSummaries();
                break;

            case "get-catalog":
                var catalog = usageService.GetCatalog();
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("catalog", null, null, catalog), jsonOptions));
                break;

            case "add-source" when request.Source is not null:
                // Sent as its own message (not just folded into the full-list refresh below) because
                // the new account's id is generated server-side (api_key sources get a fresh GUID) —
                // the frontend has no way to pick "the one it just added" back out of a plain list.
                var added = await usageService.AddSourceAsync(request.Source, request.Credential?.ApiKey);
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("account-added", added, null), jsonOptions));
                await RespondWithSummaries();
                break;

            case "remove-source" when request.Source is not null:
                usageService.RemoveSource(request.Source);
                await RespondWithSummaries();
                break;

            case "set-visibility" when request.Source is not null && request.Visible is not null:
                usageService.SetVisibility(request.Source, request.Visible.Value);
                if (request.Visible.Value)
                {
                    // 重新顯示：這張卡片被隱藏期間從沒抓過資料，前端沒有任何快取可用，等同新增後
                    // 第一次要資料——直接整批刷新最簡單可靠，這不是高頻動作，成本可以接受。
                    await RespondWithSummaries();
                }
                else
                {
                    // 關閉顯示：純本地設定異動，不用為了「拿掉一張卡片」重打任何 provider 的即時
                    // API（跟 rename-account/reorder-accounts 同一個理由，見那兩個 case 的註解）。
                    host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("ack", null, null), jsonOptions));
                }
                // 不管顯示或隱藏，設定頁如果開著都要跟著更新「已隱藏的來源」清單。
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("hidden-accounts", null, null, HiddenAccounts: usageService.GetHiddenAccounts()), jsonOptions));
                break;

            // 排序/改名是純本地資料異動，不該像 add/remove/visibility 一樣觸發 RespondWithSummaries()
            // 那個完整刷新——那會真的重打一輪所有 provider 的即時 API（跟按「重新整理用量」同一支），
            // 拖一下清單就多打好幾次外部 API 沒有必要，還可能撞到限流。前端已經樂觀更新過畫面了，
            // 這裡只需要把異動存到本機設定檔，回一個空 ack 讓前端把 loading 狀態關掉就好。
            case "rename-account" when request.Source is not null:
                usageService.RenameAccount(request.Source, request.Label);
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("ack", null, null), jsonOptions));
                break;

            case "reorder-accounts" when request.Order is not null:
                usageService.ReorderAccounts(request.Order);
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("ack", null, null), jsonOptions));
                break;

            case "get-hidden-accounts":
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("hidden-accounts", null, null, HiddenAccounts: usageService.GetHiddenAccounts()), jsonOptions));
                break;

            // 帳簿頁用——％歷史點＋ Claude JSONL 分模型加總。圖表跟匯出走同一份 usage_history。
            case "get-usage-history":
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse(
                    "usage-history",
                    null,
                    null,
                    UsageHistory: [.. UsageHistoryStore.QueryAll()],
                    ClaudeTokenLedger: ClaudeJsonlLedger.Scan()), jsonOptions));
                break;

            case "get-settings":
                var currentSettings = usageService.GetSettings();
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("settings", null, null, Settings: currentSettings), jsonOptions));
                break;

            case "update-settings" when request.NearLimitThresholdPercent is not null:
                var updated = usageService.UpdateSettings(
                    request.RefreshIntervalMinutes,
                    request.AttentionThresholdPercent ?? 70,
                    request.NearLimitThresholdPercent.Value,
                    request.DeepSeekAttentionBalanceThresholdUsd,
                    request.DeepSeekLowBalanceThresholdUsd,
                    request.KimiAttentionBalanceThresholdUsd,
                    request.KimiLowBalanceThresholdUsd,
                    request.UsageHistoryEnabled ?? false,
                    request.ClaudeWakeUpEnabled ?? false,
                    request.ClaudeWakeUpAccountHours);
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("settings", null, null, Settings: updated), jsonOptions));
                // 閾值一變，現有卡片的 usageState（正常/接近上限/已用盡）馬上就不準了——PRD 說設定要
                // 「即時儲存即時生效」，補一次完整刷新才會反映在畫面上，不是只存進設定檔就算了。
                await RespondWithSummaries();
                break;

            // 匯出用量歷史（設定頁「記錄用量歷史」開關）。lang 決定匯出檔案內表頭字串的語言——這是
            // 後端少數自己組顯示文字的地方，見 UsageHistoryExporter 開頭註解為什麼這裡是例外。
            case "export-usage-history" when request.ExportFormat is "md" or "xlsx":
                await ExportUsageHistoryAsync(request.ExportFormat, request.Lang == "en" ? "en" : "zh-TW");
                break;

            case "quit":
            case "quit-app":
                Volatile.Write(ref quitRequested, 1);
                Environment.Exit(0);
                break;

            default:
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse(null, null, $"未知或缺少必要欄位的訊息: {message}"), jsonOptions));
                break;
        }
    }
    catch (Exception ex)
    {
        host.SendWebMessage(JsonSerializer.Serialize(new HostResponse(null, null, $"處理訊息時發生錯誤: {ex.Message}"), jsonOptions));
    }

    async Task RespondWithSummaries()
    {
        var summaries = await usageService.GetSummariesAsync();
        host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("usage-summary", summaries, null), jsonOptions));

        // 「記錄用量歷史」開關開著才寫——見 UsageHistoryStore 開頭註解：沒有獨立的背景輪詢，完全
        // 搭這裡每次刷新的便車，前端在開關開啟時會把自動刷新固定接管成 5 分鐘一次（app.ts）。
        if (usageService.GetSettings().UsageHistoryEnabled)
        {
            UsageHistoryStore.Record(summaries);
        }

        // 「Claude 用量喚醒」同樣搭這裡的便車，不是獨立排程——內部自己判斷今天是否已經打過，
        // 沒到期就是幾乎零成本的一次字典查詢，不會拖慢一般的刷新速度。
        await usageService.PingWakeUpsAsync();
    }

    async Task ExportUsageHistoryAsync(string format, string lang)
    {
        var points = UsageHistoryStore.QueryAll();
        if (points.Count == 0)
        {
            host.SendWebMessage(JsonSerializer.Serialize(new HostResponse(null, null, lang == "en" ? "No usage history recorded yet." : "目前還沒有任何用量歷史記錄。"), jsonOptions));
            return;
        }

        var zhTw = lang != "en";
        var suggestedName = $"haul_{DateTime.Now:yyyyMMddHHmmss}.{format}";
        // Downloads 沒有對應的 Environment.SpecialFolder 列舉值（這是 .NET 這個 API 本身的缺口，
        // 不是這裡漏寫）——但 Downloads 資料夾在 macOS/Windows/Linux 三邊都是同樣掛在使用者家目錄
        // 下面這個慣例，直接拼路徑就好，不用像 AppPaths.cs 的 DataDirectory 那樣三個平台各自分支。
        var downloadsDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");

        // ShowSaveFileAsync 是 Photino.NET 內建的原生「另存新檔」視窗，不用額外的檔案對話框套件。
        // 使用者按取消時回傳 null——不算錯誤，但前端有一個「匯出中」的按鈕狀態在等回應，還是要回
        // 一則專屬訊息讓它能收尾，不然那顆按鈕會卡在 pending 狀態。
        var chosenPath = await host.ShowSaveFileAsync(
            title: zhTw ? "匯出用量歷史" : "Export usage history",
            defaultPath: Path.Combine(downloadsDir, suggestedName),
            filters: format == "xlsx"
                ? [(zhTw ? "Excel 檔案" : "Excel workbook", new[] { "xlsx" })]
                : [(zhTw ? "Markdown 檔案" : "Markdown file", new[] { "md" })]);
        if (string.IsNullOrEmpty(chosenPath))
        {
            host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("usage-history-export-cancelled", null, null), jsonOptions));
            return;
        }

        // Photino.Native 在 macOS 上這顆存檔視窗只呼叫了 setDirectoryURL:，從沒呼叫過
        // setNameFieldStringValue:（反組譯過原生 dylib 確認的，不是猜的）——defaultPath 裡的檔名
        // 那段天生不會被套用，視窗一開只會顯示系統原生的預設字「Untitled」，不是這裡的邏輯漏寫。
        // 這是 Photino 本身的限制，沒有原始碼可以修，只能退而求其次：使用者如果沒有動過那個欄位
        // （回傳的檔名還是原封不動的 "Untitled"），這裡自己把檔名換成 suggestedName；如果使用者
        // 自己有打別的名字，尊重他打的，不要覆蓋掉。
        var chosenDir = Path.GetDirectoryName(chosenPath) ?? downloadsDir;
        var chosenStem = Path.GetFileNameWithoutExtension(chosenPath);
        if (chosenStem.Equals("Untitled", StringComparison.OrdinalIgnoreCase))
        {
            chosenPath = Path.Combine(chosenDir, suggestedName);
        }

        if (format == "xlsx")
        {
            await File.WriteAllBytesAsync(chosenPath, UsageHistoryExporter.BuildXlsx(points, zhTw));
        }
        else
        {
            await File.WriteAllTextAsync(chosenPath, UsageHistoryExporter.BuildMarkdown(points, zhTw));
        }

        host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("usage-history-exported", null, null), jsonOptions));
    }
}

file sealed record HostRequest(
    string Type,
    string? Source = null,
    HostCredential? Credential = null,
    bool? Visible = null,
    string? Label = null,
    string[]? Order = null,
    int? RefreshIntervalMinutes = null,
    int? AttentionThresholdPercent = null,
    int? NearLimitThresholdPercent = null,
    double? DeepSeekAttentionBalanceThresholdUsd = null,
    double? DeepSeekLowBalanceThresholdUsd = null,
    double? KimiAttentionBalanceThresholdUsd = null,
    double? KimiLowBalanceThresholdUsd = null,
    bool? UsageHistoryEnabled = null,
    bool? ClaudeWakeUpEnabled = null,
    Dictionary<string, int>? ClaudeWakeUpAccountHours = null,
    // export-usage-history 專用："md" | "xlsx"，lang 決定匯出檔案表頭文字語言（前端目前選的 UI 語言）。
    string? ExportFormat = null,
    string? Lang = null);

file sealed record HostCredential(string? ApiKey);

file sealed record HostResponse(
    string? Type,
    UsageSummary[]? Data,
    string? Error,
    SourceCatalogEntry[]? Catalog = null,
    UserSettings? Settings = null,
    HiddenAccountEntry[]? HiddenAccounts = null,
    UsageHistoryPoint[]? UsageHistory = null,
    ClaudeTokenLedger? ClaudeTokenLedger = null);
