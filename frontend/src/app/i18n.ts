/**
 * 輕量 i18n：一份翻譯字典，跟主題切換共用同一種「signal 控制、當場生效、不重載」的模式
 * （見 app.ts 的 theme signal）。不用 @angular/localize——那是 build-time 多 bundle 機制，
 * 每個語言各自編譯一份完整 Angular 打包，沒有內建的「app 內即時切換」，跟這裡要的體驗不合，
 * 詳見這次跟使用者的討論。
 *
 * ⚠️ 已知限制：這裡只涵蓋前端自己寫的字串（按鈕、標籤、提示文字）。每張卡片實際顯示的
 * detail/百分比視窗標籤（例如 "5 小時"/"7 天"、"08:07 重置"、"剩餘額度 10.00"、各種錯誤訊息）
 * 是後端 Provider 產生後直接塞在 UsageSummary.Detail 這類欄位裡的中文字串（見 backend/Providers/
 * *.cs），前端語言切換動不到它們——要做到完整雙語，後端也要有一套對應機制。這次先做前端 chrome。
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
  parseError: string;
  switchToLight: string;
  switchToDark: string;
  switchToEnglish: string;
  switchToChinese: string;
}

export const translations: Record<Lang, Translations> = {
  'zh-TW': {
    connectedDesktop: '已連接桌面殼層',
    browserMode: '瀏覽器模式',
    refresh: '重新整理用量',
    refreshing: '重新整理中…',
    lastUpdated: '上次更新 {time}',
    noSourcesTracked: '還沒有追蹤任何來源',
    addSource: '＋ 新增來源',
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
    back: '← 返回',
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
    parseError: '收到無法解析的訊息: {raw}',
    switchToLight: '切換成淺色模式',
    switchToDark: '切換成深色模式',
    switchToEnglish: '切換成英文',
    switchToChinese: '切換成中文',
  },
  en: {
    connectedDesktop: 'Connected to desktop shell',
    browserMode: 'Browser mode',
    refresh: 'Refresh usage',
    refreshing: 'Refreshing…',
    lastUpdated: 'Last updated {time}',
    noSourcesTracked: 'No sources tracked yet',
    addSource: '+ Add source',
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
    back: '← Back',
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
    parseError: 'Received an unparseable message: {raw}',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
    switchToEnglish: 'Switch to English',
    switchToChinese: 'Switch to Chinese',
  },
};
