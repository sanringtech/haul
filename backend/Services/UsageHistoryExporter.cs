using System.Text;
using ClosedXML.Excel;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// 把 <see cref="UsageHistoryStore"/> 存的資料點轉成使用者可以直接開的檔案。這裡是後端少數自己
/// 組「顯示用文字」的地方——跟其餘 provider 那套「只送 key，前端 i18n 渲染」的原則不一樣，因為
/// 匯出的檔案本身就是最終產物，沒有前端可以再翻譯一次；改用呼叫端傳來的 lang 挑對應的表頭字串，
/// 只有匯出功能自己用得到，範圍很小，不是要另外做一套後端 i18n。
/// </summary>
public static class UsageHistoryExporter
{
    /// <summary>window_label_key 只會是這兩個值之一（見 MessageKeys.FiveHourLabel/SevenDayLabel）——
    /// 目前有第二視窗的來源只有 Claude/Codex 的 5h+7d，未來如果多了新的 key 這裡沒對到就直接顯示
    /// 原始 key，不會噴例外。</summary>
    private static string ResolveWindowLabel(string? key, bool zhTw) => key switch
    {
        "fiveHourLabel" => zhTw ? "5 小時" : "5h",
        "sevenDayLabel" => zhTw ? "7 天" : "7d",
        null => "",
        _ => key,
    };

    public static string BuildMarkdown(IReadOnlyList<UsageHistoryPoint> points, bool zhTw)
    {
        var sb = new StringBuilder();
        sb.AppendLine(zhTw ? "# 用量歷史記錄" : "# Usage history");
        sb.AppendLine();
        sb.AppendLine(zhTw
            ? $"匯出時間：{DateTime.Now:yyyy-MM-dd HH:mm:ss}　共 {points.Count} 筆"
            : $"Exported at {DateTime.Now:yyyy-MM-dd HH:mm:ss} · {points.Count} rows");
        sb.AppendLine();

        var (timeCol, accountCol, windowCol, percentCol, stateCol) = zhTw
            ? ("時間", "帳號", "視窗", "用量 %", "狀態")
            : ("Time", "Account", "Window", "Usage %", "State");
        sb.AppendLine($"| {timeCol} | {accountCol} | {windowCol} | {percentCol} | {stateCol} |");
        sb.AppendLine("| --- | --- | --- | --- | --- |");

        foreach (var p in points)
        {
            var localTime = DateTime.Parse(p.RecordedAtUtc).ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss");
            var account = p.AccountLabel ?? p.DisplayName;
            var window = ResolveWindowLabel(p.WindowLabelKey, zhTw);
            sb.AppendLine($"| {localTime} | {account} | {window} | {p.PercentUsed:0.0} | {p.UsageState} |");
        }

        return sb.ToString();
    }

    public static byte[] BuildXlsx(IReadOnlyList<UsageHistoryPoint> points, bool zhTw)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add(zhTw ? "用量歷史" : "Usage history");

        var (timeCol, accountCol, windowCol, percentCol, stateCol) = zhTw
            ? ("時間", "帳號", "視窗", "用量 %", "狀態")
            : ("Time", "Account", "Window", "Usage %", "State");
        sheet.Cell(1, 1).Value = timeCol;
        sheet.Cell(1, 2).Value = accountCol;
        sheet.Cell(1, 3).Value = windowCol;
        sheet.Cell(1, 4).Value = percentCol;
        sheet.Cell(1, 5).Value = stateCol;
        sheet.Row(1).Style.Font.Bold = true;

        var row = 2;
        foreach (var p in points)
        {
            var localTime = DateTime.Parse(p.RecordedAtUtc).ToLocalTime();
            sheet.Cell(row, 1).Value = localTime;
            sheet.Cell(row, 1).Style.DateFormat.Format = "yyyy-mm-dd hh:mm:ss";
            sheet.Cell(row, 2).Value = p.AccountLabel ?? p.DisplayName;
            sheet.Cell(row, 3).Value = ResolveWindowLabel(p.WindowLabelKey, zhTw);
            sheet.Cell(row, 4).Value = p.PercentUsed;
            sheet.Cell(row, 5).Value = p.UsageState;
            row++;
        }

        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
