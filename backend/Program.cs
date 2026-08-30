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
    .SetTitle("SanRing Usage Monitor")
    .SetUseOsDefaultSize(false)
    .SetSize(new Size(420, 640))
    .SetResizable(true)
    .Center()
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

            case "rename-account" when request.Source is not null:
                usageService.RenameAccount(request.Source, request.Label);
                await RespondWithSummaries();
                break;

            case "reorder-accounts" when request.Order is not null:
                usageService.ReorderAccounts(request.Order);
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
    string[]? Order = null);

file sealed record HostCredential(string? ApiKey);

file sealed record HostResponse(string? Type, UsageSummary[]? Data, string? Error, SourceCatalogEntry[]? Catalog = null);
