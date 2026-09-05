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
  connectionValid: string;
  connectionInvalid: string;
  connectionExpired: string;
  connectionNotConfigured: string;
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
  captureHintClaude: string;
  captureHintCodex: string;
  grokAddHint: string;
  capturing: string;
  captureBtn: string;
  detecting: string;
  startDetect: string;
  capturedSuccess: string;
  capturedSuccessMultiple: string;
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
  snapshotNotFound: string;
  captureRefreshMissing: string;
  captureEmailMissing: string;
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
  grokCredentialsNotFound: string;
  grokCredentialsRejected: string;
  grokHttpErrorWithBody: string;
  grokParseErrorUnverified: string;

  // ── 浮動小工具（widget-app.ts）專用 ──
  widgetDetails: string;
  widgetCollapse: string;
  widgetQuit: string;

  // ── 設定頁（PRD M3）──
  settingsTitle: string;
  settingsAria: string;
  ledgerAria: string;
  ledgerTitle: string;
  ledgerDescription: string;
  ledgerSectionTokens: string;
  ledgerSectionTokensHintSources: string;
  ledgerSectionTokensHintRange: string;
  ledgerSectionTokensHintAccounts: string;
  ledgerSectionTokensHintPricing: string;
  ledgerSectionTokensHintUnsupported: string;
  ledgerSectionTokensInfoAria: string;
  ledgerLocalExportHint: string;
  ledgerLocalExportInfoAria: string;
  ledgerLocalExportXlsx: string;
  ledgerSectionCharts: string;
  ledgerSectionChartsHint: string;
  ledgerRecordingOff: string;
  ledgerTokenTitle: string;
  ledgerTokenNeedDesktop: string;
  ledgerTokenEmpty: string;
  ledgerCodexTitle: string;
  ledgerCodexEmpty: string;
  ledgerTokenLocalCombined: string;
  ledgerTokenLocalCombinedHint: string;
  ledgerColModel: string;
  ledgerColInput: string;
  ledgerColOutput: string;
  ledgerColCacheWrite: string;
  ledgerColCacheRead: string;
  ledgerColEstUsd: string;
  ledgerTokenTotal: string;
  ledgerSliceModels: string;
  ledgerSliceMonth: string;
  ledgerSliceWeek: string;
  ledgerSliceDays: string;
  ledgerSliceSessions: string;
  ledgerSliceEntries: string;
  ledgerSliceReplies: string;
  ledgerSliceEmpty: string;
  ledgerSlicePrev: string;
  ledgerSliceNext: string;
  ledgerSliceDateAria: string;
  ledgerSliceMonthAria: string;
  ledgerSliceWeekRange: string;
  ledgerSlicePeriodHint: string;
  usageHistorySettingsHint: string;
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
  quitApp: string;
  quitAppHint: string;

  // ── 關閉顯示 / 取消追蹤（PRD M4）──
  hideSource: string;
  unhideSource: string;
  hiddenSourcesTitle: string;

  // ── 說明頁（共通注意事項；用量來源說明以手風琴收合）──
  infoAria: string;
  infoTitle: string;
  infoTestingTitle: string;
  infoTestingBody: string;
  infoUsdTitle: string;
  infoUsdBody: string;
  infoSourcesTitle: string;
  infoSourcesHint: string;
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
    connectionValid: '連線正常',
    connectionInvalid: '連線失效',
    connectionExpired: '憑證過期',
    connectionNotConfigured: '尚未設定',
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
    subscriptionSectionDesc: '擷取目前 CLI 已登入的帳號。同一個來源可以擷取多次——換帳號後再擷取就會多一筆。',
    apiKeySectionDesc: '可以新增多個帳號，各自獨立，不會互相覆蓋',
    tracked: '已追蹤',
    changeOne: '換一個',
    pasteApiKey: '貼上 {name} API KEY',
    addBtn: '新增',
    noInputNeeded: '不需要輸入任何東西——按下面的按鈕，讓工具去讀本機的登入資訊。',
    captureHintClaude: 'Haul 會讀本機家目錄裡的 Claude Code 登入；Windows 上還會一併掃正在執行的 WSL distro。按擷取會一次加入找到的帳號；同一 email 只留一份。Haul 只複製快照，不會改 CLI 的登入、也不會幫你切帳。',
    captureHintCodex: 'Haul 會讀本機家目錄裡的 `codex login`；Windows 上還會一併掃正在執行的 WSL distro。按擷取會一次加入找到的帳號。Codex 的 refresh token 幾乎只能用一次：若還要加另一個尚未登入的帳號，擷取後請立刻在終端機登入那個帳號再按一次——不要先開 Codex CLI 讓它自己換票。Haul 絕不寫回 ~/.codex/auth.json。',
    grokAddHint: '先在終端機 `grok login`，再按偵測。Haul 只讀 ~/.grok/auth.json，不會寫回、也不會幫你換票。API KEY 查不到訂閱用量。',
    capturing: '擷取中…',
    captureBtn: '擷取目前登入',
    detecting: '偵測中…',
    startDetect: '開始偵測',
    capturedSuccess: '已擷取 {name}。要加另一個帳號，先在終端機登入那個帳號再按一次擷取。',
    capturedSuccessMultiple: '已擷取 {count} 個帳號（含正在執行的 WSL 家目錄）。',
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
    snapshotNotFound: '找不到這個帳號的快照，請到新增來源再擷取一次目前的 CLI 登入',
    captureRefreshMissing: '讀到的登入沒有 refresh token，請在終端機重新登入後再擷取',
    captureEmailMissing: '登入資訊裡沒有 email，無法辨識帳號。請確認 CLI 已登入後再試',
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
    deepSeekBalance: '剩餘額度 ${balance}',
    deepSeekCallFailed: '呼叫 DeepSeek 用量端點失敗：{message}',
    kimiInvalidKey: 'API KEY 被拒絕（撤銷、格式錯誤，或這是 platform.kimi.ai 而非 moonshot.ai 發的 API KEY）',
    kimiHttpError: 'Kimi 回應錯誤：HTTP {status}',
    kimiParseError: 'Kimi 回應內容無法解析或回報失敗：{body}',
    kimiBalance: '剩餘額度 ${balance}',
    kimiCallFailed: '呼叫 Kimi 用量端點失敗：{message}',
    kimiSubCredentialsNotFound: '找不到 Kimi Code 的登入憑證，請先在 Kimi Code CLI 裡執行 `/login`',
    kimiSubCredentialsRejected: 'Kimi Code 拒絕了目前的登入憑證，請重新執行 `/login`',
    kimiSubHttpErrorWithBody: '用量端點回應錯誤：HTTP {status}　{body}',
    kimiSubParseErrorUnverified: '用量端點回應內容無法解析（未驗證過的端點，第一次遇到請把這段回傳貼給開發者）：{body}',
    grokCredentialsNotFound: '找不到 Grok Build 的登入憑證，請先在終端機執行 `grok login`',
    grokCredentialsRejected: 'Grok 拒絕了目前的登入憑證，請重新執行 `grok login`',
    grokHttpErrorWithBody: '用量端點回應錯誤：HTTP {status}　{body}',
    grokParseErrorUnverified: '用量端點回應內容無法解析（第一次遇到請把這段回傳貼給開發者）：{body}',

    widgetDetails: '詳細',
    widgetCollapse: '收合',
    widgetQuit: '結束',

    settingsTitle: '設定',
    settingsAria: '設定',
    ledgerAria: '用量紀錄',
    ledgerTitle: '用量紀錄',
    ledgerDescription: '已經發生的本機紀錄，不是未來用量預測。估算美元不是帳單。',
    ledgerSectionTokens: '本機用量',
    ledgerSectionTokensHintSources: '加總本機 Claude Code（~/.claude/projects JSONL）與 Codex CLI（~/.codex/sessions，每檔取最後累計）；Windows 上會一併掃正在執行的 WSL 家目錄。',
    ledgerSectionTokensHintRange: '合計為最近 30 天；按月／按周／按日可選日期範圍（週從週一起算）。超出掃描窗的日期會顯示為空。',
    ledgerSectionTokensHintAccounts: '切換過的帳號仍會合計在這台機器上。',
    ledgerSectionTokensHintPricing: '金額依官方 API 標價估算，不是帳單；Codex 官價表沒有的模型不估算。',
    ledgerSectionTokensHintUnsupported: 'Cursor、DeepSeek、Kimi 沒有同等 JSONL；訂閱制百分比請見下方「配額走勢」。',
    ledgerSectionTokensInfoAria: '本機用量說明',
    ledgerLocalExportHint: '匯出最近 30 天完整本機紀錄，不受目前月／週／日篩選影響。Excel 含 Claude 與 Codex 兩個工作表。',
    ledgerLocalExportInfoAria: '本機用量匯出說明',
    ledgerLocalExportXlsx: '匯出本機用量 Excel',
    ledgerSectionCharts: '配額走勢',
    ledgerSectionChartsHint: '設定開啟「記錄用量歷史」後，把各訂閱制帳號的用量百分比存下來畫圖，含 Cursor 的內建／其他模型桶。',
    ledgerRecordingOff: '目前沒有繼續寫入新的配額歷史。到設定開啟「記錄用量歷史」。',
    ledgerTokenTitle: 'Claude 本機用量',
    ledgerTokenNeedDesktop: '要讀本機 JSONL 需要桌面殼，ng serve 純前端看不到這張表。',
    ledgerTokenEmpty: '最近 30 天找不到 Claude Code 的本機 session 紀錄。',
    ledgerCodexTitle: 'Codex 本機用量',
    ledgerCodexEmpty: '最近 30 天找不到 Codex CLI 的本機 session 紀錄。',
    ledgerTokenLocalCombined: '本機合計',
    ledgerTokenLocalCombinedHint: '這台機器上所有切過的帳號加總，不是單一帳號帳單。',
    ledgerColModel: '模型',
    ledgerColInput: '輸入',
    ledgerColOutput: '輸出',
    ledgerColCacheWrite: 'Cache 寫入',
    ledgerColCacheRead: 'Cache 讀取',
    ledgerColEstUsd: '估算 $',
    ledgerTokenTotal: '合計',
    ledgerSliceModels: '合計',
    ledgerSliceMonth: '按月',
    ledgerSliceWeek: '按周',
    ledgerSliceDays: '按日',
    ledgerSliceSessions: '按對話',
    ledgerSliceEntries: '{count} 筆',
    ledgerSliceReplies: '{count} 則回覆',
    ledgerSliceEmpty: '這邊目前沒有紀錄。',
    ledgerSlicePrev: '上一段',
    ledgerSliceNext: '下一段',
    ledgerSliceDateAria: '選擇日期',
    ledgerSliceMonthAria: '選擇月份',
    ledgerSliceWeekRange: '{start}–{end}',
    ledgerSlicePeriodHint: '只含最近 30 天掃到的本機紀錄。',
    usageHistorySettingsHint: '圖表與匯出改到「用量紀錄」頁，這裡只決定要不要繼續記錄。',
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
    usageHistoryDescription: '開啟後自動刷新固定改為每 5 分鐘一次，並把各訂閱制來源的用量記錄到本機，最長保留 1 個月。',
    usageHistoryNoData: '還沒有足夠的記錄可以畫圖。到設定開啟「記錄用量歷史」再等幾輪刷新。',
    claudeWakeUpTitle: 'Claude 用量喚醒',
    claudeWakeUpDescription: '⚠️ 這是唯一會消耗你用量額度的功能：Claude 的 5 小時／7 天視窗要送出訊息才會啟動。開啟後，下面勾選的帳號會在各自設定的時刻（本機時間，24 小時制）送一則最小訊息喚醒視窗——每個帳號一天最多一次，代價很小，但是真的對話紀錄。app 沒開著的話不會準時觸發，會等到下次刷新才補打。',
    claudeWakeUpNoAccounts: '目前沒有已擷取的 Claude 帳號可以選——請先到新增來源擷取至少一個。',
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
    quitApp: '結束程式',
    quitAppHint: '關閉視窗只會藏到 Dock／工作列，程式還在背景跑。確定要完全退出嗎？',

    hideSource: '關閉顯示',
    unhideSource: '顯示',
    hiddenSourcesTitle: '已隱藏的來源',

    infoAria: '說明',
    infoTitle: '說明',
    infoTestingTitle: '測試階段',
    infoTestingBody: 'Haul 還在測試，數字跟畫面都可能再改。看到的用量請當參考，不要當成正式帳單。',
    infoUsdTitle: '美金計價',
    infoUsdBody: '金額一律用美元（$）顯示。本機用量是依官方 API 標價估算，不是服務商開給你的帳單，也不是新台幣。',
    infoSourcesTitle: '用量來源說明',
    infoSourcesHint: '各 AI 類型怎麼讀取用量、是否支援多帳號。點擊展開詳細說明。',
    infoClaudeTitle: 'Claude',
    infoClaudeBody: '支援多帳號：每次擷取目前 Claude Code 已登入的那個帳號。升級時若本機有 cswap，會一次性匯入既有帳號，之後不再呼叫 cswap。',
    infoCodexTitle: 'Codex',
    infoCodexBody: '支援多帳號：每次擷取目前 Codex CLI 已登入的那個帳號。擷取後請立刻 `codex login` 下一個帳號（refresh token 近乎一次性）。Haul 絕不寫回 ~/.codex/auth.json，也不會幫你切帳。用量視窗錨在第一次 request，不做喚醒 ping（跟 Claude 不同，查證見說明）。',
    infoApiKeyTitle: 'DeepSeek / Kimi（API KEY）',
    infoApiKeyBody: '原生支援多個帳號，各自用獨立的 API KEY，互不影響，隨時可以新增。',
    infoKimiSubTitle: 'Kimi（訂閱）',
    infoKimiSubBody: '單一帳號，讀本機 Kimi Code CLI 的登入 session（~/.kimi-code/credentials/，含 kimi-code-env-*.json）。',
    infoGrokTitle: 'Grok',
    infoGrokBody: '單一帳號，讀本機 Grok Build CLI 的 ~/.grok/auth.json，打 CLI 自己用的用量端點。不支援 API KEY（xAI 沒有餘額查詢）。Haul 不寫回登入檔、不 refresh。請先 `grok login` 再新增來源。',
    infoCursorTitle: 'Cursor',
    infoCursorBody: '單一帳號，讀取本機 Cursor 的登入 session。Cursor 只存一份「目前登入中」的 cursorAuth（不是 Claude/Codex 那種可擷取多組 CLI 登入）。卡片兩條進度對齊設定頁「Included in Pro」：內建模型（Cursor Models，含 Grok / Composer）與其他模型（Other Models）。',
    infoDisclaimerTitle: '關於非公開端點',
    infoDisclaimerBody: 'Claude、Codex、Grok 這幾個來源目前都是打官方沒有公開文件化的內部端點，不是正式支援的公開 API，未來可能無預告改版或停用——這是已知、已評估過的取捨，不是 bug。',

    disclosureTitle: '本機資料存取聲明',
    disclosureBody: '本 App 僅讀取各 AI 官方 CLI 的本機登入資訊，以及您提供的 API KEY，皆不會外傳。',
    disclosureInfoHint: '更多說明請點選右上角圖示',
    disclosureAck: '了解',
  },
  en: {
    connectedDesktop: 'Connected to desktop shell',
    browserMode: 'Browser mode',
    connectionValid: 'Connected',
    connectionInvalid: 'Connection failed',
    connectionExpired: 'Credentials expired',
    connectionNotConfigured: 'Not configured',
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
    subscriptionSectionDesc: 'Captures the account currently logged into the CLI. Capture the same source again after switching accounts to add another.',
    apiKeySectionDesc: 'You can add several accounts, each independent — none overwrites another',
    tracked: 'Tracked',
    changeOne: 'Change',
    pasteApiKey: 'Paste {name} API KEY',
    addBtn: 'Add',
    noInputNeeded: 'Nothing to type — press the button below and this tool will read your local login info.',
    captureHintClaude: 'Haul reads Claude Code logins from the local home directory, and on Windows also from running WSL distros. Capture adds every account it finds; the same email is kept once. Haul copies a snapshot only — it will not change the CLI login or switch accounts for you.',
    captureHintCodex: 'Haul reads `codex login` from the local home directory, and on Windows also from running WSL distros. Capture adds every account it finds. Codex refresh tokens are near-single-use: to add another account that is not logged in yet, capture then immediately log into that account in the terminal — don’t open the Codex CLI first and let it rotate the token. Haul never writes back to ~/.codex/auth.json.',
    grokAddHint: 'Run `grok login` in the terminal first, then detect. Haul only reads ~/.grok/auth.json — it will not write it back or refresh tokens. An API KEY cannot query subscription usage.',
    capturing: 'Capturing…',
    captureBtn: 'Capture current login',
    detecting: 'Detecting…',
    startDetect: 'Start detecting',
    capturedSuccess: 'Captured {name}. To add another account, log into it in the terminal then capture again.',
    capturedSuccessMultiple: 'Captured {count} accounts (including running WSL homes).',
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
    snapshotNotFound: 'No snapshot for this account — add the source again to capture the current CLI login',
    captureRefreshMissing: 'The login has no refresh token. Log in again in the terminal, then capture.',
    captureEmailMissing: 'The login has no email, so the account cannot be identified. Confirm the CLI is logged in and try again.',
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
    deepSeekBalance: 'Remaining balance ${balance}',
    deepSeekCallFailed: "Failed to call DeepSeek's usage endpoint: {message}",
    kimiInvalidKey: 'API KEY was rejected (revoked, malformed, or this is a platform.kimi.ai API KEY rather than moonshot.ai)',
    kimiHttpError: 'Kimi returned an error: HTTP {status}',
    kimiParseError: "Could not parse Kimi's response, or it reported failure: {body}",
    kimiBalance: 'Remaining balance ${balance}',
    kimiCallFailed: "Failed to call Kimi's usage endpoint: {message}",
    kimiSubCredentialsNotFound: "Couldn't find Kimi Code's login credentials — run `/login` inside the Kimi Code CLI first",
    kimiSubCredentialsRejected: 'Kimi Code rejected the current login credentials — run `/login` again',
    kimiSubHttpErrorWithBody: 'Usage endpoint returned an error: HTTP {status}　{body}',
    kimiSubParseErrorUnverified: "Could not parse the usage endpoint's response (this endpoint is unverified — if you're the first to hit this, please paste this response for the developer): {body}",
    grokCredentialsNotFound: "Couldn't find Grok Build login credentials — run `grok login` in the terminal first",
    grokCredentialsRejected: 'Grok rejected the current login credentials — run `grok login` again',
    grokHttpErrorWithBody: 'Usage endpoint returned an error: HTTP {status}　{body}',
    grokParseErrorUnverified: "Could not parse the usage endpoint's response (if you're the first to hit this, please paste this response for the developer): {body}",

    widgetDetails: 'Details',
    widgetCollapse: 'Collapse',
    widgetQuit: 'Quit',

    settingsTitle: 'Settings',
    settingsAria: 'Settings',
    ledgerAria: 'Usage records',
    ledgerTitle: 'Usage records',
    ledgerDescription: 'What already happened on this machine — not a forecast. Estimated dollars are not a bill.',
    ledgerSectionTokens: 'Local usage',
    ledgerSectionTokensHintSources: 'Local Claude Code (~/.claude/projects JSONL) and Codex CLI (~/.codex/sessions, last cumulative total per file) are totaled here; on Windows, running WSL homes are scanned too.',
    ledgerSectionTokensHintRange: 'All covers the last 30 days; Month / Week / Day select a date range (weeks start Monday). Dates outside the scan window are empty.',
    ledgerSectionTokensHintAccounts: 'Accounts switched on this machine remain combined in the total.',
    ledgerSectionTokensHintPricing: 'Dollar amounts use official API list prices and are estimates, not bills. Codex models missing from the price list remain unpriced.',
    ledgerSectionTokensHintUnsupported: 'Cursor, DeepSeek, and Kimi have no equivalent JSONL; see Quota trend below for subscription percentages.',
    ledgerSectionTokensInfoAria: 'About local usage',
    ledgerLocalExportHint: 'Exports the complete last 30 days of local records, regardless of the selected month, week, or day. The workbook contains separate Claude and Codex sheets.',
    ledgerLocalExportInfoAria: 'About local usage export',
    ledgerLocalExportXlsx: 'Export local usage Excel',
    ledgerSectionCharts: 'Quota trend',
    ledgerSectionChartsHint: 'When “Record usage history” is on, subscription percentages are stored and charted — including Cursor’s two model buckets.',
    ledgerRecordingOff: 'New quota-history samples are not being written. Turn on “Record usage history” in Settings.',
    ledgerTokenTitle: 'Claude local usage',
    ledgerTokenNeedDesktop: 'Reading local JSONL needs the desktop shell. This table is empty under ng serve.',
    ledgerTokenEmpty: 'No Claude Code session logs found in the last 30 days.',
    ledgerCodexTitle: 'Codex local usage',
    ledgerCodexEmpty: 'No Codex CLI session logs found in the last 30 days.',
    ledgerTokenLocalCombined: 'Local combined',
    ledgerTokenLocalCombinedHint: 'All accounts ever used on this machine, not a single-account bill.',
    ledgerColModel: 'Model',
    ledgerColInput: 'Input',
    ledgerColOutput: 'Output',
    ledgerColCacheWrite: 'Cache write',
    ledgerColCacheRead: 'Cache read',
    ledgerColEstUsd: 'Est. $',
    ledgerTokenTotal: 'Total',
    ledgerSliceModels: 'All',
    ledgerSliceMonth: 'Month',
    ledgerSliceWeek: 'Week',
    ledgerSliceDays: 'Day',
    ledgerSliceSessions: 'Conversations',
    ledgerSliceEntries: '{count} entries',
    ledgerSliceReplies: '{count} replies',
    ledgerSliceEmpty: 'Nothing to show here.',
    ledgerSlicePrev: 'Previous',
    ledgerSliceNext: 'Next',
    ledgerSliceDateAria: 'Choose a date',
    ledgerSliceMonthAria: 'Choose a month',
    ledgerSliceWeekRange: '{start}–{end}',
    ledgerSlicePeriodHint: 'Only local records from the last 30 days.',
    usageHistorySettingsHint: 'Charts and export live on the Usage records page. This switch only controls whether new samples are recorded.',
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
    usageHistoryDescription: 'When on, auto-refresh switches to a fixed 5-minute cadence and each subscription source’s usage is recorded locally (kept for up to 1 month).',
    usageHistoryNoData: 'Not enough recorded data to chart yet. Turn on “Record usage history” in Settings and wait for a few more refreshes.',
    claudeWakeUpTitle: 'Claude usage wake-up',
    claudeWakeUpDescription: "⚠️ The only feature that spends real usage: Claude's 5-hour/7-day windows only start once a message is sent. When on, each selected account below gets one minimal message at its own set hour (local time, 24-hour) to wake its window — once a day per account, tiny cost, but a real logged conversation. Won't fire on time if the app isn't open; it catches up on the next refresh instead.",
    claudeWakeUpNoAccounts: 'No captured Claude accounts yet — add a source and capture at least one first.',
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
    quitApp: 'Quit',
    quitAppHint: 'Closing the window only hides Haul to the Dock / taskbar; it keeps running in the background. Quit completely?',

    hideSource: 'Hide',
    unhideSource: 'Show',
    hiddenSourcesTitle: 'Hidden sources',

    infoAria: 'About',
    infoTitle: 'About',
    infoTestingTitle: 'Testing preview',
    infoTestingBody: 'Haul is still in testing. Numbers and screens may change. Treat usage figures as a reference, not an official bill.',
    infoUsdTitle: 'US dollar pricing',
    infoUsdBody: 'All amounts are shown in US dollars ($). Local usage is estimated from official API list prices — not the bill your provider sends you, and not a local-currency total.',
    infoSourcesTitle: 'Usage sources',
    infoSourcesHint: 'How each AI type reads usage and whether multiple accounts are supported. Select to expand.',
    infoClaudeTitle: 'Claude',
    infoClaudeBody: 'Multiple accounts: capture whichever account Claude Code is currently logged into. If cswap was already in use, existing accounts are imported once on upgrade — cswap is not called at runtime after that.',
    infoCodexTitle: 'Codex',
    infoCodexBody: 'Multiple accounts: capture whichever account the Codex CLI is currently logged into. After capturing, immediately `codex login` the next account (refresh tokens are near-single-use). Haul never writes back to ~/.codex/auth.json and will not switch accounts for you. Usage windows anchor to the first request — no wake-up ping (unlike Claude).',
    infoApiKeyTitle: 'DeepSeek / Kimi (API KEY)',
    infoApiKeyBody: 'Natively supports multiple accounts, each with its own independent API KEY — add as many as you like.',
    infoKimiSubTitle: 'Kimi (Subscription)',
    infoKimiSubBody: "Single account, reads the local Kimi Code CLI login (~/.kimi-code/credentials/, including kimi-code-env-*.json).",
    infoGrokTitle: 'Grok',
    infoGrokBody: "Single account, reads the local Grok Build CLI ~/.grok/auth.json and calls the CLI's own usage endpoint. API KEY isn't supported (xAI has no balance query). Haul does not write the login file or refresh tokens. Run `grok login` before adding the source.",
    infoCursorTitle: 'Cursor',
    infoCursorBody: "Single account, reads the local Cursor login session. Cursor only stores one current cursorAuth login (not a Claude/Codex-style capture of multiple CLI sessions). The two bars match Settings → Included in Pro: Cursor Models (Grok / Composer) and Other Models.",
    infoDisclaimerTitle: 'About undocumented endpoints',
    infoDisclaimerBody: 'The Claude, Codex, and Grok sources currently call undocumented internal endpoints, not officially published public APIs — they could change or be disabled without notice in the future. This is a known, deliberately-evaluated trade-off, not a bug.',

    disclosureTitle: 'Local data access notice',
    disclosureBody: "This app only reads local login info from each AI's official CLI, and any API keys you provide — none of it is ever sent elsewhere.",
    disclosureInfoHint: 'Tap the icon in the top-right corner for more about Haul',
    disclosureAck: 'Got it',
  },
};
