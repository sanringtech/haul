---
schema_version: 1
feature_id: usage-monitor
feature_name: AI 用量監控小工具
status: draft
owner: jack755051
last_updated: 2026-08-31
related_constitution: .claude/constitutions/usage-monitor.md
related_adrs: []
---

# PRD: AI 用量監控小工具

## 1. 背景 (Background)

開發者日常會同時使用多家 AI 服務（Claude、Codex、DeepSeek、Kimi、Grok），且同一開發者名下常見同時掛多個帳號（例如兩個 DeepSeek 帳號、或同時擁有 Claude 訂閱與 Claude API key）——但各家、各帳號的用量/額度資訊分散在各自網站或 CLI 輸出裡，沒有統一的桌面視角可以一眼看到「每個帳號還剩多少可以用」。這導致開發者容易在工作到一半時才發現某個帳號額度用盡，打斷工作流程。

本工具的定位是一個常駐桌面的**唯讀監控小工具**：整合 Claude / Codex / DeepSeek / Kimi / Grok 五種 AI 類型底下、使用者實際新增的每一個帳號的用量/額度資訊（一個 AI 類型可能對應多個帳號，見憲法 R1/R5，2026-08-31 修訂），用顏色狀態一眼呈現「正常 / 接近上限 / 超額」與「連線是否有效」，且明確標示哪些數字是本地估算、哪些是官方精確值。工具刻意不做趨勢預測、不做自動介入、不碰密碼登入——這是監控工具，不是管理工具（見憲法 §1/§3/Decision 2）。

專案目前已有一定實作（Angular 前端 + C# Photino.NET 桌面殼 + 四個固定 `sourceId`（claude/codex/deepseek/kimi）的 `UsageProvider` 實作），本 PRD 這次更新（2026-08-31）對應憲法「多帳號支援」修訂，將原本「一個 AI = 一張卡片、一個固定 sourceId」的單帳號模型，改為「AI 類型 × 存取類型 → 多個獨立帳號」的模型，並將此變動反映到範圍、user story、資料模型、訊息契約與 UI 排列規則，作為後續 provider 重構與前端改版的依據。

## 2. 目標 (Goals)

- **業務目標**：開發者不需切換分頁或跑 CLI 指令，開啟桌面小工具 3 秒內看到自己名下每一個已追蹤帳號目前的用量狀態與連線狀態。
- **技術目標**：
  - 新增一個用量來源（provider）的邊際成本低——`UsageProvider` 抽象需讓「加一個 AI 類型」或「加一種存取類型」都不用改動核心訊息路由邏輯。
  - 前後端訊息往返（`get-usage-summary` 等）在本機環境下應為毫秒級（無網路請求時）；涉及 API key 制帳號呼叫官方端點時，需有逾時與失敗降級（不可讓 UI 卡死）。
  - 打包後的 self-contained 執行檔在 macOS 與 Windows 都能開啟並完成一次刷新。
- **使用者目標**：新增一個追蹤帳號（含輸入 API key 或指向本機 CLI）不超過 3 步；同一 AI 類型下新增第二個、第三個帳號的流程與新增第一個帳號一致，不需要額外學習成本；取消追蹤與關閉顯示是兩個清楚分開、不會誤觸的操作，且動作單位是帳號而非整個 AI 類型（呼應憲法 §8）。

## 3. 範圍 (Scope) vs 非範圍 (Non-Goals)

### ✅ 範圍
- [ ] 顯示 Claude / Codex / DeepSeek / Kimi / Grok 五種 AI 類型的用量狀態，且採「AI 類型 × 存取類型」兩維度組合模型，非寫死固定清單（憲法 R1，2026-08-31 修訂）
- [ ] 同一 AI 類型下可新增多個帳號（例如兩個 DeepSeek API key 帳號、Claude 訂閱 + Claude API key 並存），每個帳號獨立追蹤，彼此連線狀態/用量/取消追蹤互不影響、不合併計算或合併顯示（憲法 R5）
- [ ] 帳號標籤：能自動偵測身份的存取類型（如訂閱制帳號的 email）自動帶入；偵測不到的（API key 制）強制要求使用者輸入暱稱才能新增；所有標籤事後皆可重新命名（憲法 R5）
- [ ] 用量狀態三態視覺化（正常/接近上限/超額），適用單位是「帳號」，閾值可調（50–95%，預設 80%）（憲法 §4，2026-08-31 修訂：適用單位由 AI 類型改為帳號）
- [ ] 連線狀態四態視覺化（尚未設定/有效/失效/過期），適用單位是「帳號」（憲法 §4）
- [ ] 本地估算數字一律帶「估算」標示，不可呈現為官方精確數字（憲法 R3/I3）
- [ ] 新增帳號：訂閱制讀本機 CLI 紀錄檔或官方 session 估算；API key 制由使用者提供 key 呼叫官方端點；兩種存取類型不綁定特定 AI 類型（憲法 R1/R2）
- [ ] 自動刷新頻率可設定（5 分鐘 / 1 小時[預設] / 2 小時 / 純手動）（憲法 §9）
- [ ] 歷史資料保留期可設定（3 天[預設] / 5 天 / 一週 / 手動清除）（憲法 §9）
- [ ] 取消追蹤（完整刪除該帳號本機資料）與關閉顯示（保留資料、暫停顯示）兩種獨立操作，單位是帳號，同 AI 類型下其他帳號不受影響（憲法 §8，2026-08-31 修訂）
- [ ] 卡片依 AI 類型分組排列、同類型多帳號卡片相鄰顯示，並支援個別摺疊/展開（本次 UI 決策，見 §8；非憲法規則，屬 PRD 層級）

### ❌ 非範圍（明確不做，避免 scope creep）
- ❌ 用量趨勢預測（憲法 §1/R4）
- ❌ 自動介入：自動切換帳號、自動阻擋/切斷任務（憲法 §1/R4/Decision 2）
- ❌ 執行帳號登入流程、索取或儲存密碼（憲法 §1/R2/I2）
- ❌ 多人共用帳號的用量拆分/歸屬標記——Phase 2 候選，非本期範圍（憲法 §1/§10）
- ❌ 不同帳號間的用量合併計算或合併顯示（例如「兩個 DeepSeek 帳號加總餘額」）——憲法 R5 明訂帳號彼此獨立，本期不提供任何跨帳號彙總視圖
- ❌ Claude/Codex/DeepSeek/Kimi/Grok 以外尚未被憲法納入的 AI 類型——模型設計上可延續同一套 `aiType × accessType` 組合擴充，但本期不主動實作，需求出現時另行評估（憲法 R1）
- ❌ **Grok 的 API key 制帳號**（**已查證，2026-08-31**）：xAI 官方文件沒有餘額/用量查詢端點，技術上做不到，本期 Grok 只支援訂閱制
- ❌ **Claude / Codex 的 API key 制帳號**（**已查證不可行，2026-08-31**）：兩家官方用量/成本 API 都需要 Admin 等級憑證，個人帳號用不了；業務 owner 實測自己的帳號確認卡在同一個限制；且「查詢剩餘額度」這個功能本身 Anthropic 都還沒實作（見 §5 技術選型表），詳細查證過程見 §9/§12
- ❌ 任何雲端同步或伺服器端資料儲存（憲法 I1 明文禁止，本工具沒有伺服器）
- ❌ 系統匣常駐圖示（tray icon）——README 既有骨架列為後續強化方向，但業務憲法未要求此為核心功能，本期不做，列入 §11 後續追蹤觀察，需要時另外走 PRD 增修或 ADR

> **non-goals 比 goals 更重要**——尤其「不做自動介入」「無伺服器」與「帳號彼此獨立不合併」是憲法明訂的不可變約束（R4/I1/R5），任何後續功能提案都不可違反。

## 4. 使用者故事 (User Stories)

> 憲法 §2 明確：Phase 1 僅一個角色「使用者」（透過自己已登入/已提供憑證的各 AI 服務帳號，查看用量狀態），不區分帳號擁有者與共用帳號使用者。以下 Story 皆以此角色撰寫。原有 Story 1/2/3/7 已依 2026-08-31 憲法修訂調整措辭與驗收標準，新增 Story 9/10/11 對應多帳號情境。

### Story 1: 查看用量總覽

- **As a** 使用者（開發者）
- **I want to** 打開工具就看到已追蹤帳號的用量狀態與連線狀態，且同一 AI 類型的多個帳號分組相鄰顯示
- **So that** 不用切換到各家網站或跑 CLI 就知道自己名下每個帳號還能不能用，也不會把不同帳號搞混

**Acceptance Criteria**:
- [ ] Given 已追蹤至少一個帳號，when 開啟工具，then 顯示每個帳號的用量百分比、狀態顏色（綠/橘/紅）、連線狀態圖示、帳號標籤
- [ ] Given 同一 AI 類型下有多個帳號，when 顯示於主畫面，then 該 AI 類型的所有帳號卡片彼此相鄰，不與其他 AI 類型的卡片交錯（憲法 R5 精神 + §8 UI 決策）
- [ ] Given 用量數字來自本地估算，when 顯示於 UI，then 必須帶有「估算」標示（憲法 R3/I3），不可與官方精確值同樣呈現
- [ ] Given 尚未追蹤任何帳號，when 開啟工具，then 顯示 empty state 並引導使用者新增帳號

### Story 2: 新增訂閱制帳號（例如 Claude 訂閱 / Codex 訂閱）

- **As a** 使用者
- **I want to** 新增一個 Claude 或 Codex 的訂閱制帳號為追蹤對象
- **So that** 工具能讀取本機 CLI 紀錄或官方 session 估算用量，不需要我登入或輸入密碼

**Acceptance Criteria**:
- [ ] Given 本機存在對應 CLI 的使用紀錄檔或官方 session，when 新增此帳號，then 連線狀態變為「有效」並開始顯示估算/官方用量
- [ ] Given 系統能自動偵測到身份資訊（如 email），when 新增流程完成，then 該資訊自動帶入為帳號標籤，`labelSource` 標記為 `auto_detected`，使用者不需手動輸入（憲法 R5）
- [ ] Given 本機找不到對應紀錄檔/session，when 新增此帳號，then 連線狀態顯示「尚未設定」並提示原因，不可靜默顯示 0
- [ ] Given 整個新增流程，when 執行任何步驟，then 不出現任何登入表單或密碼欄位（憲法 I2）

### Story 3: 新增 API key 制帳號（例如 DeepSeek / Kimi / Claude API key / Grok API key）

- **As a** 使用者
- **I want to** 提供自己的 API key 來追蹤某個 AI 類型的 API key 制帳號
- **So that** 我能看到官方端點回報的剩餘額度，而不是估算值，且能為這個帳號取一個好辨識的名字

**Acceptance Criteria**:
- [ ] Given 使用者輸入有效格式的 API key，when 送出，then 呼叫官方用量端點成功、連線狀態變為「有效」、用量以「剩餘額度」術語顯示（非「時間窗口用量」，見憲法 §6 術語表）
- [ ] Given API key 制帳號無法自動偵測身份，when 新增流程執行到最後一步，then 強制要求使用者輸入暱稱作為帳號標籤，未輸入不可送出（`labelSource` 標記為 `manual`，憲法 R5）
- [ ] Given API key 格式錯誤或被撤銷，when 呼叫端點失敗，then 連線狀態顯示「失效」並附錯誤訊息
- [ ] Given API key 已提供，when 任何時刻查詢，then 該 key 只留在使用者本機，不經過任何外部伺服器中繼（憲法 I1/I2）

### Story 4: 自訂接近上限閾值

- **As a** 使用者
- **I want to** 調整「接近上限」的觸發百分比
- **So that** 我可以依自己的風險偏好提早或延後收到橘色警示

**Acceptance Criteria**:
- [ ] Given 預設閾值 80%，when 使用者未調整，then 用量狀態機依 80% 切換正常/接近上限
- [ ] Given 使用者調整閾值，when 輸入值在 50–95% 範圍內，then 設定生效並套用到所有帳號（此設定為全域單例，不因多帳號模型而拆分成逐帳號設定，見 §6 Settings）
- [ ] Given 使用者輸入超出 50–95% 範圍的值，then 拒絕儲存並提示合法範圍

### Story 5: 設定刷新頻率

- **As a** 使用者
- **I want to** 選擇自動刷新頻率或改為純手動
- **So that** 我可以在「即時性」與「減少本機/API 呼叫」之間取捨

**Acceptance Criteria**:
- [ ] Given 預設 1 小時，when 使用者未調整，then 每小時自動觸發一次刷新，更新所有已追蹤帳號的 UI
- [ ] Given 使用者選擇 5 分鐘 / 2 小時 / 手動，then 背景 timer 依新設定運作（手動時完全不自動觸發）
- [ ] Given 使用者手動按重新整理，when 任何頻率設定下，then 都能立即觸發所有帳號的一次刷新（既有骨架已支援此路徑）

### Story 6: 設定歷史資料保留期

- **As a** 使用者
- **I want to** 調整估算歷史資料的保留天數，或手動清除
- **So that** 我可以控制本機留存資料的多寡

**Acceptance Criteria**:
- [ ] Given 預設 3 天，when 超過保留期，then 對應歷史資料被清除（保留當前用量摘要，僅清除歷史序列）
- [ ] Given 使用者選擇 5 天 / 一週 / 手動清除，then 依新設定運作
- [ ] Given 使用者按下「手動清除」，then 立即清空所有帳號的歷史資料，UI 給予明確完成回饋

### Story 7: 取消追蹤 vs 關閉顯示（單位：帳號）

- **As a** 使用者
- **I want to** 分別對某一個帳號執行「完全移除」或「暫時關閉顯示但保留資料」
- **So that** 我可以依情境選擇要不要保留設定，且清楚知道兩者的差異與後果，也不會影響到同一 AI 類型下的其他帳號

**Acceptance Criteria**:
- [ ] Given 使用者對某帳號選擇「取消追蹤」，when 確認執行，then 該帳號從追蹤清單移除，且該帳號本機儲存的 API key / 估算歷史資料**全部刪除**；同 AI 類型下其他帳號的資料與顯示完全不受影響（憲法 §8/R5，2026-08-31 修訂：單位是帳號）
- [ ] Given 使用者對某帳號選擇「關閉顯示」，when 執行，then 該帳號不再顯示於主畫面，但設定與資料保留，之後可重新開啟繼續顯示，且不影響同類型其他帳號
- [ ] Given 取消追蹤為不可逆操作，when 使用者觸發此動作，then 必須經過二次確認（防呆），確認文案需明確指出操作對象是「這一個帳號」而非整個 AI 類型，避免誤刪錯帳號

### Story 8: 連線狀態異常提示

- **As a** 使用者
- **I want to** 在某個帳號的憑證/key 失效或過期時得到明確提示
- **So that** 我知道要去更新那個帳號的憑證，而不是誤判成「用量正常」，也不會誤以為是同類型其他帳號出問題

**Acceptance Criteria**:
- [ ] Given API key 被撤銷或格式錯誤，when 下次呼叫端點失敗，then 該帳號連線狀態轉為「失效」（橘），用量數字凍結在最後一次成功值並標示「非即時」
- [ ] Given token 到期，when 偵測到過期回應，then 該帳號連線狀態轉為「過期」（紅）
- [ ] Given 連線狀態為失效/過期，when 使用者查看，then 不得與「用量超額」的紅色狀態混淆——兩個狀態機獨立呈現（憲法 §4 兩個狀態機不可合併），且僅影響該帳號本身，不擴散到同 AI 類型的其他帳號（憲法 R5）

### Story 9（新增，2026-08-31）: 新增第二個同類型帳號

- **As a** 使用者
- **I want to** 在已有一個 DeepSeek 帳號的情況下，再新增第二個 DeepSeek 帳號（不同 API key）
- **So that** 我可以分別追蹤兩個帳號各自的剩餘額度，互不影響

**Acceptance Criteria**:
- [ ] Given 已有一個 DeepSeek 帳號存在，when 新增第二個 DeepSeek 帳號並輸入不同 API key + 暱稱，then 系統建立獨立的第二個帳號實體，兩者的連線狀態/用量/標籤互不影響（憲法 R5）
- [ ] Given 兩個 DeepSeek 帳號同時存在，when 其中一個被取消追蹤，then 另一個帳號的資料與顯示完全不受影響（憲法 §8，單位是帳號）
- [ ] Given 兩個同類型帳號並存，when 顯示於主畫面，then 依 §8 UI Flow 分組排列規則相鄰顯示

### Story 10（新增，2026-08-31）: 新增「Claude API key」帳號（同 AI 類型、不同存取類型並存）

- **As a** 使用者
- **I want to** 在已有 Claude 訂閱帳號的情況下，額外新增一個 Claude API key 帳號
- **So that** 我可以同時追蹤「Claude 訂閱的 5h/週用量」與「Claude API key 的剩餘額度」兩種完全不同計費方式的帳號

**Acceptance Criteria**:
- [ ] Given 已有一個 Claude 訂閱制帳號，when 新增一個 Claude API key 帳號，then 系統視為全新獨立帳號建立，不與既有訂閱帳號合併或衝突（憲法 R1：兩維度可自由組合，Decision 3）
- [ ] Given Claude 訂閱帳號顯示「時間窗口用量」術語、Claude API key 帳號顯示「剩餘額度」術語，when 兩者同時存在，then UI 上以各自對應的用量語意呈現，不可混用術語（憲法 §6）
- [ ] Given 兩個帳號同屬 Claude 這個 AI 類型但存取類型不同，when 顯示於主畫面，then 仍歸類在同一個 Claude 分組內（依 AI 類型分組，非依存取類型分組，見 §8 UI Flow）

### Story 11（新增，2026-08-31）: 重新命名帳號標籤

- **As a** 使用者
- **I want to** 把自動帶入的帳號標籤（如 email）或手動輸入的暱稱改成自己想要的名稱
- **So that** 當我有多個同類型帳號時，可以用好辨識的名字區分它們

**Acceptance Criteria**:
- [ ] Given 一個自動偵測到 email 當標籤的帳號，when 使用者選擇重新命名並輸入新名稱，then 標籤更新且不影響該帳號原本的連線狀態/用量資料（憲法 R5：「事後都可改名」）
- [ ] Given 一個手動輸入暱稱的 API key 帳號，when 使用者重新命名，then 同樣可成功更新，新舊名稱切換不需要重新驗證憑證
- [ ] Given 使用者嘗試將標籤留空儲存，when 送出，then 拒絕儲存並提示標籤不可為空（延續新增時「必須輸入暱稱」的防呆邏輯，憲法 R5）

## 5. 技術選型 (Tech Stack)

> 依 Step 2.1 優先級 2「既有專案偵測」鎖定 Angular / C# + Photino.NET；DB、REST API、監控等傳統 web 選項因架構本質（無伺服器）不適用，已誠實標註。**多帳號模型（2026-08-31 憲法修訂）不改變此表的技術棧選型**——變動集中在 §6 資料模型、§7 訊息契約與 provider 內部設計，本章僅在受影響列補充註記。

| 層 | 選型 | 理由 |
|---|---|---|
| Frontend | Angular ^22.1.0（standalone components，no SSR, no routing） | 既有專案偵測（`frontend/angular.json` 已存在），不改套 |
| Backend | C# + Photino.NET（`net10.0`，原生 WebView 桌面殼） | 既有專案偵測（`backend/*.csproj` 已存在）；**注意**：這不是傳統 web backend，沒有對外 HTTP API，只透過 WebView 訊息橋接跟前端溝通 |
| DB | **無** | 憲法 I1：本工具沒有伺服器，任何資料都不可離開使用者本機、不可上傳。機密資料（API key）走 OS Keychain（見下）；非機密資料（用量歷史）以本機檔案持久化，確切路徑見 §12 TODO |
| 憑證儲存 | **OS 原生 Keychain**（macOS Keychain Services / Windows Credential Manager） | 已拍板；業界標準，不用自己處理加密。**多帳號註記**：既有 `ISecretStore` 目前用單一 sourceId（如 `"deepseek"`）當 key，多帳號模型下需要能唯一識別「帳號」而非只是 AI 類型，確切 key 產生規則見 §6 TODO |
| Claude 用量來源（單帳號） | 打 Anthropic 官方（非公開 beta）用量端點 `GET /api/oauth/usage`，用 Claude Code 自己在本機的 OAuth session（讀 Keychain「Claude Code-credentials」，Windows/Linux 讀 `~/.claude/.credentials.json`），帶 `anthropic-beta: oauth-2025-04-20` header | 沿用既有拍板設計；沒有 `cswap` 時的唯一路徑，永遠只能讀到「當下登入的那一個」帳號 |
| Claude 用量來源（多帳號，**已查證，2026-08-31**） | 偵測本機是否安裝 `cswap`（`claude-swap`）；有的話 shell out 呼叫 `cswap list --json`（官方文件化的「JSON output for scripting」介面），一次拿到所有帳號的 email/5h/7d 百分比/重置時間；沒裝則退回上一列的單帳號直接呼叫 | 已查證：`cswap list --json` 回傳格式跟直接打官方 API 一致，已實測比對數字相符。**限制**：多帳號功能等於選用依賴 `cswap`，這是社群工具、非官方保證的介面（見 README「已知風險與揭露」） |
| Codex 用量來源（**已升級，2026-08-31**） | 打 ChatGPT 後端（非公開）用量端點 `GET https://chatgpt.com/backend-api/wham/usage`，用 Codex CLI 自己在本機的 ChatGPT 登入 session（`~/.codex/auth.json` 或 `$CODEX_HOME/auth.json`），帶 `Authorization: Bearer` + `chatgpt-account-id` header | 原本（M1/M2 初版）是 `ccusage codex` 估算 token 數。從 [`openai/codex` 官方 repo 的 bug report #10869](https://github.com/openai/codex/issues/10869) 發現這支非公開端點，實測打通並跟 ChatGPT 設定「使用情況」頁面（5 小時窗 + 每週窗）數字比對一致，改採這個做法。`isEstimated: false`。風險跟 Claude 那支同一類：非公開端點，OpenAI 可能無預告改版；壞掉的 fallback 是退回 ccusage 估算 |
| Grok 用量來源（**已查證，2026-08-31**） | 僅支援**訂閱制**（Grok Build CLI）：shell out 呼叫 `ccusage grok`，跟 Codex 一樣是本機 log 估算，`isEstimated: true` | 已查證：xAI 官方文件（`docs.x.ai`）沒有任何餘額/用量查詢端點，**API key 制目前技術上做不到**，使用者已拍板本期只做訂閱制（見 §3/§12） |
| Grok 訂閱制官方端點（Grok Build CLI，**查過但暫不實作，2026-08-31**） | 維持上一列的 `ccusage grok` 估算 | Grok Build **完全開源**（`github.com/xai-org/grok-build`），查到非公開端點 `GET cli-chat-proxy.grok.com/v1/billing?format=credits`，但認證需要 5 個 headers、本機憑證檔 `~/.grok/auth.json` 有多個 scope 不確定挑哪個、且沒有真實帳號能實測，不確定性明顯比 Claude/Codex/Kimi 高，故暫不實作，見 §12 |
| Kimi 訂閱制（**已新增，2026-08-31，⚠️ 未實測**） | 新 provider `KimiSubscriptionUsageProvider`（`SourceId: "kimi-subscription"`，跟既有 API key 制的 `"kimi"` 是同一 AI 類型的不同存取類型），打 `GET https://api.kimi.com/coding/v1/usages`，用本機 `~/.kimi-code/credentials/kimi-code.json` 的 OAuth session | 從**開源的 `MoonshotAI/kimi-code` repo**（`packages/oauth/src/managed-usage.ts`）直接讀出端點/認證/回應格式，信心程度高於 Grok（單一乾淨 header、官方 docs 頁部分佐證），但同樣沒有真實帳號可實測。**已知風險**：repo 的 `docs/en/reference/server-api.md` 文件另外記載一個不同端點 `/api/v1/oauth/usage`，本 provider 選用的是 CLI 自己實際呼叫的那支（信心來源不同但可能是兩個獨立功能），詳見程式碼註解 |
| Claude / Codex API key 制（**已查證不可行，2026-08-31**） | **不支援**，兩個 AI 類型都只保留原本的訂閱制入口，「API key 制」分區暫時只有 DeepSeek/Kimi | 已查證：Anthropic 的 Usage & Cost Admin API（`/v1/organizations/usage_report/messages`、`/cost_report`）與 OpenAI 的對應 API（`/v1/organization/usage/*`、`/costs`）都**需要 Admin API key**，文件明講「The Admin API is unavailable for individual accounts」「workspace API keys don't work」；業務 owner 實測自己的 workspace key 確認卡在同樣的限制。且**連「查詢目前剩餘額度」這個功能本身，Anthropic 目前都還沒有**（[官方 GitHub issue #47574](https://github.com/anthropics/claude-code/issues/47574) 是社群還在跟 Anthropic 要這個功能的 feature request，尚未實作）。唯一能拿到的資訊是一般 key 呼叫 `/v1/messages` 時回應帶的 `anthropic-ratelimit-*` headers（速率限制 headroom，非金額餘額），但取得方式是**真的花錢打一次 API**，跟本工具「唯讀監控、不主動使用服務」的定位衝突，判斷不值得做 |
| UI 庫 | **@sanring/ui**（透過 `@sanring/cli`，shadcn 體系、copy-in-repo） | 已拍板；元件已內建語意色 token（success/warn/error）直接對齊憲法 §4 三態顏色。本次追加需求：`collapsible`（卡片摺疊/展開）元件，需確認 `@sanring/ui` 是否已提供，若無則自製 |
| CSS | **Tailwind CSS v4（固定）** | sanring 唯一鎖定預設 |
| Cache | 無（單機應用） | 不適用伺服器快取情境；前端內狀態用 Angular Signals 於記憶體管理即可，跨 session 持久化見 §6 |
| Auth | **無傳統 Auth** | 憲法 I2：本工具在任何情況下都不執行登入流程、不索取或儲存帳號密碼。API key 制帳號的 key 僅本機儲存供工具自己呼叫官方端點，不是使用者對本工具的身分驗證 |
| Deploy | `dotnet publish` self-contained（macOS `.app` / Windows `.exe`），對應既有 `scripts/build.sh` | 桌面應用打包，非容器化，不適用 Docker/k8s/serverless |
| 監控 | **無**（不適用桌面小工具） | 若需除錯，改用本機 log 檔（TODO：格式與框架待定，見 §12） |

## 6. 資料模型 (Data Model)

> **不適用傳統關聯式 DB schema**——憲法 I1 明訂本工具無伺服器。以下改為「本機資料模型」描述。**2026-08-31 修訂**：原 `TrackedSource`（一個 AI 類型 = 一筆固定實體）改為 `TrackedAccount`（一個「帳號」才是實際被追蹤的實體，對應憲法 §6 術語表「帳號」定義），一個 AI 類型可對應 0..N 個帳號。確切的檔案格式/路徑/加密方式/ID 產生規則**尚未拍板，標 TODO**。

### 概念實體（非 SQL table，供實作對照）

```
AiType = "claude" | "codex" | "deepseek" | "kimi" | "grok"   // 可擴充，憲法 R1
AccessType = "subscription" | "api_key"                       // 不綁定特定 AiType，憲法 R1/Decision 3

TrackedAccount {                 // 原 TrackedSource 改名（2026-08-31 修訂），對應憲法「帳號」實體
  accountId: string              // 唯一識別「帳號」本身，非 AI 類型；產生規則見下方 TODO
  aiType: AiType
  accessType: AccessType
  label: string                  // 帳號顯示標籤
  labelSource: "auto_detected" | "manual"   // 憲法 R5：能自動偵測身份的自動帶入，偵測不到強制輸入
  connectionState: "not_configured" | "valid" | "invalid" | "expired"
  visible: boolean               // 對應憲法 §8「關閉顯示」，單位是帳號
  credentialRef: <TODO>          // API key 或 CLI/session 參照方式，key 需能唯一識別帳號，見下方 TODO
  createdAt: datetime
}

UsageSnapshot {
  accountId: string               // FK → TrackedAccount.accountId（概念上，非資料庫外鍵；原本是 sourceId，現指向帳號而非 AI 類型）
  capturedAt: datetime
  percentUsed: number
  usageState: "normal" | "near_limit" | "exceeded"
  isEstimated: boolean            // 憲法 R3/I3：true 時 UI 必須顯示「估算」
  raw: <TODO>                     // 來源原始數字（token 數 / 額度單位），格式依 aiType/accessType 而異
}

Settings {
  refreshIntervalMinutes: 5 | 60 | 120 | null   // null = 純手動
  retentionDays: 3 | 5 | 7 | null                // null = 手動清除
  nearLimitThresholdPercent: number              // 50–95，預設 80；全域單例，套用到所有帳號（未因多帳號拆分成逐帳號設定，憲法未要求）
}
```

### 主要實體與關係

- 一個 `AiType` 對應 0..N 個 `TrackedAccount`（多帳號模型核心，憲法 R1/R5，2026-08-31 修訂）
- 一個 `TrackedAccount` 對應 0..N 個 `UsageSnapshot`（歷史序列，依 `retentionDays` 定期清除）
- `Settings` 是全域單例，不屬於任何 `TrackedAccount`
- 取消追蹤（憲法 §8）= 刪除該 `TrackedAccount` 及其所有 `UsageSnapshot` 與 `credentialRef` 指向的憑證資料，**同 AiType 下其他 `TrackedAccount` 不受影響**（憲法 R5）
- 關閉顯示（憲法 §8）= 僅將 `TrackedAccount.visible` 設為 `false`，其餘資料原封不動

### DDD 邊界

- **Aggregate Root**: `TrackedAccount`（原 `TrackedSource`）
- **內部 Entity**: `UsageSnapshot`
- **Value Object**: `AiType`、`AccessType`、`ConnectionState`、`UsageState`、`LabelSource`（皆為列舉值，狀態相關的不可脫離憲法 §4 狀態機定義的合法轉換路徑被任意賦值）
- **跨 Aggregate 連結**: `Settings` 是獨立 aggregate，`UsageSnapshot` 讀取 `Settings.nearLimitThresholdPercent` 來推導 `usageState`，但不直接持有 `Settings` 物件

### TODO（本章節未拍板事項，不腦補）
- [ ] **憑證/API key 確切儲存格式**：明碼 JSON？OS 原生 keychain？是否加密？（已部分拍板走 Keychain，見 §5，但確切 entry naming 待下一條）
- [ ] **`credentialRef` / Keychain entry 的 key 產生規則**：目前 `ISecretStore` 用單一 sourceId 字串（如 `"deepseek"`）當 key；多帳號模型下需要能唯一識別「帳號」，例如 `{aiType}:{accessType}:{accountId}` 這種組合 key，確切格式未拍板
- [ ] **`accountId` 產生方式**：uuid v4？還是 `{aiType}-{accessType}-{序號}` 這種可讀格式？未拍板
- [ ] **儲存路徑**：例如 `~/Library/Application Support/UsageMonitor/`（macOS）與對應 Windows 路徑，尚未定案
- [ ] **本機資料實際檔案格式**：單一 JSON 檔 vs SQLite 單檔（注意：SQLite 單檔屬本機檔案，非「伺服器資料庫」，若採用需在此明確排除誤解為違反 I1）
- [ ] **既有單帳號模型資料遷移策略**：既有程式碼 4 個固定 sourceId（claude/codex/deepseek/kimi）的 Keychain 項目與 `AppSettings.HiddenSources: List<string>` 是以 AI 類型名稱為 key，多帳號模型改成以 `accountId` 為 key 後，既有使用者升級時如何映射（例如既有 `"deepseek"` 這筆資料要自動轉成一個 `accountId` 明確的 `TrackedAccount`）——未拍板，需在實作前另外規劃
- [ ] **`AppSettings` 中依 AI 類型命名的欄位需重新設計**：例如 `DeepSeekLowBalanceThresholdUsd` / `KimiLowBalanceThresholdUsd` 目前是「一個 AI 類型一個全域門檻」，與 R5「帳號彼此獨立」精神有潛在衝突（同類型的兩個帳號可能想設不同門檻）——是否要改成 per-account 設定，未拍板

## 7. 前後端訊息契約 (Message Contract)

> **不適用傳統 REST API 表格**——Photino.NET 沒有對外 HTTP endpoint，前後端透過 WebView 注入的 `window.external.sendMessage(json)` / `receiveMessage(json)` 做 JSON 訊息交換。**2026-08-31 修訂**：訊息語意單位從「來源（AI 類型）」改為「帳號」，`add-source` payload 改用 `aiType`/`accessType`/`label` 描述新增請求；`remove-source`/`set-visibility` 改用 `accountId` 定位操作對象；新增 `rename-account` 訊息類型對應憲法 R5「事後可改名」。

### 前端 → 後端（`sendMessage`）

| Type | Payload | 用途 |
|---|---|---|
| `get-usage-summary` | `{}` | 取得所有已追蹤帳號的最新用量摘要 |
| `add-source` | `{ aiType: 'claude'\|'codex'\|'deepseek'\|'kimi'\|'grok', accessType: 'subscription'\|'api_key', credential?: { apiKey?: string }, label?: string }` | 新增一個帳號（**修訂**：從「新增來源」改為「新增帳號」語意，同一 `aiType` 可重複呼叫以新增第 2、第 3 個帳號）。`accessType: 'api_key'` 時 `label` 必填（前端表單防呆）；`accessType: 'subscription'` 時 `label` 可選填（若使用者想覆蓋自動偵測結果），未填則由後端自動偵測（如讀到 email）。成功時回傳新建立的 `accountId` |
| `remove-source` | `{ accountId: string }` | 取消追蹤：後端需完整刪除該**帳號**本機憑證與歷史資料，同 `aiType` 下其他帳號不受影響（憲法 §8/R5，**修訂**：欄位從 `source` 改為 `accountId`） |
| `set-visibility` | `{ accountId: string, visible: boolean }` | 關閉/開啟顯示（憲法 §8，不刪除資料，**修訂**：欄位從 `source` 改為 `accountId`） |
| `rename-account`（**新增，2026-08-31**） | `{ accountId: string, newLabel: string }` | 重新命名帳號標籤，不論原本 `labelSource` 是 `auto_detected` 或 `manual` 皆可改；不影響連線狀態/用量資料（憲法 R5） |
| `update-settings` | `{ refreshIntervalMinutes?: number\|null, retentionDays?: number\|null, nearLimitThresholdPercent?: number }` | 更新刷新頻率/保留期/閾值（全域設定，未因多帳號拆分） |
| `get-settings` | `{}` | 取得目前設定值 |

### 後端 → 前端（`SendWebMessage` / `receiveMessage`）

| Type | Payload | 用途 |
|---|---|---|
| `usage-summary` | `{ data: UsageSummary[] }` | 回應 `get-usage-summary`，或自動刷新 timer 觸發時主動推送；陣列元素現在對應「帳號」而非「AI 類型」 |
| `source-added` / `source-removed` / `visibility-updated` / `settings-updated` | 依操作而定 | 操作結果回報，供前端更新 UI 並給使用者回饋 |
| `account-renamed`（**新增，2026-08-31**） | `{ accountId: string, label: string }` | 回應 `rename-account`，前端更新對應卡片標籤 |
| `error` | `{ error: string }` | 錯誤訊息 |

### `UsageSummary` payload 擴充提案（供實作對照，非最終定案）

```ts
interface UsageSummary {
  accountId: string;        // 原 source 欄位（2026-08-31 修訂：指向帳號而非 AI 類型）
  aiType: 'claude' | 'codex' | 'deepseek' | 'kimi' | 'grok';
  accessType: 'subscription' | 'api_key';
  label: string;
  labelSource: 'auto_detected' | 'manual';
  percentUsed: number;
  usageState: 'normal' | 'near_limit' | 'exceeded';
  connectionState: 'not_configured' | 'valid' | 'invalid' | 'expired';
  isEstimated: boolean;      // true 時前端必須顯示「估算」標記，憲法 R3/I3
  asOf: string;
}
```

> 注意：此 schema 與既有 `backend/Models/UsageSummary.cs`（目前 `source` 為固定字串如 `"claude"`）不相容，需要在實作階段一併改版；`backend/Program.cs` 目前的訊息路由（`get-usage-summary` / `add-source` / `remove-source` / `set-visibility`）以 sourceId 字串為單位分流，也需要改成以 `accountId` 分流，並在 `UsageService.cs` 中把「provider 清單寫死 4 個實例」改成「依 `aiType` 找對應 provider、依 `accountId` 找對應憑證與帳號 metadata」的設計（見里程碑 §10）。

## 8. UI 流程 (UI Flow)

> **2026-08-31 修訂**：新增「卡片依 AI 類型分組、同類型帳號相鄰、卡片可個別摺疊」的排列規則（使用者原話：「平常可能是 Claude/Codex/DeepSeek/Kimi/Grok 這樣顯示 5 張卡片，但如果有 Claude 多個帳號就會變成 Claude/Claude/Claude/Codex/DeepSeek/Kimi/Grok 這樣顯示」）。此規則屬 UI 呈現細節，不寫進憲法，僅存在於本 PRD。

主要畫面與四態（loading / empty / error / success）：

- **主畫面（帳號用量總覽）**
  - loading：刷新中顯示 spinner/骨架屏，不清空現有數字（避免畫面閃爍）
  - empty：尚無追蹤帳號，顯示引導文案 + 「新增帳號」CTA
  - error：本次刷新失敗（如 API key 制帳號端點逾時），保留最後一次成功數字並標示「非即時」，附錯誤原因；錯誤僅影響該帳號本身的卡片，不影響同類型其他帳號
  - success：
    - 卡片**依 AI 類型分組排列**（Claude / Codex / DeepSeek / Kimi / Grok 依序），**同一 AI 類型下的多個帳號卡片彼此相鄰**，不與其他 AI 類型交錯
    - 每張帳號卡片右上角有一個**摺疊/展開按鈕**（手風琴模式，比照 `@sanring/ui` 的 `collapsible` 元件），點擊可收合/展開該帳號卡片的詳細內容
    - 每張卡片含：帳號標籤、用量百分比條（依 usageState 上色）、估算標記、連線狀態圖示
    - 卡片摺疊時的預設狀態（展開 or 摺疊）**TODO**，見 §12
- **新增帳號畫面**
  - 流程改為兩層選單：先選 **AI 類型**（Claude/Codex/DeepSeek/Kimi/Grok），再選 **存取類型**（訂閱制 / API key 制）；`accessType: api_key` 時額外要求輸入暱稱（憲法 R5 強制項）
  - loading：呼叫官方端點驗證中，或讀取本機 CLI 紀錄/session 中
  - empty：（不適用，此頁固定顯示 AI 類型 × 存取類型的選單）
  - error：CLI log/session 找不到 / API key 格式錯誤 / 端點驗證失敗 / 暱稱未輸入，各自給不同錯誤文案
  - success：新增完成，導回主畫面並高亮新項目；若該 AI 類型已有其他帳號，新卡片插入到同分組內相鄰位置
- **設定畫面**：刷新頻率、保留期、接近上限閾值三個設定項，即時儲存即時生效（全域設定，不因帳號而異）
- **重新命名帳號 dialog**（**新增**）：輸入框預填目前標籤，儲存後即時更新卡片顯示，不需重新驗證憑證（憲法 R5）
- **取消追蹤確認 dialog**：明確文案告知「將永久刪除**這一個帳號**的憑證與歷史資料，無法復原」（措辭需明確是帳號層級而非整個 AI 類型），與「關閉顯示」的按鈕在視覺與文案上明顯區隔，避免誤觸

對應 Figma / design assets：**TODO**（本次 PRD 階段尚未決定 `design_output_mode`，需在確認階段反問使用者是否需要同步 Figma）

關鍵互動的 `data-testid` 預埋清單：
- 主要 CTA（新增帳號）：`add-account-cta`
- AI 類型分組容器：`account-group-{aiType}`
- 帳號卡片：`account-card-{accountId}`（**修訂**：原 `source-card-{sourceId}`）
- 卡片摺疊/展開按鈕：`card-collapse-toggle-{accountId}`（**新增**）
- 重新命名按鈕/輸入框：`rename-account-btn` / `account-label-input`（**新增**）
- 估算標記：`estimated-badge`
- 用量狀態色塊：`usage-state-indicator`
- 連線狀態圖示：`connection-state-indicator`
- 取消追蹤按鈕：`remove-source-btn`
- 關閉顯示按鈕：`toggle-visibility-btn`
- 設定表單欄位：`settings-refresh-interval` / `settings-retention-days` / `settings-threshold`
- 錯誤訊息容器：`error-banner`

## 9. 風險與相依 (Risks & Dependencies)

### 風險

| 風險 | 影響 | 緩解 |
|---|---|---|
| Photino.NET 無內建 tray API，工具需保持視窗開啟才能背景刷新 | medium | 本期不做 tray（見 §3 非範圍），刷新僅在視窗開啟時運作；於 UI 明確告知使用者此限制 |
| 各 CLI（Claude Code/Codex）的本機 log 格式可能隨官方版本更新而變動 | high | `UsageProvider` 介面抽象化各帳號解析邏輯，格式變動時只需改對應 provider 實作，不影響核心路由與 UI |
| API key 儲存方式（明碼/加密）尚未拍板，若明碼儲存有本機資安疑慮 | high | 見 §6 TODO，需在實作前另外拍板，必要時開 ADR |
| @sanring/ui 相對新興，元件成熟度可能不如傳統元件庫，且本次新增需求的 `collapsible` 摺疊元件是否已提供未經確認 | low-medium | Pin 版本，關鍵元件（progress bar/badge/dialog/collapsible）先驗證可用性，必要時自製 Tailwind 元件補位 |
| DeepSeek/Kimi/其他 API key 制帳號的官方用量 API 若變動或不穩定 | medium | provider 抽象化 + 逾時降級，失敗時沿用最後成功數字並標示非即時 |
| Claude 用量改打非公開 beta 端點（`/api/oauth/usage`），Anthropic 隨時可能改版或停用，且不是文件化的公開合約 | high | 已知風險，使用者已拍板接受；401/其他錯誤時明確回報「憑證過期，請重新登入」而非靜默壞掉；長期 fallback 是退回 ccusage 估算法 |
| Codex 用量改打非公開端點（`/backend-api/wham/usage`，**2026-08-31 新增**），OpenAI 隨時可能改版或停用，同樣不是文件化的公開合約 | high | 已知風險，同 Claude 的處理方式；401/403 時明確回報「憑證過期，請重新登入」；長期 fallback 是退回 ccusage 估算法 |
| **Kimi 訂閱制未實測就上線**（`KimiSubscriptionUsageProvider`，2026-08-31 新增）：端點/回應格式是讀開源碼推論出來的，沒有真實帳號驗證過，第一次真的有人用可能發現端點錯誤或欄位對不上 | medium | 失敗時回傳原始回應內容（截斷）方便除錯，不會靜默顯示錯誤數字；`connectionState` 會誠實顯示 invalid/not_configured 而非假裝成功 |
| **（已查證，2026-08-31）Grok 沒有 API key 制的官方查詢端點**：查了 xAI 官方文件（`docs.x.ai`），沒有找到任何餘額/用量端點 | high | 已拍板：本期 Grok 只做訂閱制（`ccusage grok`），API key 制標記為技術上不可行，非本期範圍（見 §3） |
| **（已查證，2026-08-31）Claude 多訂閱帳號需依賴選用外部工具 `cswap`**：`ClaudeAuthReader` 本身只能讀「當下登入的那一個」OAuth session；查證後確認 `cswap list --json` 是官方文件化的 scripting 介面，能一次取得多帳號資料，但**這代表多帳號功能等於間接依賴一個社群工具**，且跟我們自己直接呼叫的做法一樣，本質是打同一支 Anthropic 非公開端點（法律/ToS 風險已知，見 README「已知風險與揭露」） | high | 已拍板：有裝 `cswap` 走 `cswap list --json`；沒裝則維持單帳號限制並在 UI 明確告知使用者原因 |
| **（新增，2026-08-31）既有單帳號資料模型遷移**：既有程式碼以固定 sourceId（如 `"deepseek"`）為 key 的 Keychain 項目與 `AppSettings.HiddenSources` 等欄位，需重構為以 `accountId` 為 key 的多帳號模型，若處理不當可能導致既有使用者升級後既有帳號憑證遺失或無法對應 | medium-high | 見 §6 TODO，需在實作前規劃明確的遷移/映射策略，必要時提供一次性遷移腳本或啟動時自動偵測轉換 |

### 相依

- **上游**：
  - Claude Code / Codex CLI 本機使用紀錄檔的實際格式（可能需研究 `ccusage` 開源工具的解析邏輯）
  - DeepSeek / Kimi / 未來 Grok / Claude API key 等官方用量查詢端點的 API 文件
  - @sanring/ui 套件在目標 Angular 版本（^22.1.0）下是否提供 `collapsible` 元件
- **下游**：無其他內部團隊或服務受影響（單機獨立應用）

## 10. 里程碑 (Milestones)

> 依 Vertical Slice Planning：第一片必須是 tracer bullet（單一帳號端到端可運作鏈路），禁止先做完所有後端再做前端。**2026-08-31 修訂**：既有里程碑內容因多帳號重構有連動，但里程碑分片策略本身不變，僅在對應 milestone 內補充多帳號重構範圍。

| Milestone | 內容 | 驗收門檻 |
|---|---|---|
| M1 | Tracer bullet：`UsageProvider` 抽象定案（含 `aiType`/`accessType` 概念）、`TrackedAccount`/`UsageSummary` schema 改版、`UsageService.cs`/`Program.cs` 訊息路由改成以 `accountId` 為單位、Claude 一個帳號端到端跑通 | 開啟工具能看到 Claude 一個帳號的真實估算/官方數字，UI 三態顏色正確 |
| M2 | 補齊 Codex / DeepSeek / Kimi 三個 AI 類型的 provider 重構為可多帳號；新增 `GrokUsageProvider`（僅訂閱制，ccusage grok）；`ClaudeUsageProvider` 加上 `cswap` 偵測與 `cswap list --json` 多帳號路徑（技術方案已查證，見 §5/§9） | 四個既有 AI 類型皆可新增多個帳號並顯示狀態，訂閱制與 API key 制兩種新增流程都跑通；Grok 訂閱制帳號可新增；有裝 `cswap` 時能看到多個 Claude 帳號 |
| M3 | 設定持久化：刷新頻率 timer、保留期清除邏輯、閾值可調（維持全域單例設計） | 三項設定變更後行為符合 Story 4/5/6 的 Acceptance Criteria |
| M4 | 取消追蹤（完整刪除，單位帳號）與關閉顯示（保留資料，單位帳號）邏輯 + 二次確認 UI + 重新命名帳號功能 | Story 7/9/11 全數 Acceptance Criteria 通過，且憑證資料確認被刪除（人工驗證檔案系統），同類型其他帳號不受影響 |
| M5 | UI 分組排列 + 卡片摺疊/展開（`collapsible`）實作 | Story 1/9/10 中「同類型相鄰分組」「摺疊/展開」相關 Acceptance Criteria 通過 |
| M6 | 打包驗證：`scripts/build.sh` 產出 macOS `.app` 與 Windows `.exe`，各自開啟並完成一次刷新 | 兩平台 self-contained build 均可安裝執行、smoke test 通過 |

## 11. 後續追蹤 (Follow-ups)

- M6 上線後：實際使用 1–2 週後，review 估算值與官方數字的落差是否在可接受範圍（呼應憲法 Decision 1 的風險）
- 觀察是否需要系統匣常駐圖示（tray icon）——目前排除於本期範圍，若使用者回報「工具視窗常被關閉導致漏看警示」，應評估另開 PRD 增修或 ADR
- Phase 2 候選功能追蹤：多人共用帳號的用量拆分/歸屬標記（憲法 §1/§10 已拍板列為 Phase 2，非本期）
- **（已查證，2026-08-31）**Grok API key 制不支援、Claude 多帳號依賴 `cswap`——業務 owner 已確認這**不需要**回頭修訂憲法 R1/R5：兩維度模型本來就不要求每個 AI 類型的每種存取類型都要能實作，屬技術限制而非業務規則變動

## 12. 開放問題 (Open Questions)

> 憲法本身無懸而未決項目（§10：「目前無未拍板項目」）。以下是 PRD 技術翻譯階段新產生的技術問題；已拍板項目維持勾選狀態，2026-08-31 新增數項待查證問題，禁止腦補：

- [x] ~~API key / 憑證的本機儲存格式~~ —— **已拍板**：使用 OS 原生 Keychain，不明碼存本機檔案
- [x] ~~Claude Code / Codex 本機估算演算法~~ —— **已拍板**：shell out 呼叫 `ccusage`
- [x] ~~Codex 有沒有等同 Claude「5 小時窗」的配額概念~~ —— **已查證**：沒有，`ccusage codex` 只有 daily/monthly/session 累計
- [x] ~~DeepSeek/Kimi 用量怎麼算「百分比」~~ —— **已查證+設計**：兩家 API 只回報絕對餘額（USD），改用低額度警告門檻設計
- [x] ~~本機資料儲存路徑~~ —— **已實作+已修 bug（2026-08-31）**：`AppPaths.cs`，macOS `~/Library/Application Support/SanRingUsageMonitor/`、Windows `%AppData%\SanRingUsageMonitor\`。**踩過一次真的 bug**：一開始誤用 `SpecialFolder.Personal`（macOS 上實際指向 `~/Documents`，不是 home），已改用 `.UserProfile` 修正
- [ ] TODO: 「時間窗口用量」（5 小時滾動窗 / 每週）的重置時間點計算規則，需要官方文件佐證
- [ ] TODO: 背景 timer 在應用視窗被最小化（非關閉）時是否持續運作？Photino 生命週期細節待驗證
- [ ] TODO: 本機除錯 log 檔的格式、路徑、是否也適用 §9 保留期規則
- [ ] TODO: `design_output_mode` 尚未與使用者確認（`assets_only` 還是需同步 Figma）
- [ ] TODO: Kimi 有 `platform.kimi.ai`/`kimi.com` 與 `platform.moonshot.ai`/`.cn` 兩組互不相通的帳號體系，是否要讓 base URL 可設定，待確認
- [x] ~~Grok 用量查詢技術方案~~ —— **已查證（2026-08-31）**：無官方 API key balance 端點；訂閱制走 `ccusage grok`，API key 制不支援（見 §3/§5/§9）
- [ ] TODO（**新增，2026-08-31**）：**Kimi 訂閱制需要真實帳號驗證** —— `KimiSubscriptionUsageProvider` 已寫但未測，需要有人申請 Kimi Code 帳號實際跑一次確認端點/欄位對不對（見 §5/§9）
- [ ] TODO（**新增，2026-08-31**）：**Grok 訂閱制官方端點要不要做** —— 已查到非公開端點但不確定性較高（多 headers、scope 選擇不明），目前擱置，等有真實 Grok Build 帳號能測再評估（見 §5）
- [x] ~~Claude 多訂閱帳號技術上如何同時讀取兩組 OAuth session~~ —— **已查證（2026-08-31）**：靠選用外部工具 `cswap`（`cswap list --json`），沒裝則維持只能讀「當下登入的那一個」的限制（見 §5/§9，法律/ToS 揭露見 README）
- [x] ~~Claude / Codex API key 制可不可行~~ —— **已查證不可行（2026-08-31）**：兩家官方 Admin 用量/成本 API 都排除個人帳號、workspace key 打不進去（業務 owner 實測自己帳號確認）；「查詢剩餘額度」這個功能 Anthropic 自己都還沒做（[GitHub issue #47574](https://github.com/anthropics/claude-code/issues/47574) 仍是待實作的 feature request）；一般 key 唯一拿得到的 `anthropic-ratelimit-*` headers 是速率限制而非金額餘額，且要花錢打一次 API 才能拿到，跟本工具「唯讀不主動使用服務」的定位衝突，判定不值得做（見 §3/§5）
- [ ] TODO（**新增，2026-08-31**）：**卡片摺疊/展開的預設狀態**（展開 or 摺疊）——使用者原話僅描述互動機制（點右上角 V），未拍板預設值
- [ ] TODO（**新增，2026-08-31**）：`credentialRef` 的 key 產生規則與 `accountId` 產生方式（見 §6）
- [ ] TODO（**新增，2026-08-31**）：既有單帳號模型資料（4 個固定 sourceId）遷移到新多帳號模型的策略（見 §6/§9）
- [ ] TODO（**新增，2026-08-31**）：`AppSettings` 中依 AI 類型命名的欄位（如 `DeepSeekLowBalanceThresholdUsd`）是否要改成 per-account 設定（見 §6）
