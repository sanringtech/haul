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
