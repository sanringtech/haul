# 架構

## 前後端溝通

Photino 會在 window 物件注入 `window.external`（訊息 schema 見 PRD §7）：

- 前端呼叫 `window.external.sendMessage(json)` 送訊息給 C#
- C# 用 `RegisterWebMessageReceivedHandler` 收訊息、`SendWebMessage(json)` 回傳（camelCase JSON，見 `Program.cs` 的 `jsonOptions`）
- 目前已接好：前端按「重新整理用量」→ 送 `{"type":"get-usage-summary"}` → `backend/UsageService.cs` 依序呼叫各 `IUsageProvider`

## 目錄結構

```
backend/
├── Program.cs              視窗設定 + JS↔C# 訊息橋接（camelCase JSON）
├── UsageService.cs         orchestrator：跑所有 IUsageProvider，單一 provider 出錯不拖垮整批
├── Models/
│   ├── UsageSummary.cs     前端 wire format
│   └── AppSettings.cs      刷新頻率 / 保留期 / 閾值（本機 JSON 檔，不放密鑰）
├── Providers/
│   ├── IUsageProvider.cs
│   ├── ClaudeUsageProvider.cs   打 Anthropic 官方（非公開 beta）用量端點（見下），不再靠 ccusage 估算
│   ├── CodexUsageProvider.cs    打 ChatGPT 後端的（非公開）用量端點（見下），不再靠 ccusage 估算
│   ├── DeepSeekUsageProvider.cs / KimiUsageProvider.cs   打官方 balance API，key 從 Keychain 讀（API key 制）
│   ├── KimiSubscriptionUsageProvider.cs   打 Kimi Code CLI 的用量端點（見下，⚠️ 未實測）（訂閱制，SourceId="kimi-subscription"，跟上面的 "kimi" 是同一個 AI 類型的不同存取類型）
│   ├── CcusageDtos.cs
│   └── ShellCommandRunner.cs    透過使用者登入 shell 執行指令，繞開 GUI app 沒有 PATH 的問題
└── Security/
    ├── ISecretStore.cs / MacKeychainSecretStore.cs / WindowsSecretStore.cs / SecretStoreFactory.cs
    │     使用者提供的 API key 存這裡（DeepSeek/Kimi），2026-08-31 起 key 是 accountId 不是 sourceId（多帳號支援）
    ├── ClaudeAuthReader.cs / CodexAuthReader.cs / KimiCliAuthReader.cs
    │     唯讀讀取各 CLI 自己的本機 session（見下），不寫入不刷新
```

macOS 打包（`.app` bundle）另見 `backend/packaging/macos/`（`Info.plist` + `AppIcon.icns`，`scripts/make-icns.sh` 從 `frontend/public/logo.svg` 重新產生圖示）。Windows 發佈版另外有 `AppContent.cs` + `UiFileServer.cs`：前者負責找出或解出內建的 `wwwroot`，後者用 loopback HTTP 提供給 WebView2，避免正式 build 還走 `file://`。

## 除錯

`dotnet run --project backend -- --print-usage` 印一次 JSON 結果就結束，不開 GUI 視窗，方便驗證 provider 邏輯。

## 各 AI 用量怎麼來的

**Claude（重要，M2 二次修訂過）**：一開始（M1）是 shell out 呼叫 [`ccusage`](https://github.com/ryoppippi/ccusage) 估算，但拿不到真正的百分比。後來實測比對開源工具 [`claude-swap`](https://pypi.org/project/claude-swap/)（`cswap`）發現它是直接打 Anthropic 官方（但非公開/beta）的 `GET /api/oauth/usage`，用 Claude Code 自己在本機的 OAuth session（macOS 讀 Keychain「Claude Code-credentials」，其他平台讀 `~/.claude/.credentials.json`）+ `anthropic-beta: oauth-2025-04-20` header，可以拿到真正的官方 5h/7d 百分比與重置時間。**已比對過 `cswap list` 的數字一致**，改採這個做法。風險：這是非公開端點，Anthropic 可能無預告改版；`ClaudeAuthReader.cs` 純讀取、不碰 Claude Code 的 session（不寫入、不主動 refresh）。

Claude 多帳號靠偵測本機是否裝了選用的 `cswap`——有裝就 shell out 呼叫 `cswap list --json`，把回報的每個帳號各自變成一個 `TrackedAccount`（`AccountId` 用 email 識別，不用 cswap 的 account number，那只是清單序號，帳號增減會變動）；沒裝就退回原本的單帳號行為。`ShellCommandRunner` 用 `-ilc`（login + interactive）呼叫外部指令，不是只有 `-lc`——`~/.local/bin` 這類 pipx/uv tool 常見的安裝路徑很多人是加在 `~/.zshrc`，zsh 只有互動式 shell 才會載入它，單純 login 不夠（2026-08-31 實測抓到：cswap 明明裝了，偵測卻靜默失敗退回單帳號模式，因為 Finder 啟動的 app 給的是最小 PATH，`-lc` 找不到 `~/.local/bin` 底下的 `cswap`）。

**Codex（2026-08-31 同樣升級過）**：一開始也是 `ccusage codex` 估算 token 數，沒有百分比。後來從 [`openai/codex` 官方 repo 的一則 bug report](https://github.com/openai/codex/issues/10869) 發現 Codex CLI 自己會定期打一支非公開端點 `GET https://chatgpt.com/backend-api/wham/usage`，帶本機 `~/.codex/auth.json` 裡的 ChatGPT 登入憑證（`Authorization: Bearer` + `chatgpt-account-id` header）。**已實測打通並跟 ChatGPT 設定裡的「使用情況」頁面數字比對一致**（5 小時窗 + 每週窗，兩者結構跟 Claude 幾乎一樣）。`CodexAuthReader.cs` 一樣是純讀取、不碰 Codex CLI 的 session。風險跟 Claude 那支一樣：非公開端點，OpenAI 可能無預告改版；壞掉的話 fallback 是退回 ccusage 估算。

其他 provider 的風險/未實測狀態見 [`RISKS.md`](RISKS.md)。

## 修過的關鍵 bug

- **`AppPaths.cs` 路徑 bug（2026-08-31）**：原本用 `Environment.SpecialFolder.Personal` 想拿使用者根目錄，但 **.NET 在 macOS 上這個值實際指向 `~/Documents`，不是 `~`**——本機資料檔一度被存到 `~/Documents/Library/Application Support/...` 這種錯誤的巢狀路徑。已改用 `.UserProfile`（本來 `ClaudeAuthReader` 等三個 auth reader 就用對了，只有這一處寫錯）。**代價**：修這個 bug 換了資料夾，舊路徑下的設定不會自動搬過來。
- **Angular `<base href="/">` 在 `file://` 下整頁空白**：`scripts/build.sh` 已加 `--base-href ./`。
- **Windows 發佈版標題列出來了、內容卻是黑畫面（2026-09-03）**：根因有兩個，而且要一起修。第一，Top-level `await` 會生成 MTA 的 `Main()`，Windows 上 WebView2/Photino 需要 `[STAThread]` 才能正常初始化；第二，Angular 22 產物是 `type="module"`，WebView2 用 `file://` 開 `wwwroot/browser/index.html` 會因 `origin: null` 的 CORS 規則把所有 module script 擋掉，畫面只剩空的 `<app-root>`。修法：`Program.cs` 改成明確的 `[STAThread] Main`，正式 build 不再 `Load("wwwroot/...")`，而是啟動內建 `UiFileServer` 用 `http://127.0.0.1/...` 載入 UI。
- **Windows 下載後還是 zip（2026-09-03）**：原本雖然開了 `PublishSingleFile`，但 `wwwroot/` 還是得跟在 exe 旁邊，否則 UI 載不到；實際上那不是真正可以直接發出去的「單檔 app」。修法是把 `wwwroot/**` 同時標成 publish content + embedded resource，正式啟動時若磁碟上找不到，就從組件資源自行解到 temp，再由 `UiFileServer` 提供。這樣 publish 目錄就只剩 `SanringHaul.exe`（加符號檔 `.pdb`），下載頁才有資格改掛 `.exe` 而不是 `.zip`。
- **DeepSeek/Kimi 的 JSON 是 snake_case**：`PropertyNameCaseInsensitive` 不會處理底線，導致「無法解析」，已加 `[JsonPropertyName]`。
- **cswap 偵測失敗靜默退回單帳號模式**：見上「Claude 多帳號」一節的 `-ilc` 修法。
