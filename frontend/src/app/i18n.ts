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
  noSourcesTracked: string;
  addSource: string;
  addSourceAria: string;
  removeSource: string;
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
  retentionLabel: string;
  retentionNote: string;
  nearLimitLabel: string;
  manualOnly: string;
  interval5m: string;
  interval1h: string;
  interval2h: string;
  retention3d: string;
  retention5d: string;
  retention7d: string;
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
  infoDisclaimerTitle: string;
  infoDisclaimerBody: string;
}

export const translations: Record<Lang, Translations> = {
  'zh-TW': {
    connectedDesktop: '已連接桌面殼層',
    browserMode: '瀏覽器模式',
    refresh: '重新整理用量',
    refreshing: '重新整理中…',
    lastUpdated: '上次更新 {time}',
    noSourcesTracked: '還沒有追蹤任何來源',
    addSource: '新增來源',
    addSourceAria: '新增來源',
    removeSource: '取消追蹤',
    confirmRemoveText: '確定要取消追蹤？本機的資料會被刪除，無法復原',
    confirmDelete: '確定刪除',
    cancel: '取消',
    estimated: '估算',
    estimatedTooltip: '本機推算值，非官方即時精確數字',
    dragHandleTitle: '拖曳調整順序',
    renameTitle: '點一下改名',
    subscriptionType: '訂閱制',
    apiKeyType: 'API key 制',
    windowUsageTooltip: '{label} 視窗內已用掉的比例',
    currentUsageTooltip: '目前用量狀態',
    noDataYet: '尚無資料',
    stateNormal: '正常',
    stateNearLimit: '偏低',
    stateExceeded: '已用盡',
    stateUnknown: '—',
    back: '返回',
    addSourceTitle: '新增來源',
    loadingEllipsis: '載入中…',
    subscriptionSectionDesc: '讀本機已登入的 CLI，一個帳號只能對到一個 slot，已追蹤的會變灰',
    apiKeySectionDesc: '可以新增多個帳號，各自獨立，不會互相覆蓋',
    tracked: '已追蹤',
    changeOne: '換一個',
    pasteApiKey: '貼上 {name} API key',
    addBtn: '新增',
    noInputNeeded: '不需要輸入任何東西——按下面的按鈕，讓工具去讀本機的登入資訊。',
    detecting: '偵測中…',
    startDetect: '開始偵測',
    done: '完成，返回列表',
    pleaseEnterApiKey: '請先輸入 API key',
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
    apiKeyNotConfigured: '尚未設定 API key',
    rateLimited: '請求太頻繁被 {provider} 限流（HTTP 429），稍後再按重新整理即可，不是憑證壞了',
    unexpectedError: '未預期的錯誤：{message}',
    claudeCredentialsNotFound: '找不到 Claude Code 的登入憑證，請先執行 `claude` 完成登入',
    claudeCredentialsExpiredLocal: '登入憑證已過期，請執行一次 `claude` 讓它自動刷新',
    claudeCredentialsRejected: 'Anthropic 拒絕了目前的登入憑證，請執行一次 `claude` 重新登入',
    codexCredentialsNotFound: '找不到 Codex 的登入憑證，請先執行 `codex login` 完成登入',
    codexCredentialsRejected: 'ChatGPT 拒絕了目前的登入憑證，請執行一次 `codex login` 重新登入',
    deepSeekInvalidKey: 'API key 被拒絕（撤銷或格式錯誤）',
    deepSeekHttpError: 'DeepSeek 回應錯誤：HTTP {status}',
    deepSeekParseError: 'DeepSeek 回應內容無法解析：{body}',
    deepSeekBalance: '剩餘額度 {currency} {balance}',
    deepSeekCallFailed: '呼叫 DeepSeek 用量端點失敗：{message}',
    kimiInvalidKey: 'API key 被拒絕（撤銷、格式錯誤，或這是 platform.kimi.ai 而非 moonshot.ai 發的 key）',
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
    retentionLabel: '歷史資料保留期',
    retentionNote: '目前只會儲存這個值——這個 app 還沒有實際的歷史用量清除功能，設定了也不會有任何效果',
    nearLimitLabel: '接近上限閾值',
    manualOnly: '純手動',
    interval5m: '5 分鐘',
    interval1h: '1 小時',
    interval2h: '2 小時',
    retention3d: '3 天',
    retention5d: '5 天',
    retention7d: '7 天',
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
    infoApiKeyTitle: 'DeepSeek / Kimi（API key 制）',
    infoApiKeyBody: '原生支援多個帳號，各自用獨立的 API key，互不影響，隨時可以新增。',
    infoKimiSubTitle: 'Kimi（訂閱制）',
    infoKimiSubBody: '單一帳號，讀取本機 Kimi Code CLI 的登入 session。⚠️ 這條路徑目前尚未經過真實帳號驗證，第一次使用如果卡住請把錯誤訊息回報給開發者。',
    infoGrokTitle: 'Grok',
    infoGrokBody: '目前不支援 API key 制（xAI 官方沒有對應的查詢端點）；訂閱制走本機估算（ccusage grok）。官方訂閱制端點雖然已經查到，但認證複雜、不確定性偏高，暫時沒有實作。',
    infoDisclaimerTitle: '關於非公開端點',
    infoDisclaimerBody: 'Claude、Codex 這兩個來源目前都是打官方沒有公開文件化的內部端點，不是正式支援的公開 API，未來可能無預告改版或停用——這是已知、已評估過的取捨，不是 bug。',
  },
  en: {
    connectedDesktop: 'Connected to desktop shell',
    browserMode: 'Browser mode',
    refresh: 'Refresh usage',
    refreshing: 'Refreshing…',
    lastUpdated: 'Last updated {time}',
    noSourcesTracked: 'No sources tracked yet',
    addSource: 'Add source',
    addSourceAria: 'Add source',
    removeSource: 'Remove',
    confirmRemoveText: 'Remove this account? Local data will be deleted and cannot be recovered',
    confirmDelete: 'Confirm delete',
    cancel: 'Cancel',
    estimated: 'Estimated',
    estimatedTooltip: 'Local estimate, not an official real-time exact number',
    dragHandleTitle: 'Drag to reorder',
    renameTitle: 'Click to rename',
    subscriptionType: 'Subscription',
    apiKeyType: 'API key',
    windowUsageTooltip: '{label} window usage percentage',
    currentUsageTooltip: 'Current usage status',
    noDataYet: 'No data yet',
    stateNormal: 'Normal',
    stateNearLimit: 'Low',
    stateExceeded: 'Exhausted',
    stateUnknown: '—',
    back: 'Back',
    addSourceTitle: 'Add source',
    loadingEllipsis: 'Loading…',
    subscriptionSectionDesc: 'Reads the CLI already logged in locally — one account per slot; already-tracked ones are greyed out',
    apiKeySectionDesc: 'You can add several accounts, each independent — none overwrites another',
    tracked: 'Tracked',
    changeOne: 'Change',
    pasteApiKey: 'Paste {name} API key',
    addBtn: 'Add',
    noInputNeeded: 'Nothing to type — press the button below and this tool will read your local login info.',
    detecting: 'Detecting…',
    startDetect: 'Start detecting',
    done: 'Done, back to list',
    pleaseEnterApiKey: 'Please enter an API key first',
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
    apiKeyNotConfigured: 'API key not configured yet',
    rateLimited: "Too many requests — rate-limited by {provider} (HTTP 429). Just try refreshing again later, your credentials are fine.",
    unexpectedError: 'Unexpected error: {message}',
    claudeCredentialsNotFound: "Couldn't find Claude Code's login credentials — run `claude` to log in first",
    claudeCredentialsExpiredLocal: 'Login credentials have expired — run `claude` once to let it auto-refresh',
    claudeCredentialsRejected: 'Anthropic rejected the current login credentials — run `claude` once to log in again',
    codexCredentialsNotFound: "Couldn't find Codex's login credentials — run `codex login` to log in first",
    codexCredentialsRejected: 'ChatGPT rejected the current login credentials — run `codex login` once to log in again',
    deepSeekInvalidKey: 'API key was rejected (revoked or malformed)',
    deepSeekHttpError: 'DeepSeek returned an error: HTTP {status}',
    deepSeekParseError: "Could not parse DeepSeek's response: {body}",
    deepSeekBalance: 'Remaining balance {currency} {balance}',
    deepSeekCallFailed: "Failed to call DeepSeek's usage endpoint: {message}",
    kimiInvalidKey: 'API key was rejected (revoked, malformed, or this is a platform.kimi.ai key rather than moonshot.ai)',
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
    retentionLabel: 'History retention',
    retentionNote: "This is currently just stored — this app doesn't have an actual history-pruning feature yet, so setting it has no effect",
    nearLimitLabel: 'Near-limit threshold',
    manualOnly: 'Manual only',
    interval5m: '5 min',
    interval1h: '1 hour',
    interval2h: '2 hours',
    retention3d: '3 days',
    retention5d: '5 days',
    retention7d: '7 days',
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
    infoApiKeyTitle: 'DeepSeek / Kimi (API key)',
    infoApiKeyBody: 'Natively supports multiple accounts, each with its own independent API key — add as many as you like.',
    infoKimiSubTitle: 'Kimi (Subscription)',
    infoKimiSubBody: "Single account, reads the local Kimi Code CLI's login session. ⚠️ This path hasn't been verified against a real account yet — if it gets stuck on first use, please report the error message to the developer.",
    infoGrokTitle: 'Grok',
    infoGrokBody: "API key mode isn't supported (xAI has no corresponding query endpoint); subscription mode uses a local estimate (ccusage grok). An official subscription endpoint was found but its complexity/uncertainty is high, so it hasn't been implemented yet.",
    infoDisclaimerTitle: 'About undocumented endpoints',
    infoDisclaimerBody: 'Both the Claude and Codex sources currently call undocumented internal endpoints, not officially published public APIs — they could change or be disabled without notice in the future. This is a known, deliberately-evaluated trade-off, not a bug.',
  },
};
