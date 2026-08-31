# Changelog

開發過程記錄，依 PRD 里程碑分組（新到舊）。目前是給開發者看的技術細節，不是使用者視角的版本說明——那個轉換是 [`RELEASE-PLAN.md`](RELEASE-PLAN.md) 階段 2 才要做的事，現在還沒有版本號機制。

## M5（進行中）

- [ ] Windows 上實際跑一次打包驗證（`WindowsSecretStore` 目前只是照文件寫的 P/Invoke，還沒真的在 Windows 上測過）
- [ ] 系統匣圖示（tray icon）：Photino.NET 沒有內建跨平台 tray API，查證過三條路（維持現狀／換 Tauri／Mac 端整個換原生 Swift 像 `stats`/`eul`），浮動小工具那條路後來還原了（見下），目前 tray 整個擱置

## M4（2026-08-31）：取消追蹤 vs 關閉顯示、多帳號、UI 打磨

- 取消追蹤 vs 關閉顯示，兩個獨立操作：「取消追蹤」（完整刪除本機資料含 Keychain，二次確認）在多帳號重構那次就做好了；「關閉顯示」的後端（`SetVisibility`/`set-visibility` 訊息）其實也早就寫好，這次補的是前端——卡片新增「關閉顯示」按鈕（灰色、可逆、無二次確認，跟紅色「取消追蹤」視覺區隔開）。「已隱藏的來源」清單原本放在設定頁，使用者反饋跟卡片分屬兩個畫面不直覺，改到主畫面清單底部一塊可展開/收合的區塊（藏在哪裡就在哪裡找回來，只在真的有隱藏帳號時才出現）
- Claude 多帳號實作完成：靠偵測本機是否裝了選用的 `cswap`，用真實 `cswap list --json` 輸出核對過 schema（`resetsAt` 跟官方 API 一樣是 ISO8601，直接沿用既有格式化邏輯）。「＋ 新增來源」點 Claude 會一次偵測、加入 cswap 回報的所有帳號（AccountId 用 email 識別，不用 cswap 的 account number——那只是清單序號，帳號增減會變動）；沒裝 cswap 就退回原本的單帳號行為，完全不影響。**關鍵邊界情況**：升級前留下的舊版單帳號紀錄會原地升級成新的 email 格式（保留使用者改過的名稱），不會變成兩張卡片重複顯示同一個帳號——這個用使用者自己真實的帳號+既有設定檔實測過。`GetCatalog()` 也調整：Claude 不會因為已經追蹤一個就整個變灰，永遠可以再按一次抓新帳號
- 多帳號技術查證：
  - **Claude 多帳號**：查到 `cswap list --json` 是官方文件化的「JSON output for scripting」介面，會回傳每個帳號的 email/5h/7d 百分比/重置時間，資料格式跟自己打 `/api/oauth/usage` 一致
  - **Grok API key 制**：查了 xAI 官方文件（`docs.x.ai`），沒有查到任何餘額/用量查詢端點，**目前技術上做不到**，先只做 Grok 訂閱制（`ccusage grok` 有支援）
- Kimi 訂閱制（⚠️ 未實測）：`KimiSubscriptionUsageProvider` + `KimiCliAuthReader`，從開源的 `MoonshotAI/kimi-code` repo 讀出端點/憑證格式；headless 測過「找不到本機憑證」這條路徑，但真的打通端點這件事沒人能驗證（沒有真實 Kimi Code 帳號）
- 清單拖曳排序 + 帳號改名：`sanring-card` 掛 `@angular/cdk` 的 `cdkDropList`/`cdkDrag`（左側 ⠿ 把手拖曳），排序即時反映在 UI 並整批送 `reorder-accounts` 存回 `TrackedAccounts` 順序；點主標題進入行內編輯改名（存的是 `accountLabel`，不動 `displayName`），走新的 `rename-account` 訊息。兩者都改成「本地樂觀更新 + 靜默存檔」，不觸發完整用量刷新
- 主題切換 + 完整雙語 i18n：`theme`/`lang` signal + `effect()` 切 `data-theme` 屬性，跟查 `frontend/src/app/i18n.ts` 翻譯表，兩者都存 localStorage、按一下當場生效不重載視窗。**刻意不用 `@angular/localize`**——那是 build-time 多 bundle 機制，跟這裡要的「app 內即時切換」不合。卡片內容（後端訊息）也接上了：`backend/Models/LocalizedText.cs`（key + params）+ `MessageKeys.cs`（key 常數），五支 Provider 全部改成送 key 不送組好的中文句子
- 主題/圖示樣式：原本主題切換等處用原生 emoji，改用專案已有的 `@lucide/angular`
- （後來還原）~~浮動小工具（widget）~~：做過一版雙視窗（主視窗 + chromeless/transparent/topmost 小工具，pixel-star 圖示、卡片堆疊、上下拖曳切換），星星圖示/展開收合/拖曳切卡片/結束整個 app 都測過正常，但「詳細」按鈕（叫回主視窗）連試四種修法都沒解決（攔截關閉鈕改最小化、補 `SetTopMost` 開關、補 `osascript` 跨 app 搶焦點、每次都無條件開新視窗、用 `host.Invoke()` 丟回 UI 主執行緒），使用者決定整個功能先還原：`Program.cs`/`main.ts` 已改回單一主視窗，`frontend/src/app/widget/`、`shared/wire-types.ts` 的程式碼還留著沒刪，只是目前不會被載入執行

## M3（2026-08-31）：設定頁 + 品牌

- 齒輪按鈕開啟設定頁，刷新頻率（5分/1時/2時/純手動，驅動真的 `setInterval` 自動刷新）、接近上限閾值（滑桿 50-95，存檔後觸發完整刷新讓卡片立刻反映新門檻）都是真的有效果的設定。**保留期是例外**：UI 上有這個控制項、值也會存下來，但目前完全沒作用——這個 app 沒有「歷史用量序列」資料可以清除，UI 上直接用一行小字誠實告知使用者
- 換上 pixel-star.svg 當 logo（favicon + app header + `SetIconFile`，後者只在 Windows/Linux 有效，macOS 要靠 `.app` bundle 的 `.icns`，另見 `backend/packaging/macos/`）
- 新增「用量來源說明」頁，講清楚各 AI 類型的多帳號現況（點 header 上的 info 圖示）
- 修掉一個藏很深的 bug：`AppPaths.cs` 用錯 `SpecialFolder.Personal`，導致 macOS 上設定檔存到 `~/Documents/Library/...` 而不是 `~/Library/...`，改用 `.UserProfile` 修正（詳見 [`ARCHITECTURE.md`](ARCHITECTURE.md)）

## M2（含二次修訂）：真實用量端點 + API key 制來源

- `CodexUsageProvider`（一開始 `ccusage codex`）、`DeepSeekUsageProvider` / `KimiUsageProvider`（官方 balance API，key 存 Keychain）；「新增來源」/「取消追蹤」（含二次確認）UI 都接好了。DeepSeek 401 錯誤處理實測過（用假 key 驗證會正確回報「失效」）
- 二次修訂：`ClaudeUsageProvider` 改打 Anthropic 官方 `/api/oauth/usage`，拿到真正 5h/7d 百分比，不再只是估算 token 數；`CodexUsageProvider` 同樣升級改打 ChatGPT 後端 `/backend-api/wham/usage`（詳見 [`ARCHITECTURE.md`](ARCHITECTURE.md)）。已修過兩個實測才抓到的 bug：① Angular build 預設 `<base href="/">` 在 `file://` 載入下整頁空白（`scripts/build.sh` 已加 `--base-href ./`）② DeepSeek/Kimi 的 JSON 是 snake_case，`PropertyNameCaseInsensitive` 不會處理底線，導致「無法解析」（已加 `[JsonPropertyName]`）
- 已查證 Claude/Codex 的 API key 制官方用量查詢不可行（見 [`RISKS.md`](RISKS.md) + PRD §5/§9/§12），Grok 同理只支援訂閱制
- 多帳號重構：`TrackedAccount`（`accountId`/`sourceId`/`label`）取代單帳號的 `TrackedSourceIds`；API key 制（DeepSeek/Kimi）可以新增多個帳號，訂閱制（Claude/Codex）維持單一；新增了「＋ 新增來源」畫面（AI 類型 → 存取類型兩層選單）

## M1：基礎架構

- `UsageProvider` 抽象、Claude 來源端到端接通（ccusage + 估算標示 + 用量/連線狀態）、OS Keychain 儲存層就緒
- Tailwind CSS v4 + [`@sanring/ui`](https://ui.sanring.dev/)（**改用**，取代原拍板的 spartan/ui——它的官方 CLI 綁 Nx workspace，跟本專案的純 Angular CLI 結構不合）已裝好並套用到畫面（card/badge/progress/button）

## 2026-08-31（後續，改名 + 部署基礎設施）

- 執行檔改名 `UsageMonitor.Desktop` → `SanringMonitor`（含 `UsageMonitor.slnx` 修復）
- macOS `.app` bundle + 自訂 Dock 圖示（`backend/packaging/macos/`，`scripts/make-icns.sh`）
- Header 精簡：文字標題拿掉（視窗標題列已經有），info/設定/語言/主題四顆圖示都在 header，不用進設定頁
- cswap 偵測失敗改用 `-ilc`（interactive+login shell）修復（詳見 [`ARCHITECTURE.md`](ARCHITECTURE.md)）
- repo 轉 public，加入 `docs/index.html` Coming Soon 佔位頁（GitHub Pages，`usage-monitor.sanring.dev`）
- macOS `.dmg` 打包：`scripts/make-dmg.sh`，獨立於 `build.sh` 之外手動執行（詳見 [`RELEASE-PLAN.md`](RELEASE-PLAN.md) 階段 1）
