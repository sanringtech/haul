using System.Diagnostics;
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

var widgetWindow = new PhotinoWindow()
    .SetTitle("SanRing Widget")
    .SetChromeless(true)
    .SetTransparent(true)
    .SetTopMost(true)
    .SetResizable(false)
    .SetContextMenuEnabled(false) // 沒有 OS chrome，右鍵的預設瀏覽器選單在這裡沒意義，前端自己做退出用的 UI
    .SetUseOsDefaultLocation(false);

var window = CreateMainWindow();

// window/widgetWindow 都指派完才能註冊會互相引用彼此、也引用 OnWebMessageReceived 的 handler
// （closure 在宣告當下就用還沒宣告的變數會編譯不過，見 CS0841/CS0165——這也是為什麼 handler
// 註冊沒有直接寫進 CreateMainWindow()/上面的建構鏈裡，得拆成分開的敘述）。
window.RegisterWebMessageReceivedHandler(OnWebMessageReceived);
widgetWindow.RegisterWebMessageReceivedHandler(OnWebMessageReceived);
AttachMainWindowClosingHandler(window);

const int WidgetMargin = 16;
var widgetCollapsedSize = new Size(80, 80);
widgetWindow.SetSize(widgetCollapsedSize); // 先給個初始尺寸避免用預設大小閃一下，正確定位要等原生視窗真的建立完才查得到

// MainMonitor 要等原生視窗真的建立完成才能查（單純呼叫完 Load() 還不夠——實測 Load() 之後立刻查
// 一樣會丟 ApplicationException("hasn't been initialized yet.")），掛在 WindowCreated 事件上才是
// 保證時機正確的做法。
widgetWindow.RegisterWindowCreatedHandler((_, _) => PositionWidgetBottomRight(widgetCollapsedSize));

if (!string.IsNullOrEmpty(devServerUrl))
{
    widgetWindow.Load(new Uri(devServerUrl + "?mode=widget"));
}
else
{
    // Load(string) 是純檔案路徑解析，"?mode=widget" 會被當成檔名的一部分去找檔案（真的發生過，
    // 檔案當然不存在）。要帶 query string 得先組出 file:// Uri 再用 Load(Uri) 那個 overload。
    // 用 AppContext.BaseDirectory（執行檔所在目錄）當基準，不是 Environment.CurrentDirectory——
    // 後者是「執行這支程式當下的工作目錄」，使用者從哪裡打 ./UsageMonitor.Desktop 就會不一樣，
    // wwwroot 是相對執行檔位置放的，跟主視窗 Load(string) 內部的相對路徑解析基準要一致。
    var widgetUri = new UriBuilder(new Uri(Path.Combine(AppContext.BaseDirectory, "wwwroot/browser/index.html"))) { Query = "mode=widget" }.Uri;
    widgetWindow.Load(widgetUri);
}

// 刻意 block 在小工具視窗，不是主視窗——主視窗關閉鈕已經被攔下來變成最小化，只有小工具真的
// 「關閉」（目前唯一的路徑是前端送 quit-app，見下）才代表使用者要結束整個 app。
widgetWindow.WaitForClose();
return;

// 收合/展開都錨在螢幕右下角——展開時窗變大是往左上長，不是往右下（螢幕右下角本來就到邊界了）。
void PositionWidgetBottomRight(Size size)
{
    var workArea = widgetWindow.MainMonitor.WorkArea;
    widgetWindow
        .SetSize(size)
        .SetLocation(new Point(
            workArea.Right - size.Width - WidgetMargin,
            workArea.Bottom - size.Height - WidgetMargin));
}

// 只負責建立+載入，不在裡面註冊 handler——handler 會引用 window/widgetWindow/
// OnWebMessageReceived，在這個函式裡註冊會在呼叫端（`var window = CreateMainWindow()`）撞見
// CS0841/CS0165（對還沒指派完的變數做自我引用）。呼叫端負責另外註冊，見上面 + open-main-window
// 的 catch fallback。
PhotinoWindow CreateMainWindow()
{
    var w = new PhotinoWindow()
        .SetTitle("SanRing Usage Monitor")
        .SetUseOsDefaultSize(false)
        .SetSize(new Size(420, 640))
        .SetResizable(true)
        .Center();

    if (!string.IsNullOrEmpty(devServerUrl))
        w.Load(new Uri(devServerUrl));
    else
        w.Load("wwwroot/browser/index.html");

    return w;
}

// 攔下關閉鈕改成最小化，這樣一般情況下（handler 有正常觸發的平台）小工具點「詳細」只是取消
// 最小化，不用整個重新載入頁面、遺失畫面狀態。NetClosingDelegate 回傳 true＝取消這次關閉（跟
// WinForms FormClosing.Cancel 同精神）——但這個 handler 在 macOS arm64 上有已知 bug
// （tryphotino/photino.Native#127）可能根本不會被呼叫，這也是為什麼 open-main-window 那邊還
// 另外包了 try/catch 的 fallback，不能只依賴這裡攔截成功。
void AttachMainWindowClosingHandler(PhotinoWindow w)
{
    w.RegisterWindowClosingHandler((_, _) =>
    {
        w.SetMinimized(true);
        return true;
    });
}

// 跨 app 搶焦點——實測證實 SetMinimized(false)/SetTopMost 開關只在自己 app 內有效，使用者
// 焦點在別的 app（瀏覽器、終端機……）時完全叫不回主視窗。macOS 上唯一可靠的做法是透過
// System Events 明確要求把這個 process 設成最前景，Photino 沒有對應的跨 app activate API，
// 借 osascript（macOS 內建，不用額外裝）達成。用 unix id（本 process 的 PID）鎖定，不用
// process 名稱，避免同名 process 或名稱裡有特殊字元需要轉義的問題。只在 macOS 上跑，
// Windows/Linux 呼叫 osascript 一定失敗，直接跳過（fire-and-forget，失敗也不影響其他邏輯）。
void ActivateThisApp()
{
    if (!OperatingSystem.IsMacOS()) return;
    try
    {
        var psi = new ProcessStartInfo("osascript") { UseShellExecute = false };
        psi.ArgumentList.Add("-e");
        psi.ArgumentList.Add($"tell application \"System Events\" to set frontmost of the first process whose unix id is {Environment.ProcessId} to true");
        Process.Start(psi);
    }
    catch
    {
        // 拿不到 osascript（理論上 macOS 上一定有）就算了，不影響 SetMinimized/SetTopMost 那兩步已經做的事。
    }
}

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
                host.SendWebMessage(JsonSerializer.Serialize(new HostResponse("account-added", [added], null), jsonOptions));
                await RespondWithSummaries();
                break;

            case "remove-source" when request.Source is not null:
                usageService.RemoveSource(request.Source);
                await RespondWithSummaries();
                break;

            case "set-visibility" when request.Source is not null && request.Visible is not null:
                usageService.SetVisibility(request.Source, request.Visible.Value);
                await RespondWithSummaries();
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

            // 下面三個只有小工具視窗會送，但掛在同一個 handler 上（兩個視窗共用 OnWebMessageReceived）
            // 不需要另外分流——host 是哪個視窗由 sender 決定，SendWebMessage 自然送回對的那扇窗。
            case "widget-resize" when request.Width is not null && request.Height is not null:
                PositionWidgetBottomRight(new Size(request.Width.Value, request.Height.Value));
                break;

            case "open-main-window":
                try
                {
                    window.SetMinimized(false);
                    // 實測過：SetMinimized(false) + SetTopMost 開關只能在「自己 app 內」調整視窗
                    // 層級，沒辦法把整個 app 從別的 app 手上搶到最前面——那是跨 app 焦點，macOS
                    // 上要透過 System Events 明確要求才行，Photino 沒有對應 API。
                    window.SetTopMost(true);
                    window.SetTopMost(false);
                    ActivateThisApp();
                }
                catch
                {
                    // window 物件已經不能用了（最可能是 AttachMainWindowClosingHandler 註解提到
                    // 的 macOS arm64 已知 bug：關閉鈕的攔截根本沒觸發，主視窗被真的釋放掉）。與其
                    // 讓使用者點「詳細」完全沒反應，重開一個新的頂上去，記得重新掛 handler——新
                    // 視窗物件是全新的，不會自動帶著舊的註冊。
                    window = CreateMainWindow();
                    window.RegisterWebMessageReceivedHandler(OnWebMessageReceived);
                    AttachMainWindowClosingHandler(window);
                }
                break;

            case "quit-app":
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
    }
}

file sealed record HostRequest(
    string Type,
    string? Source = null,
    HostCredential? Credential = null,
    bool? Visible = null,
    string? Label = null,
    string[]? Order = null,
    int? Width = null,
    int? Height = null);

file sealed record HostCredential(string? ApiKey);

file sealed record HostResponse(string? Type, UsageSummary[]? Data, string? Error, SourceCatalogEntry[]? Catalog = null);
