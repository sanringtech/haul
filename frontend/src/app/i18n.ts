/**
 * 輕量 i18n：一份翻譯字典，跟主題切換共用同一種「signal 控制、當場生效、不重載」的模式
 * （見 app.ts 的 theme signal）。不用 @angular/localize——那是 build-time 多 bundle 機制，
 * 每個語言各自編譯一份完整 Angular 打包，沒有內建的「app 內即時切換」，跟這裡要的體驗不合，
 * 詳見這次跟使用者的討論。
 *
 * 涵蓋範圍（2026-08-31 擴充）：不只前端自己寫的字串（按鈕、標籤、提示文字），也涵蓋每張卡片的
 * detail/百分比視窗標籤（例如 "5 小時"、"08:07 重置"、各種連線錯誤訊息）——後端（backend/Providers/
 * *.cs、backend/Models/MessageKeys.cs）不再送組好的中文句子，只送一個穩定的 key（+ 動態部分當
 * params），下面這份表就是那些 key 實際查到的文字。**兩邊的 key 必須完全對應**：backend/Models/
 * MessageKeys.cs 每加一個新 key，這裡的 Translations 介面跟 zh-TW/en 兩個物件都要跟著加，少了任一
 * 語言 TypeScript 會編譯期報錯，但 C# 那邊拼錯字不會——跨語言拼字一致純靠人工對照，沒有型別檢查。
 */

export type Lang = 'zh-TW' | 'en';

export const LANG_STORAGE_KEY = 'sanring-usage-monitor:lang';

export interface Translations {
  connectedDesktop: string;
  browserMode: string;
  refresh: string;
  refreshing: string;
  lastUpdated: string;
  usageHealthSummary: string;
  noSourcesTracked: string;
  addSource: string;
  addSourceAria: string;
  removeSource: string;
  removeSourceTitle: string;
  removeApiKeyDescription: string;
  removeSubscriptionDescription: string;
  keepSource: string;
  confirmRemoveText: string;
  confirmDelete: string;
  cancel: string;
  estimated: string;
  estimatedTooltip: string;
  dragHandleTitle: string;
  renameTitle: string;
  subscriptionType: string;
  apiKeyType: string;
  windowUsageTooltip: string;
  currentUsageTooltip: string;
  noDataYet: string;
  stateNormal: string;
  stateAttention: string;
  stateNearLimit: string;
  stateExceeded: string;
  stateUnknown: string;
  back: string;
  addSourceTitle: string;
  loadingEllipsis: string;
  subscriptionSectionDesc: string;
  apiKeySectionDesc: string;
  tracked: string;
  changeOne: string;
  pasteApiKey: string;
  addBtn: string;
  noInputNeeded: string;
  detecting: string;
  startDetect: string;
  done: string;
  pleaseEnterApiKey: string;
  unknownAddFailure: string;
  hostNotConnected: string;
  addedSuccess: string;
  addedSuccessMultiple: string;
  noNewAccountsDetected: string;
  parseError: string;
  switchToLight: string;
  switchToDark: string;
  switchToEnglish: string;
  switchToChinese: string;

  // ── 以下對應 backend/Models/MessageKeys.cs——後端 provider 產生的訊息，key 名稱必須一致 ──
  httpError: string;
  usageEndpointParseError: string;
  callFailed: string;
  windowReset: string;
  fiveHourLabel: string;
  sevenDayLabel: string;
  apiKeyNotConfigured: string;
  rateLimited: string;
  unexpectedError: string;
  claudeCredentialsNotFound: string;
  claudeCredentialsExpiredLocal: string;
  claudeCredentialsRejected: string;
  codexCredentialsNotFound: string;
  codexCredentialsRejected: string;
  cursorCredentialsNotFound: string;
  cursorCredentialsExpiredLocal: string;
  cursorCredentialsRejected: string;
  cursorModelsLabel: string;
  otherModelsLabel: string;
  deepSeekInvalidKey: string;
  deepSeekHttpError: string;
  deepSeekParseError: string;
  deepSeekBalance: string;
  deepSeekCallFailed: string;
  kimiInvalidKey: string;
  kimiHttpError: string;
  kimiParseError: string;
  kimiBalance: string;
  kimiCallFailed: string;
  kimiSubCredentialsNotFound: string;
  kimiSubCredentialsRejected: string;
  kimiSubHttpErrorWithBody: string;
  kimiSubParseErrorUnverified: string;
  cswapCallFailed: string;
  cswapAccountNotFound: string;
  cswapUsageStatusNotOk: string;

  // ── 浮動小工具（widget-app.ts）專用 ──
  widgetDetails: string;
  widgetCollapse: string;
  widgetQuit: string;

  // ── 設定頁（PRD M3）──
  settingsTitle: string;
  settingsAria: string;
  refreshIntervalLabel: string;
  nearLimitLabel: string;
  usageAlertTitle: string;
  attentionAlertLabel: string;
  nearLimitAlertLabel: string;
  exhaustedAlertLabel: string;
  fixedLabel: string;
  usageAlertSummary: string;
  apiKeyBalanceAlertTitle: string;
  apiKeyBalanceAlertDescription: string;
  balanceAlertToggleAria: string;
  balanceAmountAria: string;
  lowBalancePlaceholder: string;
  balanceAttentionLabel: string;
  balanceCriticalLabel: string;
  balanceOrderError: string;
  manualOnly: string;
  interval5m: string;
  interval1h: string;
  interval2h: string;
  usageHistoryTitle: string;
  usageHistoryDescription: string;
  usageHistoryNoData: string;
  claudeWakeUpTitle: string;
  claudeWakeUpDescription: string;
  claudeWakeUpNoAccounts: string;
  claudeWakeUpAccountToggleAria: string;
  claudeWakeUpHourAria: string;
  chartSeriesShown: string;
  chartSeriesHidden: string;
  chartShortWindowTitle: string;
  chartLongWindowTitle: string;
  viewCharts: string;
  chartModeLine: string;
  chartModeDonut: string;
  closeDialog: string;
  exportMd: string;
  exportXlsx: string;
  saveSettings: string;
  settingsSaved: string;

  // ── 關閉顯示 / 取消追蹤（PRD M4）──
  hideSource: string;
  unhideSource: string;
  hiddenSourcesTitle: string;

  // ── 用量來源說明頁（各 AI 類型多帳號/資料來源現況）──
  infoAria: string;
  infoTitle: string;
  infoClaudeTitle: string;
  infoClaudeBody: string;
  infoCodexTitle: string;
  infoCodexBody: string;
  infoApiKeyTitle: string;
  infoApiKeyBody: string;
  infoKimiSubTitle: string;
  infoKimiSubBody: string;
  infoGrokTitle: string;
  infoGrokBody: string;
  infoCursorTitle: string;
  infoCursorBody: string;
  infoDisclaimerTitle: string;
  infoDisclaimerBody: string;

  // ── 首次開啟的本機資料揭露彈窗（2026-09-01 新增）──
  disclosureTitle: string;
  disclosureBody: string;
  disclosureInfoHint: string;
  disclosureAck: string;
}

export const translations: Record<Lang, Translations> = {
  'zh-TW': {
    connectedDesktop: '已連接桌面殼層',
    browserMode: '瀏覽器模式',
    refresh: '重新整理用量',
    refreshing: '重新整理中…',
    lastUpdated: '上次更新 {time}',
    usageHealthSummary: '用量健康度：{state}',
    noSourcesTracked: '還沒有追蹤任何來源',
    addSource: '新增來源',
    addSourceAria: '新增來源',
    removeSource: '取消追蹤',
    removeSourceTitle: '取消追蹤 {name}？',
    removeApiKeyDescription: '將從 Haul 的追蹤清單移除此帳號，並清除 Haul 儲存在系統鑰匙圈中的這把 API KEY。不會刪除服務商帳號或遠端資料。',
    removeSubscriptionDescription: '將從 Haul 的追蹤清單移除此帳號。不會登出 CLI，也不會刪除服務商帳號或遠端資料。',
    keepSource: '保留',
    confirmRemoveText: '確定要取消追蹤？本機的資料會被刪除，無法復原',
    confirmDelete: '確定刪除',
    cancel: '取消',
    estimated: '估算',
    estimatedTooltip: '本機推算值，非官方即時精確數字',
    dragHandleTitle: '拖曳調整順序',
    renameTitle: '點一下改名',
    subscriptionType: '訂閱',
    apiKeyType: 'API KEY',
    windowUsageTooltip: '{label} 視窗內已用掉的比例',
    currentUsageTooltip: '目前用量狀態',
    noDataYet: '尚無資料',
    stateNormal: '正常',
    stateAttention: '注意',
    stateNearLimit: '警戒',
    stateExceeded: '已用盡',
    stateUnknown: '—',
    back: '返回',
    addSourceTitle: '新增來源',
    loadingEllipsis: '載入中…',
    subscriptionSectionDesc: '讀本機已登入的 CLI，一個帳號只能對到一個 slot，已追蹤的會變灰',
    apiKeySectionDesc: '可以新增多個帳號，各自獨立，不會互相覆蓋',
    tracked: '已追蹤',
    changeOne: '換一個',
    pasteApiKey: '貼上 {name} API KEY',
    addBtn: '新增',
    noInputNeeded: '不需要輸入任何東西——按下面的按鈕，讓工具去讀本機的登入資訊。',
    detecting: '偵測中…',
    startDetect: '開始偵測',
    done: '完成，返回列表',
    pleaseEnterApiKey: '請先輸入 API KEY',
    unknownAddFailure: '新增失敗，原因不明',
    hostNotConnected: '未連接到桌面殼層（用 ng serve 純前端開發時無法呼叫 C# 後端）',
    addedSuccess: '已新增 {name}',
    addedSuccessMultiple: '已新增 {count} 個帳號',
    noNewAccountsDetected: '沒有偵測到新帳號（可能都已經追蹤過了）',
    parseError: '收到無法解析的訊息: {raw}',
    switchToLight: '切換成淺色模式',
    switchToDark: '切換成深色模式',
    switchToEnglish: '切換成英文',
    switchToChinese: '切換成中文',

    httpError: '用量端點回應錯誤：HTTP {status}',
    usageEndpointParseError: '用量端點回應內容無法解析：{body}',
    callFailed: '呼叫用量端點失敗：{message}',
    windowReset: '{time} 重置',
    fiveHourLabel: '5 小時',
    sevenDayLabel: '7 天',
    apiKeyNotConfigured: '尚未設定 API KEY',
    rateLimited: '請求太頻繁被 {provider} 限流（HTTP 429），稍後再按重新整理即可，不是憑證壞了',
    unexpectedError: '未預期的錯誤：{message}',
    claudeCredentialsNotFound: '找不到 Claude Code 的登入憑證，請先執行 `claude` 完成登入',
    claudeCredentialsExpiredLocal: '登入憑證已過期，請執行一次 `claude` 讓它自動刷新',
    claudeCredentialsRejected: 'Anthropic 拒絕了目前的登入憑證，請執行一次 `claude` 重新登入',
    codexCredentialsNotFound: '找不到 Codex 的登入憑證，請先執行 `codex login` 完成登入',
    codexCredentialsRejected: 'ChatGPT 拒絕了目前的登入憑證，請執行一次 `codex login` 重新登入',
    cursorCredentialsNotFound: '找不到 Cursor 的登入 session，請先打開 Cursor 完成登入',
    cursorCredentialsExpiredLocal: '登入憑證已過期，請打開 Cursor 讓它自動刷新',
    cursorCredentialsRejected: 'Cursor 拒絕了目前的登入憑證，請重新打開 Cursor 登入',
    cursorModelsLabel: '內建模型',
    otherModelsLabel: '其他模型',
    deepSeekInvalidKey: 'API KEY 被拒絕（撤銷或格式錯誤）',
    deepSeekHttpError: 'DeepSeek 回應錯誤：HTTP {status}',
    deepSeekParseError: 'DeepSeek 回應內容無法解析：{body}',
    deepSeekBalance: '剩餘額度 {currency} {balance}',
    deepSeekCallFailed: '呼叫 DeepSeek 用量端點失敗：{message}',
    kimiInvalidKey: 'API KEY 被拒絕（撤銷、格式錯誤，或這是 platform.kimi.ai 而非 moonshot.ai 發的 API KEY）',
    kimiHttpError: 'Kimi 回應錯誤：HTTP {status}',
    kimiParseError: 'Kimi 回應內容無法解析或回報失敗：{body}',
    kimiBalance: '剩餘額度 {balance}',
    kimiCallFailed: '呼叫 Kimi 用量端點失敗：{message}',
    kimiSubCredentialsNotFound: '找不到 Kimi Code 的登入憑證，請先在 Kimi Code CLI 裡執行 `/login`',
    kimiSubCredentialsRejected: 'Kimi Code 拒絕了目前的登入憑證，請重新執行 `/login`',
    kimiSubHttpErrorWithBody: '用量端點回應錯誤：HTTP {status}　{body}',
    kimiSubParseErrorUnverified: '用量端點回應內容無法解析（未驗證過的端點，第一次遇到請把這段回傳貼給開發者）：{body}',
    cswapCallFailed: '呼叫 cswap 失敗：{message}',
    cswapAccountNotFound: 'cswap 清單裡找不到帳號 {email}（可能在 cswap 裡被登出或移除了）',
    cswapUsageStatusNotOk: 'cswap 回報這個帳號的用量狀態異常：{status}',

    widgetDetails: '詳細',
    widgetCollapse: '收合',
    widgetQuit: '結束',

    settingsTitle: '設定',
    settingsAria: '設定',
    refreshIntervalLabel: '自動刷新頻率',
    nearLimitLabel: '用量達到多少時提醒',
    usageAlertTitle: '訂閱用量提醒',
    attentionAlertLabel: '注意',
    nearLimitAlertLabel: '接近上限',
    exhaustedAlertLabel: '已用盡',
    fixedLabel: '固定',
    usageAlertSummary: '{attention}% 顯示黃色、{nearLimit}% 顯示橘色、100% 顯示紅色。',
    apiKeyBalanceAlertTitle: 'API KEY 餘額提醒',
    apiKeyBalanceAlertDescription: '可分別開啟各服務商的餘額提醒；開啟後設定提醒金額。',
    balanceAlertToggleAria: '切換 {provider} 餘額提醒',
    balanceAmountAria: '{provider} 提醒金額',
    lowBalancePlaceholder: '不提醒',
    balanceAttentionLabel: '注意（黃）',
    balanceCriticalLabel: '接近用盡（橘）',
    balanceOrderError: '橘色金額必須低於黃色金額。',
    manualOnly: '純手動',
    interval5m: '5 分鐘',
    interval1h: '1 小時',
    interval2h: '2 小時',
    usageHistoryTitle: '記錄用量歷史',
    usageHistoryDescription: '開啟後自動刷新固定改為每 5 分鐘一次，並把各訂閱制來源的用量記錄到本機，最長保留 1 個月，可隨時匯出成 Markdown 或 Excel 檔。',
    usageHistoryNoData: '還沒有足夠的記錄可以畫圖，開啟上面的開關再等幾輪刷新看看。',
    claudeWakeUpTitle: 'Claude 用量喚醒',
    claudeWakeUpDescription: '⚠️ 這是唯一會消耗你用量額度的功能：Claude 的 5 小時／7 天視窗要送出訊息才會啟動。開啟後，下面勾選的帳號會在各自設定的時刻（本機時間，24 小時制）送一則最小訊息喚醒視窗——每個帳號一天最多一次，代價很小，但是真的對話紀錄。app 沒開著的話不會準時觸發，會等到下次刷新才補打。',
    claudeWakeUpNoAccounts: '目前沒有透過 cswap 追蹤的 Claude 帳號可以選——單一帳號模式不支援這個功能。',
    claudeWakeUpAccountToggleAria: '對 {name} 啟用用量喚醒',
    claudeWakeUpHourAria: '{name} 的喚醒時刻',
    chartSeriesShown: '{label}目前顯示中，點一下隱藏',
    chartSeriesHidden: '{label}目前已隱藏，點一下顯示',
    chartShortWindowTitle: '5 小時視窗（短週期／突發額度）',
    chartLongWindowTitle: '7 天／其他視窗（長週期／總預算）',
    viewCharts: '查看圖表',
    chartModeLine: '折線圖',
    chartModeDonut: '甜甜圈量表',
    closeDialog: '關閉',
    exportMd: '匯出 Markdown',
    exportXlsx: '匯出 Excel',
    saveSettings: '儲存',
    settingsSaved: '設定已儲存',

    hideSource: '關閉顯示',
    unhideSource: '顯示',
    hiddenSourcesTitle: '已隱藏的來源',

    infoAria: '用量來源說明',
    infoTitle: '用量來源說明',
    infoClaudeTitle: 'Claude',
    infoClaudeBody: '支援多帳號。有安裝選用工具 cswap（claude-swap）時，會自動偵測並同時追蹤所有登入的帳號；沒有安裝則只能看到目前登入中的那一個。',
    infoCodexTitle: 'Codex',
    infoCodexBody: '目前只支援單一帳號。官方 Codex CLI 還沒有多帳號功能（OpenAI 尚未實作，見官方 issue #4432）；市面上雖然有幾個第三方切換工具，但機制都是「切換目前登入的帳號」而非唯讀查詢多個帳號，牽涉的風險比 Claude 那邊高，目前沒有整合。',
    infoApiKeyTitle: 'DeepSeek / Kimi（API KEY）',
    infoApiKeyBody: '原生支援多個帳號，各自用獨立的 API KEY，互不影響，隨時可以新增。',
    infoKimiSubTitle: 'Kimi（訂閱）',
    infoKimiSubBody: '單一帳號，讀取本機 Kimi Code CLI 的登入 session。⚠️ 這條路徑目前尚未經過真實帳號驗證，第一次使用如果卡住請把錯誤訊息回報給開發者。',
    infoGrokTitle: 'Grok',
    infoGrokBody: '目前不支援 API KEY（xAI 官方沒有對應的查詢端點）；訂閱走本機估算（ccusage grok）。官方訂閱端點雖然已經查到，但認證複雜、不確定性偏高，暫時沒有實作。',
    infoCursorTitle: 'Cursor',
    infoCursorBody: '單一帳號，讀取本機 Cursor 的登入 session。卡片兩條進度對齊設定頁「Included in Pro」：內建模型（Cursor Models，含 Grok / Composer）與其他模型（Other Models）。',
    infoDisclaimerTitle: '關於非公開端點',
    infoDisclaimerBody: 'Claude、Codex 這兩個來源目前都是打官方沒有公開文件化的內部端點，不是正式支援的公開 API，未來可能無預告改版或停用——這是已知、已評估過的取捨，不是 bug。',

    disclosureTitle: '本機資料存取聲明',
    disclosureBody: '本 App 僅讀取各 AI 官方 CLI 的本機登入資訊，以及您提供的 API KEY，皆不會外傳。',
    disclosureInfoHint: '完整用量來源說明請點選右上角圖示查看',
    disclosureAck: '了解',
  },
  en: {
    connectedDesktop: 'Connected to desktop shell',
    browserMode: 'Browser mode',
    refresh: 'Refresh usage',
    refreshing: 'Refreshing…',
    lastUpdated: 'Last updated {time}',
    usageHealthSummary: 'Usage health: {state}',
    noSourcesTracked: 'No sources tracked yet',
    addSource: 'Add source',
    addSourceAria: 'Add source',
    removeSource: 'Remove',
    removeSourceTitle: 'Stop tracking {name}?',
    removeApiKeyDescription: "This account will be removed from Haul's tracking list, and its API KEY will be removed from the system keychain. Your provider account and remote data will not be affected.",
    removeSubscriptionDescription: "This account will be removed from Haul's tracking list. You will not be signed out of the CLI, and your provider account and remote data will not be affected.",
    keepSource: 'Keep',
    confirmRemoveText: 'Remove this account? Local data will be deleted and cannot be recovered',
    confirmDelete: 'Confirm delete',
    cancel: 'Cancel',
    estimated: 'Estimated',
    estimatedTooltip: 'Local estimate, not an official real-time exact number',
    dragHandleTitle: 'Drag to reorder',
    renameTitle: 'Click to rename',
    subscriptionType: 'Subscription',
    apiKeyType: 'API KEY',
    windowUsageTooltip: '{label} window usage percentage',
    currentUsageTooltip: 'Current usage status',
    noDataYet: 'No data yet',
    stateNormal: 'Normal',
    stateAttention: 'Attention',
    stateNearLimit: 'Warning',
    stateExceeded: 'Exhausted',
    stateUnknown: '—',
    back: 'Back',
    addSourceTitle: 'Add source',
    loadingEllipsis: 'Loading…',
    subscriptionSectionDesc: 'Reads the CLI already logged in locally — one account per slot; already-tracked ones are greyed out',
    apiKeySectionDesc: 'You can add several accounts, each independent — none overwrites another',
    tracked: 'Tracked',
    changeOne: 'Change',
    pasteApiKey: 'Paste {name} API KEY',
    addBtn: 'Add',
    noInputNeeded: 'Nothing to type — press the button below and this tool will read your local login info.',
    detecting: 'Detecting…',
    startDetect: 'Start detecting',
    done: 'Done, back to list',
    pleaseEnterApiKey: 'Please enter an API KEY first',
    unknownAddFailure: 'Failed to add, reason unknown',
    hostNotConnected: "Not connected to the desktop shell (can't reach the C# backend when running frontend-only via ng serve)",
    addedSuccess: 'Added {name}',
    addedSuccessMultiple: 'Added {count} accounts',
    noNewAccountsDetected: 'No new accounts detected (they may already be tracked)',
    parseError: 'Received an unparseable message: {raw}',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
    switchToEnglish: 'Switch to English',
    switchToChinese: 'Switch to Chinese',

    httpError: 'Usage endpoint returned an error: HTTP {status}',
    usageEndpointParseError: "Could not parse the usage endpoint's response: {body}",
    callFailed: 'Failed to call the usage endpoint: {message}',
    windowReset: 'Resets at {time}',
    fiveHourLabel: '5h',
    sevenDayLabel: '7d',
    apiKeyNotConfigured: 'API KEY not configured yet',
    rateLimited: "Too many requests — rate-limited by {provider} (HTTP 429). Just try refreshing again later, your credentials are fine.",
    unexpectedError: 'Unexpected error: {message}',
    claudeCredentialsNotFound: "Couldn't find Claude Code's login credentials — run `claude` to log in first",
    claudeCredentialsExpiredLocal: 'Login credentials have expired — run `claude` once to let it auto-refresh',
    claudeCredentialsRejected: 'Anthropic rejected the current login credentials — run `claude` once to log in again',
    codexCredentialsNotFound: "Couldn't find Codex's login credentials — run `codex login` to log in first",
    codexCredentialsRejected: 'ChatGPT rejected the current login credentials — run `codex login` once to log in again',
    cursorCredentialsNotFound: "Couldn't find a Cursor login session — open Cursor and log in first",
    cursorCredentialsExpiredLocal: 'Login credentials have expired — open Cursor once to let it refresh automatically',
    cursorCredentialsRejected: 'Cursor rejected the current login credentials — open Cursor and log in again',
    cursorModelsLabel: 'Cursor Models',
    otherModelsLabel: 'Other Models',
    deepSeekInvalidKey: 'API KEY was rejected (revoked or malformed)',
    deepSeekHttpError: 'DeepSeek returned an error: HTTP {status}',
    deepSeekParseError: "Could not parse DeepSeek's response: {body}",
    deepSeekBalance: 'Remaining balance {currency} {balance}',
    deepSeekCallFailed: "Failed to call DeepSeek's usage endpoint: {message}",
    kimiInvalidKey: 'API KEY was rejected (revoked, malformed, or this is a platform.kimi.ai API KEY rather than moonshot.ai)',
    kimiHttpError: 'Kimi returned an error: HTTP {status}',
    kimiParseError: "Could not parse Kimi's response, or it reported failure: {body}",
    kimiBalance: 'Remaining balance {balance}',
    kimiCallFailed: "Failed to call Kimi's usage endpoint: {message}",
    kimiSubCredentialsNotFound: "Couldn't find Kimi Code's login credentials — run `/login` inside the Kimi Code CLI first",
    kimiSubCredentialsRejected: 'Kimi Code rejected the current login credentials — run `/login` again',
    kimiSubHttpErrorWithBody: 'Usage endpoint returned an error: HTTP {status}　{body}',
    kimiSubParseErrorUnverified: "Could not parse the usage endpoint's response (this endpoint is unverified — if you're the first to hit this, please paste this response for the developer): {body}",
    cswapCallFailed: 'Failed to call cswap: {message}',
    cswapAccountNotFound: "Couldn't find account {email} in cswap's list (it may have been logged out or removed from cswap)",
    cswapUsageStatusNotOk: "cswap reported an abnormal usage status for this account: {status}",

    widgetDetails: 'Details',
    widgetCollapse: 'Collapse',
    widgetQuit: 'Quit',

    settingsTitle: 'Settings',
    settingsAria: 'Settings',
    refreshIntervalLabel: 'Auto-refresh interval',
    nearLimitLabel: 'Warn when usage reaches',
    usageAlertTitle: 'Subscription usage alerts',
    attentionAlertLabel: 'Attention',
    nearLimitAlertLabel: 'Near limit',
    exhaustedAlertLabel: 'Exhausted',
    fixedLabel: 'Fixed',
    usageAlertSummary: 'Yellow at {attention}%, orange at {nearLimit}%, and red at 100%.',
    apiKeyBalanceAlertTitle: 'API KEY balance alerts',
    apiKeyBalanceAlertDescription: 'Enable balance alerts per provider, then set the alert amount.',
    balanceAlertToggleAria: 'Toggle {provider} balance alert',
    balanceAmountAria: '{provider} alert amount',
    lowBalancePlaceholder: 'No alert',
    balanceAttentionLabel: 'Attention (yellow)',
    balanceCriticalLabel: 'Near empty (orange)',
    balanceOrderError: 'The orange amount must be lower than the yellow amount.',
    manualOnly: 'Manual only',
    interval5m: '5 min',
    interval1h: '1 hour',
    interval2h: '2 hours',
    usageHistoryTitle: 'Record usage history',
    usageHistoryDescription: 'When on, auto-refresh switches to a fixed 5-minute cadence and each subscription source’s usage is recorded locally (kept for up to 1 month). Export it anytime as Markdown or Excel.',
    usageHistoryNoData: 'Not enough recorded data to chart yet — turn on the switch above and wait for a few more refreshes.',
    claudeWakeUpTitle: 'Claude usage wake-up',
    claudeWakeUpDescription: "⚠️ The only feature that spends real usage: Claude's 5-hour/7-day windows only start once a message is sent. When on, each selected account below gets one minimal message at its own set hour (local time, 24-hour) to wake its window — once a day per account, tiny cost, but a real logged conversation. Won't fire on time if the app isn't open; it catches up on the next refresh instead.",
    claudeWakeUpNoAccounts: 'No Claude accounts tracked via cswap yet — single-account mode doesn’t support this.',
    claudeWakeUpAccountToggleAria: 'Enable usage wake-up for {name}',
    claudeWakeUpHourAria: 'Wake-up hour for {name}',
    chartSeriesShown: '{label} is shown — click to hide',
    chartSeriesHidden: '{label} is hidden — click to show',
    chartShortWindowTitle: '5-hour windows (short cycle / burst limit)',
    chartLongWindowTitle: '7-day & other windows (long cycle / total budget)',
    viewCharts: 'View charts',
    chartModeLine: 'Line chart',
    chartModeDonut: 'Donut gauge',
    closeDialog: 'Close',
    exportMd: 'Export Markdown',
    exportXlsx: 'Export Excel',
    saveSettings: 'Save',
    settingsSaved: 'Settings saved',

    hideSource: 'Hide',
    unhideSource: 'Show',
    hiddenSourcesTitle: 'Hidden sources',

    infoAria: 'Usage sources info',
    infoTitle: 'Usage sources',
    infoClaudeTitle: 'Claude',
    infoClaudeBody: 'Supports multiple accounts. If the optional cswap (claude-swap) tool is installed, all logged-in accounts are detected and tracked automatically; otherwise only the currently logged-in one is shown.',
    infoCodexTitle: 'Codex',
    infoCodexBody: "Currently single-account only. The official Codex CLI has no multi-account support yet (OpenAI hasn't built this — see official issue #4432). A few third-party switcher tools exist, but they work by changing which account is actively logged in rather than reading multiple accounts non-destructively, carrying more risk than the Claude approach — not integrated for now.",
    infoApiKeyTitle: 'DeepSeek / Kimi (API KEY)',
    infoApiKeyBody: 'Natively supports multiple accounts, each with its own independent API KEY — add as many as you like.',
    infoKimiSubTitle: 'Kimi (Subscription)',
    infoKimiSubBody: "Single account, reads the local Kimi Code CLI's login session. ⚠️ This path hasn't been verified against a real account yet — if it gets stuck on first use, please report the error message to the developer.",
    infoGrokTitle: 'Grok',
    infoGrokBody: "API KEY isn't supported (xAI has no corresponding query endpoint); subscription uses a local estimate (ccusage grok). An official subscription endpoint was found but its complexity/uncertainty is high, so it hasn't been implemented yet.",
    infoCursorTitle: 'Cursor',
    infoCursorBody: "Single account, reads the local Cursor login session. The two bars match Settings → Included in Pro: Cursor Models (Grok / Composer) and Other Models.",
    infoDisclaimerTitle: 'About undocumented endpoints',
    infoDisclaimerBody: 'Both the Claude and Codex sources currently call undocumented internal endpoints, not officially published public APIs — they could change or be disabled without notice in the future. This is a known, deliberately-evaluated trade-off, not a bug.',

    disclosureTitle: 'Local data access notice',
    disclosureBody: "This app only reads local login info from each AI's official CLI, and any API keys you provide — none of it is ever sent elsewhere.",
    disclosureInfoHint: 'For the full explanation, tap the icon in the top-right corner',
    disclosureAck: 'Got it',
  },
};
