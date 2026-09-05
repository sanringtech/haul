using System.Globalization;
using System.Text.Json;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// 掃描 Codex CLI 本機 session JSONL（唯讀）。
///
/// 路徑：<c>$CODEX_HOME/sessions/**/*.jsonl</c>，預設 <c>~/.codex/sessions</c>。
/// 欄位（2026-09-03 實機）：<c>turn_context.payload.model</c>、
/// <c>event_msg / token_count / info.total_token_usage</c>
/// （<c>input_tokens</c> 含 cache、<c>cached_input_tokens</c> 是其中已命中的部分、
/// <c>cache_write_input_tokens</c>、<c>output_tokens</c>；<c>reasoning_output_tokens</c> ≤ output，不另加）。
///
/// <c>total_token_usage</c> 是單檔累計，<c>last_token_usage</c> 多數是增量但有重複列，
/// 所以每個 session 只取最後一筆 total。本機檔案沒有混模型。金額用官方 Standard 短上下文標價
/// （<see href="https://developers.openai.com/api/docs/pricing"/>，2026-09-03）。
/// 沒列在官價表的模型（例如 <c>codex-auto-review</c>）金額為空。從不寫回這些檔。
/// </summary>
public static class CodexJsonlLedger
{
    public const int RetentionDays = 30;

    public static TokenLedger Scan()
    {
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        var byModel = new Dictionary<string, Acc>(StringComparer.Ordinal);
        var byDay = new Dictionary<string, SliceAcc>(StringComparer.Ordinal);
        var bySession = new Dictionary<string, SliceAcc>(StringComparer.Ordinal);
        long sessions = 0;
        DateTime? oldest = null;
        DateTime? newest = null;

        foreach (var file in EnumerateJsonlFiles())
        {
            if (!TryReadSession(file, cutoff, out var model, out var acc, out var first, out var last))
                continue;
            sessions++;
            if (first != default && (oldest is null || first < oldest)) oldest = first;
            if (last != default && (newest is null || last > newest)) newest = last;
            if (!byModel.TryGetValue(model, out var existing))
            {
                existing = new Acc();
                byModel[model] = existing;
            }
            existing.Add(acc);
            var at = last != default ? last : first;
            // ponytail: Codex 只有檔尾累計，跨日 session 整桶算在最後一天。
            if (at != default)
                AddSlice(byDay, at.ToLocalTime().ToString("yyyy-MM-dd"), model, acc, at);
            AddSlice(bySession, file, model, acc, first != default ? first : at, at);
        }

        return new TokenLedger(
            "codex",
            "local-combined",
            ToRows(byModel),
            sessions,
            oldest?.ToString("o"),
            newest?.ToString("o"),
            ToDaySlices(byDay),
            ToSessionSlices(bySession));
    }

    private static IEnumerable<string> EnumerateJsonlFiles()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var home in CliHomeRoots.CodexHomes())
        {
            var sessions = Path.Combine(home, "sessions");
            if (!Directory.Exists(sessions)) continue;

            IEnumerable<string> files;
            try
            {
                files = Directory.EnumerateFiles(sessions, "*.jsonl", SearchOption.AllDirectories);
            }
            catch (Exception)
            {
                continue;
            }

            foreach (var file in files)
            {
                if (string.Equals(Path.GetFileName(file), "session_index.jsonl", StringComparison.OrdinalIgnoreCase))
                    continue;
                if (seen.Add(file)) yield return file;
            }
        }
    }

    private static bool TryReadSession(
        string file,
        DateTime cutoff,
        out string model,
        out Acc acc,
        out DateTime first,
        out DateTime last)
    {
        model = "";
        acc = new Acc();
        first = default;
        last = default;
        string? lastModel = null;
        Acc? lastUsage = null;

        try
        {
            foreach (var line in File.ReadLines(file))
            {
                if (line.Length == 0 || line[0] != '{') continue;
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var root = doc.RootElement;
                    var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;
                    if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
                        continue;

                    if (type == "turn_context" && payload.TryGetProperty("model", out var modelEl))
                    {
                        var name = modelEl.GetString();
                        if (!string.IsNullOrEmpty(name)) lastModel = name;
                    }
                    else if (type == "event_msg"
                             && payload.TryGetProperty("type", out var ev) && ev.GetString() == "token_count"
                             && payload.TryGetProperty("info", out var info) && info.ValueKind == JsonValueKind.Object
                             && info.TryGetProperty("total_token_usage", out var total) && total.ValueKind == JsonValueKind.Object)
                    {
                        if (root.TryGetProperty("timestamp", out var tsEl) && tsEl.ValueKind == JsonValueKind.String
                            && DateTime.TryParse(tsEl.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var at))
                        {
                            if (at.Kind == DateTimeKind.Unspecified)
                                at = DateTime.SpecifyKind(at, DateTimeKind.Utc);
                            if (first == default) first = at;
                            last = at;
                        }
                        lastUsage = ReadUsage(total);
                    }
                }
                catch (JsonException)
                {
                }
            }
        }
        catch (IOException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }

        if (lastUsage is null) return false;
        if (last != default && last.ToUniversalTime() < cutoff) return false;

        model = lastModel ?? "unknown";
        acc = lastUsage;
        return true;
    }

    private static Acc ReadUsage(JsonElement total) => new()
    {
        Input = ReadInt64(total, "input_tokens"),
        Output = ReadInt64(total, "output_tokens"),
        CacheWrite = ReadInt64(total, "cache_write_input_tokens"),
        CacheRead = ReadInt64(total, "cached_input_tokens"),
    };

    private static long ReadInt64(JsonElement obj, string name)
    {
        if (!obj.TryGetProperty(name, out var el)) return 0;
        return el.ValueKind switch
        {
            JsonValueKind.Number when el.TryGetInt64(out var n) => n,
            JsonValueKind.Number when el.TryGetDouble(out var d) => (long)d,
            _ => 0,
        };
    }

    /// <summary>
    /// Official OpenAI Standard / short-context list prices (USD / million tokens), 2026-09-03:
    /// https://developers.openai.com/api/docs/pricing
    /// Cached input is billed separately; uncached = input − cached.
    /// </summary>
    private static Rates? RatesFor(string model)
    {
        var m = model.ToLowerInvariant().Replace('_', '-');
        if (m.Contains("gpt-5.6-sol", StringComparison.Ordinal) || m.Contains("gpt-5-6-sol", StringComparison.Ordinal))
            return new Rates(4, 0.40, 5, 20);
        if (m.Contains("gpt-5.6-terra", StringComparison.Ordinal) || m.Contains("gpt-5-6-terra", StringComparison.Ordinal))
            return new Rates(2, 0.20, 2.50, 12);
        if (m.Contains("gpt-5.6-luna", StringComparison.Ordinal) || m.Contains("gpt-5-6-luna", StringComparison.Ordinal))
            return new Rates(0.20, 0.02, 0.25, 1.20);
        if (m.Contains("gpt-5.6-cyber", StringComparison.Ordinal) || m.Contains("gpt-5-6-cyber", StringComparison.Ordinal))
            return new Rates(12.50, 1.25, 15.625, 75);
        if (m.Contains("gpt-5.5-pro", StringComparison.Ordinal) || m.Contains("gpt-5-5-pro", StringComparison.Ordinal))
            return new Rates(30, 0, 0, 180);
        if (m.Contains("gpt-5.5", StringComparison.Ordinal) || m.Contains("gpt-5-5", StringComparison.Ordinal))
            return new Rates(5, 0.50, 0, 30);
        if (m.Contains("gpt-5.4-pro", StringComparison.Ordinal) || m.Contains("gpt-5-4-pro", StringComparison.Ordinal))
            return new Rates(30, 0, 0, 180);
        if (m.Contains("gpt-5.4-mini", StringComparison.Ordinal) || m.Contains("gpt-5-4-mini", StringComparison.Ordinal))
            return new Rates(0.75, 0.075, 0, 4.50);
        if (m.Contains("gpt-5.4-nano", StringComparison.Ordinal) || m.Contains("gpt-5-4-nano", StringComparison.Ordinal))
            return new Rates(0.20, 0.02, 0, 1.25);
        if (m.Contains("gpt-5.4", StringComparison.Ordinal) || m.Contains("gpt-5-4", StringComparison.Ordinal))
            return new Rates(2.50, 0.25, 0, 15);
        if (m.Contains("gpt-5.3-codex", StringComparison.Ordinal) || m.Contains("gpt-5-3-codex", StringComparison.Ordinal))
            return new Rates(1.75, 0.175, 0, 14);
        if (m.Contains("gpt-5.2-pro", StringComparison.Ordinal) || m.Contains("gpt-5-2-pro", StringComparison.Ordinal))
            return new Rates(21, 0, 0, 168);
        if (m.Contains("gpt-5.2", StringComparison.Ordinal) || m.Contains("gpt-5-2", StringComparison.Ordinal))
            return new Rates(1.75, 0.175, 0, 14);
        if (m.Contains("gpt-5.1", StringComparison.Ordinal) || m.Contains("gpt-5-1", StringComparison.Ordinal))
            return new Rates(1.25, 0.125, 0, 10);
        if (m.Contains("gpt-5-pro", StringComparison.Ordinal))
            return new Rates(15, 0, 0, 120);
        if (m.Contains("gpt-5-mini", StringComparison.Ordinal))
            return new Rates(0.25, 0.025, 0, 2);
        if (m.Contains("gpt-5-nano", StringComparison.Ordinal))
            return new Rates(0.05, 0.005, 0, 0.40);
        if (m is "gpt-5" or "gpt-5-chat")
            return new Rates(1.25, 0.125, 0, 10);
        return null;
    }

    private static void AddSlice(Dictionary<string, SliceAcc> map, string key, string model, Acc delta, DateTime at, DateTime? newest = null)
    {
        if (!map.TryGetValue(key, out var slice))
        {
            slice = new SliceAcc();
            map[key] = slice;
        }
        slice.Entries++;
        var end = newest ?? at;
        if (at != default && (slice.Oldest is null || at < slice.Oldest)) slice.Oldest = at;
        if (end != default && (slice.Newest is null || end > slice.Newest)) slice.Newest = end;
        if (!slice.Models.TryGetValue(model, out var acc))
        {
            acc = new Acc();
            slice.Models[model] = acc;
        }
        acc.Add(delta);
    }

    private static TokenRow[] ToRows(Dictionary<string, Acc> byModel) =>
        [.. byModel
            .Select(kv => kv.Value.ToRow(kv.Key))
            .OrderByDescending(r => r.EstimatedCostUsd ?? 0)
            .ThenByDescending(r => r.InputTokens + r.OutputTokens + r.CacheReadTokens)];

    private static TokenSlice[] ToDaySlices(Dictionary<string, SliceAcc> byDay) =>
        [.. byDay
            .OrderByDescending(kv => kv.Key, StringComparer.Ordinal)
            .Select(kv => kv.Value.ToSlice(kv.Key, kv.Key))];

    private static TokenSlice[] ToSessionSlices(Dictionary<string, SliceAcc> bySession) =>
        [.. bySession
            .OrderByDescending(kv => kv.Value.Newest ?? DateTime.MinValue)
            .Select(kv => kv.Value.ToSlice(kv.Key, TokenSliceUi.SessionLabel(kv.Key, kv.Value.Oldest, kv.Value.Newest)))];

    private sealed class SliceAcc
    {
        public readonly Dictionary<string, Acc> Models = new(StringComparer.Ordinal);
        public long Entries;
        public DateTime? Oldest;
        public DateTime? Newest;

        public TokenSlice ToSlice(string key, string label) =>
            new(key, label, ToRows(Models), Entries, Oldest?.ToString("o"), Newest?.ToString("o"));
    }

    private readonly record struct Rates(double Input, double CachedInput, double CacheWrite, double Output);

    private sealed class Acc
    {
        public long Input;
        public long Output;
        public long CacheWrite;
        public long CacheRead;

        public void Add(Acc other)
        {
            Input += other.Input;
            Output += other.Output;
            CacheWrite += other.CacheWrite;
            CacheRead += other.CacheRead;
        }

        public TokenRow ToRow(string model)
        {
            var uncached = Math.Max(0, Input - CacheRead);
            var rates = RatesFor(model);
            double? usd = rates is { } r
                ? Math.Round(
                    (uncached * r.Input
                     + CacheRead * r.CachedInput
                     + CacheWrite * r.CacheWrite
                     + Output * r.Output) / 1_000_000d,
                    4,
                    MidpointRounding.AwayFromZero)
                : null;
            return new TokenRow(model, Input, Output, CacheWrite, 0, CacheRead, usd);
        }
    }
}
