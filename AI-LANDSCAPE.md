# AI 用量查詢可行性盤點

主流 AI 工具的訂閱方案 + API key 能不能查到用量/餘額，作為決定要不要新增來源的依據。**技術可行性一律要反查真實端點行為才算數，不能用猜的**——這是這個專案從 Claude/Codex 那次就一路堅持的規矩，見 [`ARCHITECTURE.md`](ARCHITECTURE.md)。

最後更新：2026-09-01。訂閱方案/價格會變，這裡記錄的是查證當下的快照，之後要用請重新確認。

## 已支援（見 [`ARCHITECTURE.md`](ARCHITECTURE.md) / [`RISKS.md`](RISKS.md)）

| AI | 訂閱方案 | API key 查用量/餘額 | app 內狀態 |
|---|---|---|---|
| **Claude**（Anthropic）| Free / Pro $20 / Max 5x $100 / Max 20x $200 / Team / Enterprise | ❌ 已查證不可行 | ✅ 訂閱制（含多帳號，靠 cswap） |
| **Codex**（OpenAI/ChatGPT）| Free / Plus $20 / Pro $200 / Team / Enterprise | ❌ 已查證不可行 | ✅ 訂閱制。`plan_type` 欄位其實在 raw response 裡（2026-09-01 實測 `"plan_type": "plus"`），只是目前沒解析出來顯示 |
| **DeepSeek** | 無分層方案，純預付額度 | ✅ 官方 balance API 可用 | ✅ API key 制 |
| **Kimi**（Moonshot AI）| 消費端助理方案 Free ～ $199/mo「Vivace」（音樂速度命名，中間層級名稱沒查全，見下方 Sources 自行核對）；企業方案 2026-08-04 起改成「聯繫銷售」不公開報價 | ✅ 官方 balance API 可用（API key 制）／訂閱制端點 ⚠️ 未實測 | ✅ 兩種都有 |
| **Grok**（xAI）| Free / SuperGrok Lite $10 / SuperGrok $30 / SuperGrok Heavy $300，或走 X 訂閱包（X Premium $8 / X Premium+ $40） | ❌ 已查證沒有查詢端點 | ✅ 訂閱制（ccusage） |

## 查證過但還沒支援

| AI | 訂閱方案 | API key 查用量/餘額 | 結論 |
|---|---|---|---|
| **Gemini**（Google）| Google AI Pro/Ultra（原 Google One AI Premium）| ❌ 沒有公開端點——Gemini CLI 的 `/stats` 只顯示當次 session、不是帳號總量；個人 API key 沒有對應的用量查詢 REST 端點，只能上 AI Studio 網頁看 | 死路，跟 Claude/Codex 同類型限制 |
| **GitHub Copilot** | Individual、Business、Enterprise（2026 起從 premium request 制改成 usage-based AI Credits） | ❌ 個人層級沒有——`GET /orgs/{org}/copilot/metrics` 只給組織層級、要 admin 權限，個人 token 查不到自己的用量配額 | 死路 |
| **Perplexity** | Pro ~$20/mo | ❌ 官方文件沒有描述任何查詢端點，只能上 API Portal 網頁看 | 死路（沒找到反查社群方案，但也沒證據說做得到） |
| **Cursor**（AI 編輯器）| Hobby Free / Pro $20 / Pro+ $60 / Ultra $200 / Teams $40/user / Enterprise | 🟡 **有機會**——找到社群反查出來的端點：`GET https://cursor.com/api/usage?user={userId}`（帶 `WorkosCursorSessionToken={userId}::{accessToken}` cookie），另外 `GET https://cursor.com/api/auth/stripe` 給方案資訊。Token 存在 SQLite（`~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`，macOS），不是 Keychain 或純文字 JSON——跟現有 Claude/Codex 的讀取方式不同，要新加 SQLite 讀取能力 | **值得深入驗證**，架構上跟 Claude/Codex 同一套「反查非公開端點」手法，只是本機儲存機制不同（SQLite vs Keychain/JSON） |

## 下一步

如果要挑一個先做，**Cursor 是唯一一個已經找到真實端點的**，其他三個（Gemini/Copilot/Perplexity）目前看起來都是死路，除非之後查到新的反查方案。Cursor 要做的話：
1. 讀 `state.vscdb` 拿到 `userId` + `accessToken`（.NET 需要加 SQLite 讀取套件，例如 `Microsoft.Data.Sqlite`——這是全新依賴，其他 provider 都沒用過）
2. 實測 `GET /api/usage?user={userId}` 的真實回應格式（目前只查到「有這個欄位」，沒查到完整 schema，跟當初查 Claude/Codex 端點前一樣，要拿自己帳號實測過才能寫 parser）
3. 確認 cookie 格式的 token 會不會過期/要不要 refresh（跟 Q1 討論的 Claude 多帳號 refresh 問題是同一類風險）

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
