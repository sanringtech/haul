# 發布規劃

分階段記錄，2026-08-31 起草，持續更新。

這是桌面 app，不是網站——`sanring.dev` 這類靜態網站/GitHub Pages 沒辦法「跑」這個 app（沒有後端，讀不到本機 Keychain/CLI session），但可以拿來當**下載頁**：放幾顆「Download for Mac / Windows」按鈕連到實際安裝檔。Photino.Native 的 NuGet 套件已經內建 macOS(x64/arm64)、Windows(x64/arm64)、Linux(x64/arm64) 的原生執行檔，跨平台編譯技術上沒問題。

按使用者規模分三個階段，越後面要多做的事越多。

## 階段 0：只有自己，跨自己的多台電腦

- 直接 `git clone` + `./scripts/build.sh`，或跨平台編譯（`./scripts/build.sh osx-arm64`／`win-x64`）後把 `publish/<rid>/` 整包傳過去執行
- 不需要簽章、不需要下載頁、不需要版本號機制——這階段的「發布」就是把資料夾複製過去
- **重要**：帳號/設定/憑證完全不同步雲端，全部存在本機（`~/Library/Application Support/SanRingUsageMonitor/` + Keychain）。換一台電腦＝從零開始，Claude/Codex/Kimi 要重新登入、API key 要重新貼、`cswap` 要另外裝

## 階段 1：小範圍分享（少數信任的人/小團隊）

- [x] **repo 公開性**（2026-08-31）：`sanringtech/usage_monitor` 已轉 public——評估過的取捨是非公開端點依賴會更顯眼、還沒簽章公證，但 git 歷史掃過沒有任何憑證/API key 外洩
- [x] **Coming Soon 佔位頁**（2026-08-31）：`docs/index.html`，GitHub Pages（Source: main /docs）已開啟，`docs/CNAME` 指到 `usage-monitor.sanring.dev`；Cloudflare 那邊要另外手動加一筆 CNAME 記錄（`usage-monitor` → `sanringtech.github.io`，先設 DNS only）才會真的解析到自訂網域
- [x] **macOS `.dmg` 打包**（2026-08-31）：`scripts/make-dmg.sh`，讀 `publish/<dir>/SanringMonitor.app` 組成標準拖曳安裝的 `.dmg`（App + `/Applications` 捷徑並排），`hdiutil create` 壓縮格式。**刻意不接進 `build.sh`**——跟 `make-icns.sh` 同一套邏輯：打包分享才需要，不是每次 dev build 都要，接進去只會拖慢日常開發的建置速度。用法：先 `./scripts/build.sh` 產生 `.app`，再 `./scripts/make-dmg.sh` 包成 `.dmg`；已實測掛載/卸載、內容正確（1.4MB）
- [ ] **Windows 單一 `.exe`**：連自包含單一 `.exe` 都還沒做（`dotnet publish -r win-x64 --self-contained -p:PublishSingleFile=true`），現在 `publish/win-x64/` 是一整包資料夾，不是一支檔案；真的裝成 `.msi`/安裝程式（Start Menu 捷徑、解安裝、之後的自動更新）留到階段 2 再評估值不值得
- [ ] **版本號**：建議語意化版本（[SemVer](https://semver.org/)，`MAJOR.MINOR.PATCH`），目前完全沒有版本號機制，要決定存在哪裡（`.csproj` 的 `<Version>`？`package.json`？獨立的 `VERSION` 檔？）以及誰負責遞增
- [ ] **實際下載連結**：GitHub Releases 掛在 repo（現在已公開，任何人都能下載 release assets），或 build 好直接壓縮用雲端連結/AirDrop 分享
- macOS 沒簽章依然要手動繞過 Gatekeeper（右鍵開啟，或 `xattr -d com.apple.quarantine`），這階段可以接受，但要在分享時附上這段說明，不然對方會以為程式壞了

## 階段 2：真的對外公開發布

- [ ] **macOS 簽章 + 公證（notarization）**：需要 Apple Developer Program（US$99/年）；不簽章的話一般使用者看到「無法確認開發者」多半直接放棄，不像階段 1 對象會自己想辦法繞過
- [ ] **Windows 程式碼簽章**：需要程式碼簽章憑證（EV 憑證最順、但費用較高；便宜的 OV 憑證前期仍會有 SmartScreen 警告，需要累積下載量/信譽才會消失）——這筆成本比 macOS 高，值得先評估要不要做
- [ ] **正式下載頁**：把 Coming Soon 頁換成真的列出各平台下載連結、目前版本號、changelog 的頁面
- [ ] **風險揭露要更顯眼**：[`RISKS.md`](RISKS.md)（非公開端點、`cswap` 依賴）現在只有看 repo 的人看得到，對外部一般使用者要搬到下載頁上顯著位置，不能只藏在 repo 裡
- [ ] **開始需要 changelog**：跟 git commit message 是兩回事——commit message 是給開發者看的技術細節，changelog 是給使用者看的「這個版本新增/修了什麼」，用詞跟顆粒度都不同（見 [`CHANGELOG.md`](CHANGELOG.md)，目前還是開發過程記錄，還沒轉成使用者視角）
- [ ] **自動更新機制（可選，進階）**：這個技術棧（Photino）沒有內建 auto-updater，要做的話得自己設計，例如 app 啟動時打 GitHub Releases API 比對版本號、提示使用者手動下載新版——這階段才需要考慮，前兩階段不用
