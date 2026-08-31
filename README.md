# SanRing Usage Monitor

跨平台（Windows + macOS）桌面小工具：監控 Claude / Codex / DeepSeek / Kimi / Grok 底下每一個帳號的用量。

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
./scripts/build.sh osx-arm64    # 指定 RID，self-contained（macOS 會順便組成 SanringMonitor.app）
./scripts/build.sh win-x64
```

流程：`ng build` → 複製進 `backend/wwwroot/browser` → `dotnet publish`。macOS 目標另外會組 `.app` bundle（見 `backend/packaging/macos/`）。

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

現況（2026-08-31）：repo 已公開（`sanringtech/usage_monitor`），Coming Soon 頁面已上線：[usage-monitor.sanring.dev](https://usage-monitor.sanring.dev)。還沒有正式安裝檔可下載。

## 待辦 / 進度

依 PRD 里程碑：M1–M4 已完成，M5（Windows 打包驗證、系統匣圖示）進行中。完整開發歷程 → [`CHANGELOG.md`](CHANGELOG.md)。
