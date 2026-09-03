using ClosedXML.Excel;

namespace UsageMonitor.Desktop.Services;

/// <summary>Exports the complete local 30-day token scan. Each provider gets its own worksheet.</summary>
public static class LocalTokenUsageExporter
{
    public static byte[] BuildXlsx(TokenLedger claude, TokenLedger codex, bool zhTw)
    {
        using var workbook = new XLWorkbook();
        AddSheet(workbook, claude, zhTw ? "Claude 本機用量" : "Claude local usage", zhTw);
        AddSheet(workbook, codex, zhTw ? "Codex 本機用量" : "Codex local usage", zhTw);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static void AddSheet(XLWorkbook workbook, TokenLedger ledger, string name, bool zhTw)
    {
        var sheet = workbook.Worksheets.Add(name);
        var headers = zhTw
            ? new[] { "日期", "模型", "輸入", "輸出", "Cache 寫入", "Cache 讀取", "估算 USD" }
            : new[] { "Date", "Model", "Input", "Output", "Cache write", "Cache read", "Estimated USD" };

        for (var column = 0; column < headers.Length; column++)
            sheet.Cell(1, column + 1).Value = headers[column];
        sheet.Row(1).Style.Font.Bold = true;
        sheet.SheetView.FreezeRows(1);

        var row = 2;
        foreach (var day in ledger.Days.OrderBy(d => d.Key, StringComparer.Ordinal))
        {
            foreach (var model in day.Models)
            {
                if (DateTime.TryParseExact(day.Key, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out var date))
                {
                    sheet.Cell(row, 1).Value = date;
                    sheet.Cell(row, 1).Style.DateFormat.Format = "yyyy-mm-dd";
                }
                else
                {
                    sheet.Cell(row, 1).Value = day.Key;
                }
                sheet.Cell(row, 2).Value = model.Model;
                sheet.Cell(row, 3).Value = model.InputTokens;
                sheet.Cell(row, 4).Value = model.OutputTokens;
                sheet.Cell(row, 5).Value = model.CacheCreation5mTokens + model.CacheCreation1hTokens;
                sheet.Cell(row, 6).Value = model.CacheReadTokens;
                if (model.EstimatedCostUsd is double cost)
                {
                    sheet.Cell(row, 7).Value = cost;
                    sheet.Cell(row, 7).Style.NumberFormat.Format = "$0.0000";
                }
                row++;
            }
        }

        if (row > 2)
            sheet.Range(1, 1, row - 1, headers.Length).CreateTable();
        sheet.Columns().AdjustToContents();
    }
}
