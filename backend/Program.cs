using System.Drawing;
using System.Text.Json;
using Photino.NET;
using UsageMonitor.Desktop;
using UsageMonitor.Desktop.Models;

// During `dotnet run --dev` (see scripts/dev.sh) point the window at the Angular
// dev server instead of the bundled wwwroot, so `ng serve`'s hot reload works.
var devServerUrl = Environment.GetEnvironmentVariable("USAGEMONITOR_DEV_SERVER_URL");
var usageService = new UsageService();

// camelCase + case-insensitive so the wire format matches what the TS side expects
// (`percentUsed`, not `PercentUsed`) without hand-writing [JsonPropertyName] everywhere.
var jsonOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true,
};

// Debug escape hatch: `dotnet run -- --print-usage` prints one refresh as JSON and exits,
// without opening the GUI window (useful for verifying providers headlessly / in CI).
if (args.Contains("--print-usage"))
{
    var summaries = await usageService.GetSummariesAsync();
    Console.WriteLine(JsonSerializer.Serialize(summaries, new JsonSerializerOptions(jsonOptions) { WriteIndented = true }));
    return;
}


var window = new PhotinoWindow()
    .SetTitle("sanring Haul")
    .SetUseOsDefaultSize(false)
    .SetSize(new Size(420, 640))
    .SetResizable(true)
    .Center()
    // 官方文件寫明 SetIconFile 只在 Windows/Linux 有效，macOS 完全不會套用（那邊的 app/dock 圖示要
    // 靠 .app bundle 的 .icns，不是這支 API 的範圍，這次沒做）。這台開發機是 macOS，沒辦法親眼驗證
    // Windows/Linux 上實際顯示效果，純粹照文件接上去。
    // 用相對路徑會直接讓整支 app 啟動時丟 ArgumentException("cannot be found")——實測過，SetIconFile
    // 的路徑驗證基準跟 Load(string) 不一樣，得用絕對路徑，以 AppContext.BaseDirectory（執行檔所在
    // 目錄）為準，不是 Environment.CurrentDirectory（使用者從哪裡打指令會不一樣）。
    .SetIconFile(Path.Combine(AppContext.BaseDirectory, "wwwroot", "browser", "logo.svg"))
    .RegisterWebMessageReceivedHandler(OnWebMessageReceived);

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
                // 通常只會有一個，但 Claude 透過 cswap 一次偵測可能加好幾個帳號（見 UsageService.
                // AddClaudeAccountsAsync），陣列可能是空的（cswap 有裝但偵測到的都已經追蹤過了）。
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

            case "get-settings":
                var currentSettings = usageService.GetSettings();
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("settings", null, null, Settings: currentSettings), jsonOptions));
                break;

            case "update-settings" when request.NearLimitThresholdPercent is not null:
                var updated = usageService.UpdateSettings(request.RefreshIntervalMinutes, request.RetentionDays, request.NearLimitThresholdPercent.Value);
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("settings", null, null, Settings: updated), jsonOptions));
                // 閾值一變，現有卡片的 usageState（正常/接近上限/已用盡）馬上就不準了——PRD 說設定要
                // 「即時儲存即時生效」，補一次完整刷新才會反映在畫面上，不是只存進設定檔就算了。
                await RespondWithSummaries();
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
    int? RetentionDays = null,
    int? NearLimitThresholdPercent = null);

file sealed record HostCredential(string? ApiKey);

file sealed record HostResponse(
    string? Type,
    UsageSummary[]? Data,
    string? Error,
    SourceCatalogEntry[]? Catalog = null,
    UserSettings? Settings = null,
    HiddenAccountEntry[]? HiddenAccounts = null);
