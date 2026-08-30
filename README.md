# SanRing Usage Monitor

跨平台（Windows + macOS）桌面小工具：監控 Claude / Codex / DeepSeek / Kimi / Grok 底下每一個帳號的用量。

- **前端**：Angular (`frontend/`) — UI，透過 `window.external` 跟後端溝通；元件用 [`@sanring/ui`](https://ui.sanring.dev/)（`frontend/src/app/components/ui/`，`npx @sanring/cli add <component>` 增加新元件）+ Tailwind CSS v4
- **後端**：C# + [Photino.NET](https://www.tryphotino.io/)（原生 WebView 殼）(`backend/`) — 讀取本機用量資料
- **業務規則 SSOT**：[`.claude/constitutions/usage-monitor.md`](.claude/constitutions/usage-monitor.md)
- **實作意圖 / 技術選型**：[`.claude/prds/usage-monitor.md`](.claude/prds/usage-monitor.md)

## ⚠️ 已知風險與揭露（發布給其他人用之前請先讀）

本工具的部分功能依賴**非官方、非文件化的介面**，不是 Claude/DeepSeek/Kimi 官方保證會一直支援的公開合約：

- **Claude 用量（`ClaudeUsageProvider`）**：直接呼叫 Anthropic 內部/beta 用量端點 `GET /api/oauth/usage`（帶 `anthropic-beta` header），用的是 Claude Code 自己在本機的 OAuth session。這不是文件化的公開 API，Anthropic 可能無預告改版或停用。
- **Codex 用量（`CodexUsageProvider`）**：同樣直接呼叫 OpenAI/ChatGPT 內部端點 `GET https://chatgpt.com/backend-api/wham/usage`，用的是 Codex CLI 自己在本機的 ChatGPT 登入 session。一樣不是文件化的公開 API，OpenAI 可能無預告改版或停用。
- **Kimi 訂閱制（`KimiSubscriptionUsageProvider`，2026-08-31 新增，⚠️ 未實測）**：同一類做法，打 `GET https://api.kimi.com/coding/v1/usages`，用 Kimi Code CLI 本機的 OAuth session。這次是從**開源的 `MoonshotAI/kimi-code` repo 原始碼**直接讀出來的，不是猜的，但專案裡沒有人有真實 Kimi Code 帳號可以實測——第一次真的有人用時才會知道對不對，失敗時會把原始回應內容顯示出來方便除錯。
- **Claude/Codex 官方「API key 制」用量查詢已查證不可行**（2026-08-31）：兩家的官方 Admin 用量/成本 API 都排除個人帳號、workspace/一般 key 打不進去；「查詢剩餘額度」這個功能本身 Anthropic 目前甚至都還沒實作（見 [`anthropics/claude-code` issue #47574](https://github.com/anthropics/claude-code/issues/47574)）。詳見 PRD §5/§9/§12。
- **Claude 多帳號（規劃中）**：依賴選用的外部工具 [`claude-swap`](https://pypi.org/project/claude-swap/)（`cswap`）——沒裝 `cswap` 只能看到「目前登入中」的那一個 Claude 帳號。
- **ccusage / cswap 都是 MIT 授權的開源工具**，本工具只是在執行期呼叫使用者自行安裝的獨立程式（不是把它們的原始碼包進本工具），授權合規負擔低；但呼叫 Anthropic 非公開端點的 ToS 風險，不會因為透過 `cswap` 或直接呼叫而有差別——兩者本質上打的是同一支端點。
- 這些都是**已知、已評估過的取捨**（本機不儲存資料、不繞過任何付費牆、只讀取使用者自己有權查看的自身帳號用量），但仍建議：**若要發布給其他開發者使用，先明確告知他們這個依賴，不要包裝成「官方支援」**；若考慮更大規模發布/商業化，建議找律師檢視 Anthropic 的 API 使用條款。本專案作者不對此提供法律保證。

## 開發

```bash
./scripts/dev.sh
```

會同時啟動 Angular dev server（`http://localhost:4200`，含 hot reload）跟 Photino 視窗，視窗會載入 dev server 的網址。

## 打包

```bash
./scripts/build.sh              # 目前平台的 framework-dependent build
./scripts/build.sh osx-arm64    # 指定 RID 產出 self-contained build
./scripts/build.sh win-x64
```

流程：`ng build` → 把 `frontend/dist/frontend/browser` 複製進 `backend/wwwroot/browser` → `dotnet publish`。

## 前後端溝通

Photino 會在 window 物件注入 `window.external`（訊息 schema 見 PRD §7）：

- 前端呼叫 `window.external.sendMessage(json)` 送訊息給 C#
- C# 用 `RegisterWebMessageReceivedHandler` 收訊息、`SendWebMessage(json)` 回傳（camelCase JSON，見 `Program.cs` 的 `jsonOptions`）
- 目前已接好：前端按「重新整理用量」→ 送 `{"type":"get-usage-summary"}` → `backend/UsageService.cs` 依序呼叫各 `IUsageProvider`

## 架構（M1 完成後）

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

**⚠️ 已修過的路徑 bug（2026-08-31）**：`Services/AppPaths.cs` 原本用 `Environment.SpecialFolder.Personal` 想拿使用者根目錄，但 **.NET 在 macOS 上這個值實際指向 `~/Documents`，不是 `~`**——本機資料檔一度被存到 `~/Documents/Library/Application Support/...` 這種錯誤的巢狀路徑。已改用 `.UserProfile`（本來 `ClaudeAuthReader` 等三個 auth reader 就用對了，只有這一處寫錯）。**代價**：修這個 bug 換了資料夾，舊路徑下的設定（含手動測試新增過的帳號）不會自動搬過來。

**除錯用旗標**：`dotnet run --project backend -- --print-usage` 印一次 JSON 結果就結束，不開 GUI 視窗，方便驗證 provider 邏輯。

**Claude 用量怎麼來的（重要，M2 二次修訂過）**：一開始（M1）是 shell out 呼叫 [`ccusage`](https://github.com/ryoppippi/ccusage) 估算，但拿不到真正的百分比。後來實測比對開源工具 [`claude-swap`](https://pypi.org/project/claude-swap/)（`cswap`）發現它是直接打 Anthropic 官方（但非公開/beta）的 `GET /api/oauth/usage`，用 Claude Code 自己在本機的 OAuth session（macOS 讀 Keychain「Claude Code-credentials」，其他平台讀 `~/.claude/.credentials.json`）+ `anthropic-beta: oauth-2025-04-20` header，可以拿到真正的官方 5h/7d 百分比與重置時間。**已比對過 `cswap list` 的數字一致**，改採這個做法（使用者已知情並拍板）。風險：這是非公開端點，Anthropic 可能無預告改版；`ClaudeAuthReader.cs` 純讀取、不碰 Claude Code 的 session（不寫入、不主動 refresh）。

**Codex 用量（2026-08-31 同樣升級過）**：一開始也是 `ccusage codex` 估算 token 數，沒有百分比。後來從 [`openai/codex` 官方 repo 的一則 bug report](https://github.com/openai/codex/issues/10869) 發現 Codex CLI 自己會定期打一支非公開端點 `GET https://chatgpt.com/backend-api/wham/usage`，帶本機 `~/.codex/auth.json` 裡的 ChatGPT 登入憑證（`Authorization: Bearer` + `chatgpt-account-id` header）。**已實測打通並跟 ChatGPT 設定裡的「使用情況」頁面數字比對一致**（5 小時窗 + 每週窗，兩者結構跟 Claude 幾乎一樣），改採這個做法。`CodexAuthReader.cs` 一樣是純讀取、不碰 Codex CLI 的 session。風險跟 Claude 那支一樣：非公開端點，OpenAI 可能無預告改版；壞掉的話 fallback 是退回 ccusage 估算。

## 待辦 / 下一步（依 PRD 里程碑）

- [x] M1：`UsageProvider` 抽象、Claude 來源端到端接通（ccusage + 估算標示 + 用量/連線狀態）、OS Keychain 儲存層就緒
- [x] M1：Tailwind CSS v4 + [`@sanring/ui`](https://ui.sanring.dev/)（**改用**，取代原拍板的 spartan/ui——它的官方 CLI 綁 Nx workspace，跟本專案的純 Angular CLI 結構不合）已裝好並套用到畫面（card/badge/progress/button）
- [x] M2：`CodexUsageProvider`（ccusage codex）、`DeepSeekUsageProvider` / `KimiUsageProvider`（官方 balance API，key 存 Keychain）；「新增來源」/「取消追蹤」（含二次確認）UI 都接好了。DeepSeek 401 錯誤處理實測過（用假 key 驗證會正確回報「失效」）
- [x] M2 二次修訂：`ClaudeUsageProvider` 改打 Anthropic 官方 `/api/oauth/usage`（見上），拿到真正 5h/7d 百分比，不再只是估算 token 數；已修過兩個實測才抓到的 bug：① Angular build 預設 `<base href="/">` 在 `file://` 載入下整頁空白（`scripts/build.sh` 已加 `--base-href ./`）② DeepSeek/Kimi 的 JSON 是 snake_case，`PropertyNameCaseInsensitive` 不會處理底線，導致「無法解析」（已加 `[JsonPropertyName]`）
- [x] 多帳號重構（2026-08-31）：`TrackedAccount`（`accountId`/`sourceId`/`label`）取代單帳號的 `TrackedSourceIds`；API key 制（DeepSeek/Kimi）可以新增多個帳號，訂閱制（Claude/Codex）維持單一；新增了「＋ 新增來源」畫面（AI 類型 → 存取類型兩層選單，依存取類型分區並用邊框卡起來）
- [x] `CodexUsageProvider` 升級（2026-08-31）：改打 ChatGPT 後端 `/backend-api/wham/usage`（見上），拿到真正 5h/7d 百分比，不再只是估算 token 數，跟 Claude 現在同等級
- [x] 已查證 Claude/Codex 的 API key 制官方用量查詢不可行（見上「已知風險與揭露」+ PRD §5/§9/§12），Grok 同理只支援訂閱制
- [x] 多帳號技術查證（2026-08-31）：
  - **Claude 多帳號**：查到 `cswap list --json` 是官方文件化的「JSON output for scripting」介面，會回傳每個帳號的 email/5h/7d 百分比/重置時間，資料格式跟我們自己打 `/api/oauth/usage` 一致。設計：偵測到本機有裝 `cswap` 就 shell out 呼叫它拿多帳號；沒裝就退回現有的單帳號直接呼叫
  - **Grok API key 制**：查了 xAI 官方文件（`docs.x.ai`），沒有查到任何餘額/用量查詢端點，**目前技術上做不到**，先只做 Grok 訂閱制（`ccusage grok` 有支援）
  - 兩者都不影響「AI 類型 × 存取類型 × 帳號」的架構模型本身，只是某些組合目前技術上不可行/需要額外外部依賴
- [x] Kimi 訂閱制（2026-08-31，⚠️ 未實測）：`KimiSubscriptionUsageProvider` + `KimiCliAuthReader`，從開源的 `MoonshotAI/kimi-code` repo 讀出端點/憑證格式；headless 測過「找不到本機憑證」這條路徑，但真的打通端點這件事沒人能驗證（沒有真實 Kimi Code 帳號）。Grok 訂閱制同理查過（見上）但更不確定，先沒動手寫
- [x] **修掉一個藏很深的 bug（2026-08-31）**：`AppPaths.cs` 用錯 `SpecialFolder.Personal`，導致 macOS 上設定檔存到 `~/Documents/Library/...` 而不是 `~/Library/...`，改用 `.UserProfile` 修正（詳見上面架構區塊）
- [x] 清單拖曳排序 + 帳號改名（2026-08-31）：`sanring-card` 掛 `@angular/cdk` 的 `cdkDropList`/`cdkDrag`（左側 ⠿ 把手拖曳），排序即時反映在 UI 並整批送 `reorder-accounts` 存回 `TrackedAccounts` 順序；點副標題（`accountLabel`）進入行內編輯改名，走新的 `rename-account` 訊息，只改帳號自訂標籤，不動 `displayName`（AI 類型固定不可改）
- [ ] M3：設定頁（刷新頻率、保留期、接近上限閾值可調）
- [ ] M4：取消追蹤（完整刪除本機資料，含 Keychain）vs 關閉顯示，兩個獨立操作 + 二次確認
- [ ] M5：Windows 上實際跑一次打包驗證（`WindowsSecretStore` 目前只是照文件寫的 P/Invoke，還沒真的在 Windows 上測過）
- [ ] 系統匣圖示（tray icon）：Photino.NET 沒有內建跨平台 tray API，PRD 已將其列為非本期範圍（見 `.claude/prds/usage-monitor.md` §3）
