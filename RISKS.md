# 已知風險與揭露

發布給其他人用之前請先讀這份。

本工具的部分功能依賴**非官方、非文件化的介面**，不是 Claude/DeepSeek/Kimi 官方保證會一直支援的公開合約：

- **Claude 用量（`ClaudeUsageProvider`）**：直接呼叫 Anthropic 內部/beta 用量端點 `GET /api/oauth/usage`（帶 `anthropic-beta` header），用的是 Claude Code 自己在本機的 OAuth session。這不是文件化的公開 API，Anthropic 可能無預告改版或停用。
- **Codex 用量（`CodexUsageProvider`）**：同樣直接呼叫 OpenAI/ChatGPT 內部端點 `GET https://chatgpt.com/backend-api/wham/usage`，用的是 Codex CLI 自己在本機的 ChatGPT 登入 session。一樣不是文件化的公開 API，OpenAI 可能無預告改版或停用。
- **Kimi 訂閱制（`KimiSubscriptionUsageProvider`，2026-08-31 新增，⚠️ 未實測）**：同一類做法，打 `GET https://api.kimi.com/coding/v1/usages`，用 Kimi Code CLI 本機的 OAuth session。這次是從**開源的 `MoonshotAI/kimi-code` repo 原始碼**直接讀出來的，不是猜的，但專案裡沒有人有真實 Kimi Code 帳號可以實測——第一次真的有人用時才會知道對不對，失敗時會把原始回應內容顯示出來方便除錯。
- **Claude/Codex 官方「API key 制」用量查詢已查證不可行**（2026-08-31）：兩家的官方 Admin 用量/成本 API 都排除個人帳號、workspace/一般 key 打不進去；「查詢剩餘額度」這個功能本身 Anthropic 目前甚至都還沒實作（見 [`anthropics/claude-code` issue #47574](https://github.com/anthropics/claude-code/issues/47574)）。詳見 PRD §5/§9/§12。
- **Claude 多帳號（2026-08-31 實作完成）**：依賴選用的外部工具 [`claude-swap`](https://pypi.org/project/claude-swap/)（`cswap`）——沒裝 `cswap` 只能看到「目前登入中」的那一個 Claude 帳號；有裝的話「＋ 新增來源」點 Claude 會一次偵測、加入 `cswap list --json` 回報的所有帳號（用 email 識別，不是 cswap 的 account number），已經追蹤過的自動跳過。用使用者自己真實的帳號+既有設定檔實測過，含一個關鍵邊界情況：升級前留下的舊版單帳號紀錄會原地升級成新的 email 格式（保留使用者改過的名稱），不會變成兩張卡片重複顯示同一個帳號。
- **ccusage / cswap 都是 MIT 授權的開源工具**，本工具只是在執行期呼叫使用者自行安裝的獨立程式（不是把它們的原始碼包進本工具），授權合規負擔低；但呼叫 Anthropic 非公開端點的 ToS 風險，不會因為透過 `cswap` 或直接呼叫而有差別——兩者本質上打的是同一支端點。
- 這些都是**已知、已評估過的取捨**（本機不儲存資料、不繞過任何付費牆、只讀取使用者自己有權查看的自身帳號用量），但仍建議：**若要發布給其他開發者使用，先明確告知他們這個依賴，不要包裝成「官方支援」**；若考慮更大規模發布/商業化，建議找律師檢視 Anthropic 的 API 使用條款。本專案作者不對此提供法律保證。
