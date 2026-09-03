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
- [x] **Windows 單一 `.exe`**（2026-09-03，已在真實 Windows 環境補做啟動驗證）：`./scripts/build.sh win-x64` 現在除了 `PublishSingleFile`/`IncludeNativeLibrariesForSelfExtract`，還會把 Angular 的 `wwwroot` 一起打進發佈檔；正式啟動時若磁碟上沒有實體 `wwwroot`，`Program.cs` 會從 embedded resources 自行解到 temp，再由內建的 loopback HTTP server 提供給 WebView2。這樣 publish 目錄只剩 `SanringHaul.exe`（另有 `.pdb` 符號檔可不對外發），下載頁可以直接掛 `.exe`，不用再放 `.zip`。這次在 Windows 真機也順手補修兩個只有實機才會暴露的問題：① Top-level `await` 生成的是 MTA `Main`，WebView2 需要 `[STAThread]`，不然視窗標題會出來但內容是黑的；② WebView2 用 `file://` 載 Angular 22 的 `type="module"` 產物會被 CORS 擋掉，同樣表現成黑畫面，所以正式版改走 `http://127.0.0.1/...`。真的裝成 `.msi`/安裝程式（Start Menu 捷徑、解安裝、之後的自動更新）留到階段 2 再評估值不值得
- [x] **版本號**（2026-08-31）：SSOT 是根目錄的 `VERSION` 檔（純文字一行 SemVer，現在是 `0.1.0`）。`backend/SanringMonitor.csproj` 用 MSBuild 讀檔自動變成 `<Version>`（已驗證：組件的 AssemblyVersion 正確變成 `0.1.0.0`），`frontend/package.json` 跟 `backend/packaging/macos/Info.plist` 的 `CFBundleVersion` 手動對齊——三個地方，還不到值得建自動同步 pipeline 的規模，改版時三處都要記得改
- [x] **實際下載連結**（2026-08-31 起，2026-09-03 更新 Windows 策略）：GitHub Release 掛在 repo，macOS 繼續放 `.dmg`；Windows 在舊版曾因為 `wwwroot/` sidecar 需求只能掛 `.zip`，現在已修成真正單一 `.exe`，下一版 release/download page 應改直接指向 `.exe` asset，而不是壓縮檔
- macOS 沒簽章依然要手動繞過 Gatekeeper（右鍵開啟，或 `xattr -d com.apple.quarantine`），這階段可以接受，但要在分享時附上這段說明，不然對方會以為程式壞了
- [x] **改名：sanring Usage Monitor → sanring Haul**（2026-09-01）：「Monitor」語感偏被動（盯著看），改成 Haul——撒網把散落各處的用量資料一次撈起來的動作感。牽動：repo（`usage_monitor` → `haul`）、網域（`usage-monitor.sanring.dev` → `haul.sanring.dev`）、執行檔/csproj（`SanringMonitor` → `SanringHaul`）、bundle id（`dev.sanring.usagemonitor` → `dev.sanring.haul`）、v0.1.0 Release 資產重新上傳。**刻意不動**：本機資料夾名稱（`~/Library/Application Support/SanRingUsageMonitor/`，見下方階段 0）、localStorage key 前綴（`sanring-usage-monitor:*`）、C# namespace（`UsageMonitor.Desktop`）——這些是使用者看不到的內部管線，改名只會帶來「舊資料/舊偏好設定silently消失」的風險，沒有對應的品牌效益，跟第一次改名（`UsageMonitor.Desktop` → `SanringMonitor`）同一套判斷
- [x] **Homebrew（自己的 tap）**（2026-09-01）：[`sanringtech/homebrew-tap`](https://github.com/sanringtech/homebrew-tap)，`Casks/haul.rb` 指到 v0.1.0 release 的 `.dmg`（sha256 下載後 `shasum` 實測比對過）。**不是**送審官方 `homebrew-cask`——那個通路有穩定度/知名度門檻，v0.1.0 剛改名還太早，見上面「repo 公開性」的同一套考量。已用本機 `brew tap` → `brew trust`（實測發現：較新版 Homebrew 對第三方 tap 預設不信任，要手動 trust 一次，這步不做會直接被擋）→ `brew install --cask haul` 走過一次完整流程，成功裝到 `/Applications/`。**修正一個原本猜錯的地方**：一開始以為 Homebrew 安裝 cask 會自動清掉 `com.apple.quarantine`，實測 `xattr -l` 發現沒有——這版 Homebrew 不會，Gatekeeper 照樣會擋第一次雙擊，caveats 裡已經補上正確的繞過方式，不是隨口猜的

## 階段 2：真的對外公開發布

- [ ] **macOS 簽章 + 公證（notarization）**：需要 Apple Developer Program（US$99/年）；不簽章的話一般使用者看到「無法確認開發者」多半直接放棄，不像階段 1 對象會自己想辦法繞過
- [ ] **Windows 程式碼簽章**：需要程式碼簽章憑證（EV 憑證最順、但費用較高；便宜的 OV 憑證前期仍會有 SmartScreen 警告，需要累積下載量/信譽才會消失）——這筆成本比 macOS 高，值得先評估要不要做
- [ ] **正式下載頁**：把 Coming Soon 頁換成真的列出各平台下載連結、目前版本號、changelog 的頁面
- [ ] **風險揭露要更顯眼**：[`RISKS.md`](RISKS.md)（非公開端點、`cswap` 依賴）現在只有看 repo 的人看得到，對外部一般使用者要搬到下載頁上顯著位置，不能只藏在 repo 裡
- [ ] **開始需要 changelog**：跟 git commit message 是兩回事——commit message 是給開發者看的技術細節，changelog 是給使用者看的「這個版本新增/修了什麼」，用詞跟顆粒度都不同（見 [`CHANGELOG.md`](CHANGELOG.md)，目前還是開發過程記錄，還沒轉成使用者視角）
- [ ] **自動更新機制（可選，進階）**：這個技術棧（Photino）沒有內建 auto-updater，要做的話得自己設計，例如 app 啟動時打 GitHub Releases API 比對版本號、提示使用者手動下載新版——這階段才需要考慮，前兩階段不用
