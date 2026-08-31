namespace UsageMonitor.Desktop.Models;

/// <summary>
/// A message the frontend renders through its own翻譯表（frontend/src/app/i18n.ts）——後端只送一個穩定的
/// key + 動態部分當 params，從來不送組好的中文句子，這樣同一個 key 不管使用者切到哪個語言都能正確顯示，
/// 後端完全不需要知道「語言」這個概念。<see cref="Key"/> 必須同時存在於 i18n.ts 的 zh-TW 跟 en 兩個物件裡
/// （TypeScript 的 Translations 介面會在缺任一邊時編譯期報錯），對照表見 <see cref="MessageKeys"/>。
/// </summary>
public sealed record LocalizedText(string Key, IReadOnlyDictionary<string, string>? Params = null);
