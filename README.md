# sanring Haul

跨平台（Windows + macOS）桌面小工具：把 Claude / Codex / DeepSeek / Kimi / Grok 底下每一個帳號的用量一次撈回同一個畫面。

> 2026-09-01 改名：原名「sanring Usage Monitor」（執行檔曾叫 `SanringMonitor`），覺得「Monitor」太被動（盯著看），改成 **Haul**——像撒網把散落在各個 CLI/帳號裡的用量資料一次撈起來的動作感。功能、架構完全沒變，純品牌更名。

- **前端**：Angular (`frontend/`) — UI，透過 `window.external` 跟後端溝通；元件用 [`@sanring/ui`](https://ui.sanring.dev/)（`npx @sanring/cli add <component>` 增加新元件）+ Tailwind CSS v4
- **後端**：C# + [Photino.NET](https://www.tryphotino.io/)（原生 WebView 殼）(`backend/`) — 讀取本機用量資料
- **業務規則 SSOT**：[`.claude/constitutions/usage-monitor.md`](.claude/constitutions/usage-monitor.md)
- **實作意圖 / 技術選型**：[`.claude/prds/usage-monitor.md`](.claude/prds/usage-monitor.md)

## ⚠️ 發布給別人用之前先讀這個

本工具部分功能（Claude/Codex 用量、Kimi 訂閱制）依賴**非官方、非文件化的端點**，Anthropic/OpenAI 可能無預告改版或停用；已知情、已評估過的取捨，不代表官方保證支援。完整清單、每個 provider 的風險細節 → [`RISKS.md`](RISKS.md)。

## 開發

```bash
./scripts/dev.sh
```

同時啟動 Angular dev server（`http://localhost:4200`，含 hot reload）跟 Photino 視窗，視窗載入 dev server 的網址。

## 打包

```bash
./scripts/build.sh              # 目前平台
./scripts/build.sh osx-arm64    # 指定 RID，self-contained（macOS 會順便組成 SanringHaul.app）
./scripts/build.sh win-x64
```

流程：`ng build` → 複製進 `backend/wwwroot/browser` → `dotnet publish`。發佈版不直接讓 Photino 用 `file://` 開 `index.html`：正式 build 會把 Angular 產物當成 app 內建資源，在啟動時用 loopback HTTP 提供給 WebView，避免 Windows WebView2 把 ES modules 擋成黑畫面。macOS 目標另外會組 `.app` bundle（見 `backend/packaging/macos/`）。

## 架構

```
backend/
├── Program.cs        視窗設定 + JS↔C# 訊息橋接
├── UsageService.cs   orchestrator：跑所有 IUsageProvider，單一 provider 出錯不拖垮整批
├── Models/            wire format（`UsageSummary`）+ 設定（`AppSettings`）
├── Providers/          每個 AI 一支 IUsageProvider 實作，API key 制 / 訂閱制皆有
└── Security/           API key 存 OS Keychain，CLI session 唯讀讀取（不寫入、不主動 refresh）
```

前後端溝通協定、除錯旗標、各 AI 用量怎麼來的（含反查非公開端點的過程）、修過的關鍵 bug → [`ARCHITECTURE.md`](ARCHITECTURE.md)。

## 發布規劃

分三階段（自己用 → 小範圍分享 → 公開發布），各階段要做的事、目前進度 → [`RELEASE-PLAN.md`](RELEASE-PLAN.md)。

現況（2026-09-05）：repo 已公開（`sanringtech/haul`），下載頁：[haul.sanring.dev](https://haul.sanring.dev)。v0.4.2 已發布（macOS `.dmg` 暫仍為 v0.4.1、Windows 單一 `.exe`）。

### 第一次執行的警告說明

本工具為開源軟體，目前尚未購買商業程式碼簽署憑證，因此第一次執行時作業系統會顯示安全警告。這是正常現象，你可以安全地繞過：

**Windows**

Windows Smart Screen 會顯示「智慧型應用程式控制已封鎖可能不安全的檔案」：

1. 在 `SanringHaul.exe` 上按**右鍵** → **內容**
2. 在視窗最下方勾選「**解除封鎖**」→ 按**確定**
3. 雙擊 `SanringHaul.exe` 即可正常執行

或是下載後，在 PowerShell 執行一次：

```powershell
Unblock-File -Path "$env:USERPROFILE\Downloads\SanringHaul.exe"
```

之後就可以直接雙擊，不會再出現警告。

**macOS**

Gatekeeper 會顯示「無法驗證開發者」：

1. 在 `SanringHaul.app` 上按**右鍵（或 Control + 點一下）** → **開啟**
2. 在彈出的對話框按**開啟**
3. 之後雙擊就不會再出現警告

macOS 也可以透過自己的 Homebrew tap 安裝（[sanringtech/homebrew-tap](https://github.com/sanringtech/homebrew-tap)，還沒送審官方 `homebrew-cask`）：

```bash
brew tap sanringtech/tap
brew trust sanringtech/tap   # 較新版 Homebrew 對第三方 tap 預設不信任，要手動信任一次
brew install --cask haul
```

## 待辦 / 進度

依 PRD 里程碑：M1–M4 已完成，M5（Windows）進行中。完整開發歷程 → [`CHANGELOG.md`](CHANGELOG.md)。簽章／SmartScreen／Gatekeeper 屬 [`RELEASE-PLAN.md`](RELEASE-PLAN.md) 階段 2，不列在這裡。

### 未完成

- [ ] **Windows Haul + WSL 裡的 AI CLI**（2026-09-04 拍板，尚未實作）：Haul 裝在 Windows、Claude/Codex/Kimi CLI 登在 WSL 時，要能讀到憑證與本機 JSONL。實測 `\\wsl.localhost\Ubuntu\home\…` 路徑通、9p 掃 sessions 可接受。作法：新增 `CliHomeRoots`，掃 Windows 家目錄 + **正在執行**的 distro `$HOME`（`wsl -l --running`，不叫醒停掉的 VM；沒有 `.claude`/`.codex`/`.kimi-code` 的 distro 跳過）。帳號卡片依 AccountId 去重只留一份（未過期 token > Windows > WSL）；本機用量帳簿改聯集各 home 的 JSONL（既有 requestId／per-file 去重）。Capture 從「讀目前那一份」改成掃全部 home。刻意不做：設定頁選 distro、Cursor/Gemini、把 Haul 設定寫進 WSL。過渡期可用 `$env:CODEX_HOME` / `$env:CLAUDE_CONFIG_DIR` 指到 UNC，但 `.claude.json` 寫死 Windows 家目錄，email 標籤會對不上，實作時一併修。
- [ ] **工作列按鈕圖示仍是 Windows generic 佔位圖**（原因未找到）：標題列、Alt+Tab、檔案總管的 `.exe` 圖示已正確（DIB 多尺寸 `backend/app.ico` + `WM_SETICON` / `GCLP_HICON`）。已排除：壞 ICO、HICON 被 `using` 提早釋放、Explorer 快取（換路徑重測）、隱藏 owner 視窗、AppUserModelID。不要再盲猜，要有新證據再動手。
- [ ] **執行期圖示來源分裂**：PE/`ApplicationIcon` 讀 `backend/app.ico`，執行期 `AppContent.FindIconPath` 優先 `wwwroot/browser/favicon.ico`。兩份目前靠手動複製同步，之後只改一邊就會不一致。應單一來源（建議：嵌入的 `app.ico`）。
- [ ] **系統匣 tray**：`TrayIcon` + 關閉改最小化已寫好，**尚未在真機確認**通知區圖示、雙擊還原、右鍵顯示/結束是否正確。
- [ ] **Kimi 訂閱制端點未用真實帳號驗證**（M4 留下）：`KimiSubscriptionUsageProvider` 有「找不到憑證」路徑，打通官方用量尚未實測。
- [ ] **浮動小工具程式碼還留著**：`frontend/src/app/widget/` 與 `shared/wire-types.ts` 相關型別未刪，目前不會被載入。要嘛清掉，要嘛標成明確擱置。

### 這次 Windows 回合已處理（勿再當成未修）

- 發佈黑畫面：`[STAThread]` + loopback `UiFileServer`，不再走 `file://`
- 單一 `.exe`：`wwwroot` 嵌入組件，啟動時解出
- Credential Manager 寫入錯誤 1783：blob 上限 2560 bytes（UTF-16），快照切塊存多筆 credential；已對真實 CredWrite 往返測過
- `.gitignore`：補上 `frontend/node_modules`、`dist`、`.angular`、`build-log.txt`

要新增新的 AI 來源之前，先看 [`AI-LANDSCAPE.md`](AI-LANDSCAPE.md)——已查證哪些 AI 的個人 API key/訂閱制有辦法查到用量、哪些是死路，不要重複查證過的東西。
