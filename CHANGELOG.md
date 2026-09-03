# Changelog

開發過程記錄，依 PRD 里程碑分組（新到舊）。目前是給開發者看的技術細節，不是使用者視角的版本說明——那個轉換是 [`RELEASE-PLAN.md`](RELEASE-PLAN.md) 階段 2 才要做的事。版本號機制見 `VERSION` 檔（SSOT）。

## v0.4.0（2026-09-03）：Claude/Codex 多帳號快照、Codex 本機用量帳簿

- **Claude/Codex 改用「擷取目前 CLI 登入」，取代原本只有 Claude 靠 cswap 才能多帳號的限制**——`SubscriptionSnapshotStore` 統一存放擷取到的登入快照，同一 email 再擷取一次會覆蓋（換票），不同帳號則新加一筆；`CswapImporter` 負責把舊版 cswap 設定一次性搬進新快照庫，之後不再呼叫 cswap；`JwtEmail` 從登入憑證解出帳號 email 供辨識
- 上述升級會讓舊版單帳號 `TrackedAccount`（AccountId 字面 `claude`/`codex`）與新格式 `{source}:{email}` 短暫並存，首頁卡片、折線圖圖例、`usage_history` 資料表都補上收斂邏輯，不會看到重複帳號
- **新增 Codex 本機用量帳簿**：掃描 `$CODEX_HOME/sessions` JSONL，比照既有 Claude 帳簿抓法依模型加總 token、用官方 Standard 短上下文標價估算金額；「流水帳」頁更名「用量紀錄」並拆成「本機用量／配額走勢／匯出」三節，本機用量下 Claude／Codex 各一張卡片
- 視窗初始尺寸從 420×640 放寬到 500×700；連線狀態改成 tooltip 呈現；重新整理完成後「上次更新」文字短暫高亮；DeepSeek/Kimi 餘額顯示改用 `$` 前綴＋固定文化字串格式化，不受系統 locale 影響

## v0.3.3（2026-09-02）：文字對比度打磨

- **新增語意化文字色 token**（`sanring-theme.css`，淺色／深色主題各自定義）：`--sanring-*-fg`（成功／警示／警戒／錯誤四種狀態的「當文字用」版本，跟徽章/進度條填色用的 `-50` 分開，避免淺底配淺字）、`--sanring-helper`（比 `--sanring-muted` 更接近前景色，給設定頁長說明文字用）
- 徽章、警示框、欄位錯誤訊息、標籤、卡片狀態圖示改用新 token，不再直接寫死 `text-white` 或裸用色階數字（`error-40`/`error-50` 等）——原本 `text-white` 疊在填色徽章上，色階換了新的（例如警戒色）文字可能就看不清楚，改成語意化 token 之後配色統一在一個地方管
- 設定頁一批 `text-[10px]` 的說明文字放大到 `text-xs`（12px）並加 `leading-relaxed`，可讀性太小的問題一次修掉
- 下載頁（`docs/index.html`）的徽章同樣的問題：淺色主題把 `--accent` 加深給連結用，徽章文字若用 `--bg`（淺色主題下接近白色）疊上去對比會掉到 4:1 以下——拆出獨立的 `--chip-fg`/`--chip-accent`/`--chip-success`，不再共用會隨主題變色的 token

## v0.3.2（2026-09-02）：用量歷史圖表對話框、Cursor 雙桶用量修正

- **用量歷史圖表改收進獨立對話框**——原本折線圖固定嵌在「記錄用量歷史」設定卡片下面，使用者
  反饋擔心之後圖表種類一多（甜甜圈量表、之後可能的熱力圖）設定頁會被塞爆，改成點「查看圖表」
  按鈕才開對話框看；設定卡片本身只留開關、說明、按鈕、匯出
- **新增甜甜圈量表**（`sanring-donut-gauge`，手畫 SVG，同樣不引入圖表庫）——每個帳號＋視窗各自
  一個獨立量表（已用／未用兩段弧），不是把多個帳號的 % 拼進同一個圓餅：那樣切片加起來會是
  100%，會誤導使用者以為這些帳號共用同一份額度，但實際上每個帳號的用量 % 是各自獨立算的
  。對話框內折線圖／甜甜圈量表用跟自動刷新間隔同款的按鈕組切換，圖例的顯示/隱藏狀態兩種模式
  共用不重置
- **修正 Cursor「Included in Pro」用量計算**——設定頁的「Included in Pro」實際上是兩個獨立的
  百分比（Cursor Models／Other Models），改抓新的 `GET /api/usage-summary` 端點直接拿官方算好
  的百分比（`WorkosCursorSessionToken` cookie 驗證），不再用「花費 / 方案額度」換算；舊端點保留
  作為分桶欄位缺漏時的 fallback，也是美元花費附註的唯一來源

## v0.3.1（2026-09-02）：Claude 用量喚醒

- **新功能：Claude 用量喚醒**（設定頁，預設關閉）——實測發現 Claude 的 5 小時／7 天用量視窗是懶
  初始化的：帳號（或上一輪視窗到期後）沒送過訊息，視窗就停在「尚未開始」狀態，跟 claude.ai
  網頁「Starts when a message is sent」是同一回事，不是資料抓錯或帳號壞掉（完整查證，含跟使用者
  自己的匯出紀錄比對佐證，見 [`AI-LANDSCAPE.md`](AI-LANDSCAPE.md)）。這個開關會在每天使用者
  自訂的時刻（本機時間，24 小時制，逐帳號設定）對勾選的 Claude 帳號各送一則最小訊息（`claude-
  haiku-4-5`、`max_tokens: 8`）喚醒視窗——**這是這個 app 目前唯一會真的消耗使用者用量額度的
  功能**，其餘所有請求都是唯讀查詢，UI 上用警示色說明文字標出來
- 帳號清單合併顯示中（`summaries()`）跟關閉顯示中（`hiddenAccounts()`）兩邊的 Claude 帳號——
  隱藏不等於移除，帳號還在追蹤、還會被喚醒，設定頁要看得到才改得了；帳號標籤支援點擊改名，跟
  卡片標題、API KEY 餘額提醒同一套機制（縮小成 `RenameableAccount` 最小介面重用）
- `RemoveSource()`（取消追蹤）現在會一併清掉該帳號的喚醒選取與最後觸發日期——這個殘留不像其他
  死掉的設定值只是安靜地沒作用，是會繼續真的花錢的動作，取消追蹤後必須主動清乾淨
- 24 小時制時刻選單刻意用 `<select>` 不是 `<input type="time">`——後者的 12/24 小時制顯示綁定
  作業系統 locale，HTML 沒辦法強制格式，下拉選單才能保證顯示一致
- 修掉 `frontend/tsconfig.json` 沒設 `noEmit` 的問題——這個 session 兩次因為某次直接呼叫 `tsc`
  （沒加 `--noEmit`）在 `src/` 每個 `.ts` 旁邊生出編譯後的 `.js`，汙染到快要進 git 才發現，這次
  顯式設成 `true` 從根本擋住

## v0.3.0（2026-09-01）：用量歷史折線圖、設定頁互動打磨

- **用量歷史折線圖**（手畫輕量 SVG，不引入圖表庫——資料型態單純、bundle 已經超過 `angular.json` 的 500kB 警告門檻，不想再加重）：
  - 5 小時（短週期／突發額度）跟 7 天／其他（長週期／總預算，含 Cursor 這類單一視窗來源）拆成兩張獨立圖表，不再混在同一個 Y 軸比——兩者代表完全不同的緊急程度
  - 同一帳號跨圖表共用同一個顏色，視窗（5h/7d）用實線/虛線區分，不是每個「帳號＋視窗」組合各自配一個不相干的顏色
  - 圖例可點擊個別開關某條線的顯示（跟一般圖表庫的圖例互動一樣），每項顯示消耗速率（Δ%/小時，取最後兩個實際變化點計算）
  - `UsageHistoryStore.Record()` 加上增量過濾——跟上一筆比對，數值沒變化就不寫，原本每 5 分鐘不管有沒有變化都寫一筆的噪音問題解決；記錄間隔也從 3 分鐘調整為 5 分鐘
  - 折線圖跟匯出按鈕收在開關「開」的狀態底下，用 CSS `grid-template-rows`（0fr/1fr）做展開/收合過渡動畫，不是 `@if` 整塊瞬間消失/冒出來——這個專案沒有掛 `@angular/animations`，純 CSS 做得到就不用它
- **匯出檔案**：預設檔名 `record_...` 改成 `haul_yyyyMMddHHmmss`；預設存檔位置 Documents 改成 Downloads。反組譯 Photino.Native 的原生 macOS dylib 確認：那顆存檔視窗只呼叫 `setDirectoryURL:`，從沒呼叫過 `setNameFieldStringValue:`，`defaultPath` 的檔名部分天生不會被套用（Photino 本身的限制，沒原始碼可修）——退而求其次：使用者沒動過檔名欄位（還是系統預設的 "Untitled"）就自動換成正確命名，使用者自己打了別的名字則尊重不覆蓋
- **用量健康度**：移除點擊後彈出的細節 Dialog，只保留卡片列表頂端的純顯示（改成 `<div>` 不是按鈕，沒有東西可點還留著 hover 效果是誤導）；連帶清掉變成死程式碼的 `subscriptionSummaries`/`healthHoverClass` 跟幾個 i18n key
- **訂閱用量提醒**（注意／接近上限）改成單一軌道、雙手柄的區間滑桿（新元件 `sanring-range-slider`）取代原本兩條各自獨立、靠程式邏輯互相夾住的滑桿——畫面上天生不可能讓「注意」超過「接近上限」，不用使用者自己試撞邊界才發現這個限制；閾值輸入改成下拉選單（跟「API KEY 餘額提醒」的數字輸入框同尺寸 `h-9 w-28`，兩者的內距/字級也對齊到完全一致）
- **API KEY 餘額提醒**：DeepSeek/Kimi 兩列改成只在「至少追蹤一個對應帳號」時才顯示，不會出現帳號已取消追蹤、設定列還留著的不一致情況；`stateNearLimit` 措詞從「接近用盡」改成「警戒」——原本的措詞對餘額類（只是跨過第二道提醒門檻，不代表真的快沒了）太過嚴重
- 修掉兩個共用元件的過渡動畫缺口：`sanring-switch` 軌道變色時長對齊圓點滑動的 200ms；`sanringInput` 補上 `transition-opacity`，讓被開關連動 disabled 的欄位變暗/變亮也有過渡，不是瞬間跳一下
- 已隱藏來源清單的「取消隱藏」按鈕文字拿掉，改成跟卡片操作區一致的 icon + hover tooltip
- 清掉 `frontend/src/` 底下意外落地的 91 個編譯產物 `.js`（跟每個 `.ts` 同目錄同名，內容是轉譯後的版本——不是刻意產生的，`.gitignore` 沒排除到，這次一併清掉避免進 git）

## v0.2.0（2026-09-01）：Cursor 來源、用量健康度、用量歷史記錄

- 新增 **Cursor** 訂閱制來源：讀本機 `state.vscdb`（SQLite，第一次在這個專案用 `Microsoft.Data.Sqlite`）+ 解 JWT 判斷過期，方案標籤（Pro/Ultra）直接讀本機快取的 `stripeMembershipType`，完整查證見 [`AI-LANDSCAPE.md`](AI-LANDSCAPE.md)
- 方案標籤補齊：Claude（cswap 帳號改讀 Keychain 內 `subscriptionType`）、Cursor 都接上了，Codex 原本就有
- 首次啟動一次性資料存取聲明彈窗（強制同意，不可跳過）；啟動時自動刷新一次用量，不用再等自動刷新排程或手動點擊
- 用量警示改三階（attention 黃／near_limit 橘／exceeded 紅）；卡片清單頂端新增「用量健康度」彙總卡片（取最嚴重狀態代表整體，點開看各帳號細節）
- 新增「記錄用量歷史」：開關開啟後自動刷新固定接管成 3 分鐘一次，把訂閱制來源的用量寫進本機 SQLite（最長保留 1 個月），可匯出成 Markdown 或 Excel（新增 `ClosedXML` 依賴），存檔對話框用 Photino.NET 內建的原生「另存新檔」，不用額外套件
- 移除「歷史資料保留期」這個從沒真的生效過的舊設定（PRD Story 6 假設的歷史清除功能從未實作）
- 設定頁多處 UX 修正：刷新間隔按鈕、記錄用量歷史開關、DeepSeek/Kimi 餘額提醒開關改成點下去立即存檔（原本要另外按「儲存」，選了純手動之類的選項沒按儲存就離開，回來又跳回舊值，感覺像「自動跳回」，其實是根本沒存到）；DeepSeek/Kimi 餘額提醒標籤在只追蹤一個帳號時可以點擊改名、同步回卡片；用量健康度卡片修掉一個 `sanringButton`/`sanringBtn` 打錯字的 bug（整個 ButtonDirective 沒套用，垂直置中跟 hover 一起壞掉）；switch 軌道過渡時長對齊圓點滑動的 200ms

## 2026-09-01：改名 sanring Usage Monitor → sanring Haul

「Monitor」語感偏被動，改成 **Haul**——撒網把散落在各個 CLI/帳號裡的用量資料一次撈起來的動作感。純品牌更名，功能/架構不變：

- repo：`sanringtech/usage_monitor` → `sanringtech/haul`
- 網域：`usage-monitor.sanring.dev` → `haul.sanring.dev`
- 執行檔/csproj：`SanringMonitor` → `SanringHaul`
- macOS bundle id：`dev.sanring.usagemonitor` → `dev.sanring.haul`
- v0.1.0 Release 資產重新上傳（檔名跟著換）
- header 補上版本號顯示（logo 右側 `v0.1.0`，`App.appVersion`，手動對齊 `VERSION`）

**刻意不動**（內部管線，使用者看不到，改了只有資料遺失風險沒有品牌效益）：本機資料夾名稱 `SanRingUsageMonitor`、localStorage key 前綴 `sanring-usage-monitor:*`、C# namespace `UsageMonitor.Desktop`。

## 2026-09-01：Homebrew（自己的 tap）

[`sanringtech/homebrew-tap`](https://github.com/sanringtech/homebrew-tap) + `Casks/haul.rb`，`brew tap sanringtech/tap && brew install --cask haul`。實測走過完整安裝流程（見 RELEASE-PLAN.md 階段 1），修正一個原本猜錯的地方：Homebrew 不會自動清掉 `com.apple.quarantine`，Gatekeeper 照樣擋第一次雙擊，caveats 已補正確繞過方式。

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
- Windows 單一 `.exe`（⚠️ 只做過建置驗證）：`build.sh win-x64` 加上 `PublishSingleFile`，跨平台編出 71MB 單一執行檔；順手修掉 `OutputType` 在 Windows 上編成 console 子系統的 bug（改成 `WinExe`），沒有這個修正雙擊會多跳一個黑視窗（詳見 [`RELEASE-PLAN.md`](RELEASE-PLAN.md) 階段 1）
- 版本號機制：根目錄 `VERSION` 檔當 SSOT（`0.1.0`），`SanringMonitor.csproj` 自動讀檔變成 `<Version>`，`package.json`/`Info.plist` 手動對齊
