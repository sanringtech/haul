# AI 用量查詢可行性盤點

主流 AI 工具的訂閱方案 + API key 能不能查到用量/餘額，作為決定要不要新增來源的依據。**技術可行性一律要反查真實端點行為才算數，不能用猜的**——這是這個專案從 Claude/Codex 那次就一路堅持的規矩，見 [`ARCHITECTURE.md`](ARCHITECTURE.md)。

最後更新：2026-09-03。訂閱方案/價格會變，這裡記錄的是查證當下的快照，之後要用請重新確認。

## Claude 視窗「懶初始化」行為 + 喚醒用量視窗（2026-09-02，已實測）

實測發現：Claude 的 5 小時／7 天用量視窗**不是帳號開通就開始跑**，是懶初始化的——帳號（或視窗週期到期後）如果沒有送過訊息，`/api/oauth/usage` 回傳 `utilization: 0`、`resets_at: null`，跟 claude.ai 網頁上「Starts when a message is sent」是同一個狀態，不是資料抓錯或帳號壞掉。跟一份使用者自己的匯出紀錄比對過：同一個帳號前一天還有 29~59% 的真實用量，隔天視窗到期後就會回到這個「尚未開始」狀態，直到下一則訊息送出才重新啟動。

**因此「喚醒」一個視窗的方法就是送一則真的訊息**，已經直接打通驗證：

```
POST https://api.anthropic.com/v1/messages
Authorization: Bearer <cswap 存在 Keychain 的 Claude Code OAuth accessToken>
anthropic-version: 2023-06-01
anthropic-beta: oauth-2025-04-20
Content-Type: application/json

{"model": "claude-haiku-4-5-20251001", "max_tokens": 8, "messages": [{"role": "user", "content": "hi"}]}
```

回應 HTTP 200，真的收到模型回覆，`usage: {input_tokens: 8, output_tokens: 8}`——代價很小但**是真的消耗額度**，跟查用量狀態的唯讀端點是完全不同性質的呼叫（見下方「Claude 用量喚醒」功能，設定頁的開關）。認證方式（`Authorization: Bearer` + `anthropic-beta: oauth-2025-04-20`）跟 `ClaudeUsageProvider` 打 usage 端點是同一套，只是端點換成 `/v1/messages`、多一個 `anthropic-version` header。

## Codex 視窗「第一次 request 才開始」——查證結論（2026-09-02，**不做 ping**）

跟 Claude 不一樣，**不要做 Codex 喚醒 ping**。

**產品行為（官方 + 社群，對得上）**：

- OpenAI Help（付費 reset）：新的 weekly 用量週期「starts with your first request in Work or Codex after the reset is applied」——錨在**第一次 request**，不是日曆邊界，也不是「打開用量頁」。
- GitHub [openai/codex#28246](https://github.com/openai/codex/issues/28246)：5h / 7d 視窗都會錨在 reset 之後的第一次使用；有人因此寫 keepalive。這正是 Claude 喚醒在 Anthropic 那邊要做的事，但在 Codex 會**改掉下次重置時間**（晚用就晚重置，等於丟掉已付的空窗）。
- GitHub [openai/codex#27788](https://github.com/openai/codex/issues/27788)：有 Plus 使用者回報**只打開 Codex app 看用量、沒打字**，5h 視窗就顯示「現在 + 5 小時」。Codex 啟動時會 prefetch `account/rateLimits/read`——「看用量」本身可能已經算一次 request。Haul 每次刷新打的 `GET chatgpt.com/backend-api/wham/usage` 是同一類唯讀查詢，**不確定會不會自己把視窗叫醒**；在沒有閒置帳號可對照前，不另外再送訊息。

**本機實測（這台已在用的 Plus 帳）**：`--print-usage` 回 `used_percent` 1% / 15%，兩窗都有非 0 的 `reset_at`。閒置態（0% 且沒有 reset）這台觀察不到，因為視窗已經在跑。

**跟 Claude 喚醒的差別**：Claude 的 GET `/api/oauth/usage` 在沒送過訊息時回 `resets_at: null`，**看用量不會開窗**；要開窗才需要 POST `/v1/messages`。Codex 是 first-request 錨點，再 ping 一則訊息會消耗額度，還可能把 5h/7d 重置時間往後推。結論：**不實作 Codex ping**。

## 已支援（見 [`ARCHITECTURE.md`](ARCHITECTURE.md) / [`RISKS.md`](RISKS.md)）

| AI | 訂閱方案 | API key 查用量/餘額 | app 內狀態 |
|---|---|---|---|
| **Claude**（Anthropic）| Free / Pro $20 / Max 5x $100 / Max 20x $200 / Team / Enterprise | ❌ 已查證不可行 | ✅ 訂閱制（含多帳號，靠 cswap）。方案標籤（Pro/Max）也接上了——`cswap list --json` 本身沒有這欄位，但每個帳號的完整憑證（含 `subscriptionType`）原封不動存在 macOS Keychain（service `claude-swap`，帳號名 `account-{number}-{email}`，讀 cswap 原始碼查到的），直接讀那個 |
| **Codex**（OpenAI/ChatGPT）| Free / Plus $20 / Pro $200 / Team / Enterprise | ❌ 已查證不可行 | ✅ 訂閱制 + 方案標籤（`plan_type` 欄位，2026-09-01 接上，之前查證有這欄位但沒解析，現在真的顯示了） |
| **DeepSeek** | 無分層方案，純預付額度 | ✅ 官方 balance API 可用 | ✅ API key 制 |
| **Kimi**（Moonshot AI）| 消費端助理方案 Free ～ $199/mo「Vivace」 | ✅ API key 制官方 balance／訂閱制：本機有 Kimi Code 登入；reader 已改讀 `kimi-code-env-*.json`；2026-09-02 打 `GET api.kimi.com/coding/v1/usages` 回 **401**（access token 過期約 61h）。Haul **不**自己 refresh（refresh token 近乎一次性，不能寫回 CLI 檔）。請在 Kimi Code 裡用一次讓 CLI 換票後再新增來源 | ✅ API key 已支援；訂閱制路徑已接上、等 CLI 換票 |
| **Cursor**（AI 編輯器）| Hobby Free / Pro $20 / Pro+ $60 / Ultra $200 / Teams $40/user / Enterprise | 未評估（不是「用 API key」這種模式，讀本機登入 session） | ✅ 訂閱制（2026-09-01 新增，已實測，含方案標籤——`stripeMembershipType` 本機就有）。完整查證見下方段落 |
| **Grok**（xAI）| Free / SuperGrok Lite $10 / SuperGrok $30 / SuperGrok Heavy $300，或走 X 訂閱包（X Premium $8 / X Premium+ $40） | ❌ 已查證沒有查詢端點 | 🟡 **訂閱制已接上、等 `grok login` 實測**（2026-09-03：讀 `~/.grok/auth.json`，打 grok-build 自己的 `GET cli-chat-proxy.grok.com/v1/billing?format=credits`。不包 ccusage、不寫回登入檔。本開發機還沒裝 Grok CLI） |

## 查證過但還沒支援

| AI | 訂閱方案 | API key 查用量/餘額 | 結論 |
|---|---|---|---|
| **Gemini**（Google）| Google AI Pro/Ultra（原 Google One AI Premium）| ❌ 沒有公開端點——Gemini CLI 的 `/stats` 只顯示當次 session、不是帳號總量；個人 API key 沒有對應的用量查詢 REST 端點，只能上 AI Studio 網頁看 | 死路，跟 Claude/Codex 同類型限制 |
| **GitHub Copilot** | Individual、Business、Enterprise（2026 起從 premium request 制改成 usage-based AI Credits） | ❌ 個人層級沒有——`GET /orgs/{org}/copilot/metrics` 只給組織層級、要 admin 權限，個人 token 查不到自己的用量配額 | 死路 |
| **Perplexity** | Pro ~$20/mo | ❌ 官方文件沒有描述任何查詢端點，只能上 API Portal 網頁看 | 死路（沒找到反查社群方案，但也沒證據說做得到） |
| **Cursor**（AI 編輯器）| Hobby Free / Pro $20 / Pro+ $60 / Ultra $200 / Teams $40/user / Enterprise | ✅ **已實測打通**，見下方完整記錄 | **可以做，架構跟 Claude/Codex 單帳號路徑一樣，不是多帳號那類複雜度** |

## Cursor——已實測打通（2026-09-01）

直接讀本機真實的 `state.vscdb` 實測，比原本查到的社群方案更好：

**本機 session 存放位置**：SQLite 資料庫（`ItemTable`），不是 Keychain 也不是純文字 JSON：
- macOS：`~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- Windows（未驗證，比照慣例）：`%APPDATA%\Cursor\User\globalStorage\state.vscdb`
- Linux（未驗證）：`~/.config/Cursor/User/globalStorage/state.vscdb`

relevant keys：`cursorAuth/accessToken`（JWT）、`cursorAuth/cachedEmail`、`cursorAuth/stripeMembershipType`（**方案名稱就直接存在本機，不用打 API**，實測值是 `"pro"`）、`cursorAuth/stripeSubscriptionStatus`（`"active"`）。

**access token 是 JWT，可以直接解 payload 拿到過期時間**（`exp` claim），不用打任何端點就知道還有沒有效——實測目前這組還有近 8 週效期（`iss: https://authentication.cursor.sh`，`sub: google-oauth2|user_xxx` 就是 userId）。**不像 Claude 多帳號那個問題**——Cursor 只有一個「目前登入中」的 session。2026-09-02 再查過 `state.vscdb`：`cursorAuth/*` 共 8 個 key，都是單數（一份 accessToken / cachedEmail / stripeMembershipType），沒有第二個帳號槽。跟 Claude/Codex「擷取目前 CLI 登入、換帳再擷取」不是同一類問題，**不做 Cursor 多帳擷取**。

**用量端點，實測打通，完整 JSON（不是 gRPC binary framing，用 Connect Protocol 的 JSON 傳輸模式）**：

```
POST https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage
Authorization: Bearer <cursorAuth/accessToken>
Content-Type: application/json

{}
```

真實回應（帳號資訊已略）：
```json
{
  "billingCycleStart": "1787811190000",
  "billingCycleEnd": "1790489590000",
  "planUsage": {
    "totalSpend": 167,
    "includedSpend": 167,
    "remaining": 1833,
    "limit": 2000,
    "totalPercentUsed": 0.3373737373737374
  },
  "displayThreshold": 200,
  "displayMessage": "You've used 8% of your included usage"
}
```

**⚠️ 欄位語意有陷阱，不要照字面猜**：`totalPercentUsed = 0.337`，但 `displayMessage` 講的是「用了 8%」——兩個對不上。實測 `totalSpend / limit = 167 / 2000 = 8.35%`，四捨五入正好等於 `displayMessage` 講的 8%，`totalPercentUsed` 這個欄位量的顯然是別的東西（可能是某個 model bucket 專屬的百分比，不是整體）。**寫 parser 時百分比要用 `totalSpend / limit` 自己算，不要直接吃 `totalPercentUsed`**——這正是查證不能只看「有沒有這個欄位」，要連語意都對過才算數的例子。`limit`/`totalSpend`/`remaining` 單位是**美分**（`limit: 2000` = Pro 方案的 $20 額度，完全對得上）。`billingCycleEnd`（unix ms）就是重置時間，跟 Claude/Codex 的 `resetsAt`/`reset_at` 概念一樣。

`GET https://cursor.com/api/auth/stripe`（Bearer 或 Cookie 都測過能用）也有方案資訊（`membershipType`/`subscriptionStatus`/`isYearlyPlan`），但既然 SQLite 裡的 `stripeMembershipType` 本機快取就有，不用特地多打一次。

**下一步（要做的話）**：加 `Microsoft.Data.Sqlite` NuGet 套件（全新依賴，其他 provider 都沒用過）、寫 `CursorAuthReader`（讀 SQLite + 解 JWT payload 判斷過期）、寫 `CursorUsageProvider`（打上面那支端點，百分比自己算不要用 `totalPercentUsed`）。

## Claude 多帳號自實作（不依賴 cswap）——查證結果（2026-09-01）

使用者問「能不能自己寫一套取代 cswap」，直接讀本機安裝的 `claude-swap` 0.25.0 原始碼（pipx 裝的，路徑
`~/Library/Application Support/pipx/venvs/claude-swap/lib/python3.14/site-packages/claude_swap/`）查證：

**OAuth refresh 端點是真的，協定已經完整挖出來**（`oauth.py` `try_refresh_oauth_credentials`）：

```
POST https://platform.claude.com/v1/oauth/token
Content-Type: application/json

{"grant_type": "refresh_token", "refresh_token": "<存起來的>", "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e"}
```

回應：`access_token` + `expires_in`（秒）+ 可能換新的 `refresh_token`。`client_id` 是 Claude Code CLI 自己的公開
OAuth client id（cswap 反查出來的常數，不用另外申請）。錯誤要分三種：`invalid_grant`（token 死了，要求重新登入，
永久性）／`invalid_client`（我們自己的 client_id 被拒，跟帳號無關，不算這個 slot 的錯）／其他都當暫時性、值得重試。

**這比重造整個 cswap 好做，因為 app 不需要 cswap 的核心功能（切換帳號）**——`switcher.py` 一支檔案就 7000+ 行，
大部分是「讓某組帳號變成 Claude Code CLI 目前使用中的那組」這個功能，app 完全用不到，只需要「唯讀輪詢 N 組
存起來的憑證各自的用量」。拆解後要做的：① 多組憑證快照存 Keychain（沿用 DeepSeek/Kimi 現有的 per-account 存法）
② 上面這支 refresh 邏輯 ③ 用量查詢（`ClaudeUsageProvider` 現有邏輯直接套用，不用重寫）④ 簡化版錯誤分類（不用
cswap 那套 strike/quarantine 機制）⑤ 新增帳號的 UI 流程（使用者自己在終端機切換登入，app 端「擷取目前這組」存
快照）。**結論**：技術上不再是黑盒子，但仍是實質工程量，還沒動手实作，是否值得做取決於多帳號使用者的比例。

## 企業／團隊帳號的真實使用情境（2026-09-01）

使用者問「Claude 如果是企業帳號，是每人都綁 Gmail 處理嗎？」——查了 Anthropic/OpenAI 官方文件後的結論：**不是，企業帳號的身份不是「綁 Gmail」這種說法能涵蓋的**，而且這牽涉到這個 app 的核心假設（只讀本機 CLI 自己登入產生的 session），值得記下來。

**Claude 的三種登入情境**：
1. **個人 Pro/Max**——一般 email 登入（常見 Gmail，但不限定），`claude` CLI 走瀏覽器 OAuth，token 存本機 Keychain。這是這個 app 現在主打、也是唯一實測過的情境。
2. **Team/Enterprise，沒開強制 SSO**——用「被管理員邀請進去的 Claude.ai 帳號」登入，CLI 端一樣是「選 Claude account with subscription → 走 OAuth → Authorize」同一套流程，本機一樣會生出同一種 OAuth token、存在同一個 Keychain 位置。**理論上這個 app 現有的讀取方式應該一樣抓得到，但沒有實測過**。
3. **Team/Enterprise，開了「domain capture」+ 強制 SSO**——企業網域的 email 登入會被自動導去公司 IdP（Okta/Entra ID/Google Workspace/Auth0 等），**擋掉個人帳號回退**，使用者身份是走公司 SSO，CLI 本機能不能生出這個 app 讀得懂的 OAuth token，沒有查證過。

**未驗證的風險點**：即使情境 2 的本機 token 抓得到，這個 app 打的 `/api/oauth/usage`（非官方端點）對 Team/Enterprise 的「額度池」用量，回傳格式/語意是否跟個人 Pro/Max 一樣，完全沒查證過。

**Codex（ChatGPT）更明確地卡關**：查到一個已知的官方 issue——**ChatGPT Business/Enterprise 開了「Enforce SSO」時，`codex login` 目前會壞掉**（見下方 Sources），是 Codex CLI 本身的 bug，不是這個 app 的問題。這批使用者現在連本機登入都做不到，這個 app 自然也拿不到資料。

**實務情境整理**：

| 情境 | 這個 app 現在能不能用 |
|---|---|
| 個人 Pro/Max（含多個人帳號用 cswap 切換）| ✅ 已支援，主要目標族群 |
| 一人身兼「個人 Pro/Max + 公司 Team 席位」，兩邊都在本機登入 | ⚠️ 理論上可行（cswap 架構本來就是多帳號），但 Team 席位的用量端點語意沒驗證過 |
| Team/Enterprise 但沒開強制 SSO | ⚠️ CLI 登入流程一樣，本機 token 應該抓得到，語意未驗證 |
| Team/Enterprise 開了強制 SSO（domain capture）| ❌ 個人帳號登入直接被擋；Codex 這邊 CLI 登入本身還有已知 bug |

**結論**：這個 app 的架構本質上只能讀「本機 CLI 自己登入產生的 session」，天生是**個人視角**的工具——沒有 admin API 存取權，SSO 帳號很多情況下連本機都登不進去，不該假裝能做團隊管理員視角的東西。目標族群清楚是「個人開發者／自由接案者，管理自己（可能好幾個）的訂閱額度」。

## 候選清單（未查證，待反查真實端點才能升級進上面的表格）

使用者提議、但還沒有對真實端點做過任何驗證的名單，先記下來當 backlog，不代表技術可行——按這份文件的規矩，沒反查過就不能寫「✅/❌」結論。

**CLI 訂閱類**（同一類「偵測本機已登入帳號」的架構，還沒查過本機憑證存放位置、有沒有唯讀用量端點）：
- Qwen Code（阿里通義千問的 CLI coding agent）
- Aider（開源、可接多種底層模型的 CLI coding assistant——因為不綁定單一 AI 廠商，「用量」概念可能要另外設計）
- Amazon Q Developer CLI
- OpenCode / Continue CLI（開源 agentic coding 工具）

**API Key 類**（還沒查過官方是否有 balance／用量查詢端點）：
- OpenAI 直接 API key（跟 Codex CLI 訂閱制是不同路徑，要分開評估）
- Anthropic 直接 API key（跟 Claude Code CLI 訂閱制是不同路徑，要分開評估）
- 智譜 GLM（Zhipu AI）
- Mistral
- 通義千問 Qwen API
- 零一萬物 Yi

## Sources

- [How can I check my requests per day remaining? · google-gemini/gemini-cli Discussion #3096](https://github.com/google-gemini/gemini-cli/discussions/3096)
- [Gemini CLI: Quotas and pricing](https://geminicli.com/docs/resources/quota-and-pricing/)
- [Monitoring your GitHub Copilot usage and entitlements (legacy) - GitHub Docs](https://docs.github.com/copilot/how-tos/monitoring-your-copilot-usage-and-entitlements)
- [Usage-based billing for individuals - GitHub Docs](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals)
- [analyzing usage over time with the copilot metrics api - GitHub Docs](https://docs.github.com/pt/enterprise-cloud@latest/copilot/managing-copilot/managing-github-copilot-in-your-organization/reviewing-activity-related-to-github-copilot-in-your-organization/analyzing-usage-over-time-with-the-copilot-metrics-api)
- [Perplexity API docs — pricing/getting started](https://docs.perplexity.ai/getting-started/pricing)
- [Perplexity API: Purchased credits, balance still shows "$0" (community forum)](https://community.perplexity.ai/t/perplexity-api-purchased-credits-balance-still-shows-0/3185)
- [Tendo33/cursor-usage-tracker (GitHub)](https://github.com/Tendo33/cursor-usage-tracker)
- [Cursor APIs Overview | Cursor Docs](https://cursor.com/docs/api)
- [Cursor AI Pricing 2026 | All 6 Plans, Credits, and True Cost](https://www.lowcode.agency/blog/cursor-ai-pricing)
- [Grok Pricing 2026: SuperGrok $30, Heavy $300 & API Costs](https://www.ai-toolbox.co/grok-models/grok-pricing-plans-api-2026)
- [Kimi K3 Pricing (August 2026) | BenchLM.ai](https://benchlm.ai/moonshot/api-pricing)
- [Kimi AI Pricing 2026: Plans, Membership Cost & API Token Rates](https://kimik2ai.com/pricing/)
- [Use Claude Code with your Team or Enterprise plan | Anthropic Help Center](https://support.claude.com/en/articles/11845131-use-claude-code-with-your-team-or-enterprise-plan)
- [SSO login | Anthropic Help Center](https://support.claude.com/en/articles/14503613-sso-login)
- [Set up single sign-on (SSO) | Anthropic Help Center](https://support.claude.com/en/articles/13132885-set-up-single-sign-on-sso)
- [Claude Enterprise Security: A Complete Guide to Governing Claude Code at Scale — TrueFoundry](https://www.truefoundry.com/blog/claude-enterprise-security)
- [codex login didn't support ChatGPT SSO · Issue #5553 · openai/codex](https://github.com/openai/codex/issues/5553)
- [Authentication | ChatGPT Learn](https://learn.chatgpt.com/docs/auth)
