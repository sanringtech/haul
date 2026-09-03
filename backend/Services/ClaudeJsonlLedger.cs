using System.Globalization;
using System.Text.Json;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// 掃描 Claude Code 本機 session JSONL（唯讀），產出帳簿頁的分模型 token／估算金額。
///
/// 路徑對照（2026-09-03 實機核過）：<c>~/.claude/projects/**/*.jsonl</c>，以及較新的
/// <c>~/.config/claude/projects/</c>；<c>CLAUDE_CONFIG_DIR</c> 若有設，每個根底下再找 <c>projects/</c>。
/// 從不寫回這些檔。
///
/// 欄位對照（assistant 列）：<c>message.model</c>、
/// <c>message.usage.{input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens}</c>、
/// <c>message.usage.cache_creation.ephemeral_5m_input_tokens / ephemeral_1h_input_tokens</c>、
/// <c>requestId</c>（去重）、<c>timestamp</c>。本機樣本沒有 <c>costUSD</c>，金額用官方 API 標價估算
/// （<see href="https://platform.claude.com/docs/en/about-claude/pricing"/>，2026-09-03）。
/// </summary>
public static class ClaudeJsonlLedger
{
    public const int RetentionDays = 30;

    public static TokenLedger Scan()
    {
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var byModel = new Dictionary<string, Acc>(StringComparer.Ordinal);
        var byDay = new Dictionary<string, SliceAcc>(StringComparer.Ordinal);
        var bySession = new Dictionary<string, SliceAcc>(StringComparer.Ordinal);
        long messages = 0;
        DateTime? oldest = null;
        DateTime? newest = null;

        foreach (var file in EnumerateJsonlFiles())
        {
            try
            {
                foreach (var line in File.ReadLines(file))
                {
                    if (line.Length == 0 || line[0] != '{') continue;
                    try
                    {
                        using var doc = JsonDocument.Parse(line);
                        if (!TryReadAssistantUsage(doc.RootElement, cutoff, seen, out var model, out var delta, out var at))
                            continue;
                        messages++;
                        if (at != default)
                        {
                            if (oldest is null || at < oldest) oldest = at;
                            if (newest is null || at > newest) newest = at;
                            AddSlice(byDay, at.ToLocalTime().ToString("yyyy-MM-dd"), model, delta, at);
                        }
                        if (!byModel.TryGetValue(model, out var acc))
                        {
                            acc = new Acc();
                            byModel[model] = acc;
                        }
                        acc.Add(delta);
                        // agent-* 是主對話拉出來的子任務，合計／按日仍算進去，按對話不單列。
                        if (!TokenSliceUi.IsClaudeSubagent(file))
                            AddSlice(bySession, file, model, delta, at);
                    }
                    catch (JsonException)
                    {
                        // 單行壞掉就跳過，不要讓整份 session 報廢。
                    }
                }
            }
            catch (IOException)
            {
                // 檔案被 Claude Code 鎖住或中途消失——跳過這個檔。
            }
            catch (UnauthorizedAccessException)
            {
            }
        }

        var models = ToRows(byModel);
        return new TokenLedger(
            "claude",
            "local-combined",
            models,
            messages,
            oldest?.ToString("o"),
            newest?.ToString("o"),
            ToDaySlices(byDay),
            ToSessionSlices(bySession));
    }

    private static IEnumerable<string> EnumerateJsonlFiles()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var root in ProjectRoots())
        {
            if (!Directory.Exists(root)) continue;
            IEnumerable<string> files;
            try
            {
                files = Directory.EnumerateFiles(root, "*.jsonl", SearchOption.AllDirectories);
            }
            catch (Exception)
            {
                continue;
            }
            foreach (var file in files)
            {
                if (seen.Add(file)) yield return file;
            }
        }
    }

    private static IEnumerable<string> ProjectRoots()
    {
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var env = Environment.GetEnvironmentVariable("CLAUDE_CONFIG_DIR");
        if (!string.IsNullOrWhiteSpace(env))
        {
            foreach (var part in env.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
                yield return Path.Combine(part, "projects");
            yield break;
        }
        yield return Path.Combine(home, ".config", "claude", "projects");
        yield return Path.Combine(home, ".claude", "projects");
    }

    private static bool TryReadAssistantUsage(
        JsonElement root,
        DateTime cutoff,
        HashSet<string> seen,
        out string model,
        out Acc row,
        out DateTime timestamp)
    {
        model = "";
        row = new Acc();
        timestamp = default;
        if (!root.TryGetProperty("type", out var typeEl) || typeEl.GetString() != "assistant")
            return false;
        if (!root.TryGetProperty("message", out var message) || message.ValueKind != JsonValueKind.Object)
            return false;
        if (!message.TryGetProperty("usage", out var usage) || usage.ValueKind != JsonValueKind.Object)
            return false;

        model = message.TryGetProperty("model", out var modelEl) ? modelEl.GetString() ?? "" : "";
        if (model.Length == 0 || model == "<synthetic>") return false;

        if (root.TryGetProperty("timestamp", out var tsEl) && tsEl.ValueKind == JsonValueKind.String)
        {
            if (!DateTime.TryParse(tsEl.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out timestamp))
                return false;
            if (timestamp.Kind == DateTimeKind.Unspecified)
                timestamp = DateTime.SpecifyKind(timestamp, DateTimeKind.Utc);
            if (timestamp.ToUniversalTime() < cutoff) return false;
        }

        var dedupe = root.TryGetProperty("requestId", out var rid) ? rid.GetString()
            : root.TryGetProperty("uuid", out var uid) ? uid.GetString()
            : null;
        if (!string.IsNullOrEmpty(dedupe) && !seen.Add(dedupe)) return false;

        var input = ReadInt64(usage, "input_tokens");
        var output = ReadInt64(usage, "output_tokens");
        var cacheRead = ReadInt64(usage, "cache_read_input_tokens");
        var cache5m = 0L;
        var cache1h = 0L;
        if (usage.TryGetProperty("cache_creation", out var creation) && creation.ValueKind == JsonValueKind.Object)
        {
            cache5m = ReadInt64(creation, "ephemeral_5m_input_tokens");
            cache1h = ReadInt64(creation, "ephemeral_1h_input_tokens");
        }
        if (cache5m == 0 && cache1h == 0)
            cache5m = ReadInt64(usage, "cache_creation_input_tokens");

        row = new Acc
        {
            Input = input,
            Output = output,
            Cache5m = cache5m,
            Cache1h = cache1h,
            CacheRead = cacheRead,
        };
        return true;
    }

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
    /// Official Claude API list prices (USD / million tokens), 2026-09-03:
    /// https://platform.claude.com/docs/en/about-claude/pricing
    /// Subscription users are not billed this way — UI must keep the 估算 label.
    /// </summary>
    private static Rates? RatesFor(string model)
    {
        var m = model.ToLowerInvariant().Replace('.', '-');
        if (m.Contains("fable-5-1", StringComparison.Ordinal) || m.Contains("mythos-5-1", StringComparison.Ordinal))
            return new Rates(10, 12.5, 20, 0.25, 50);
        if (m.Contains("fable-5", StringComparison.Ordinal) || m.Contains("mythos-5", StringComparison.Ordinal))
            return new Rates(10, 12.5, 20, 1, 50);
        if (m.Contains("opus-4-1", StringComparison.Ordinal))
            return new Rates(15, 18.75, 30, 1.5, 75);
        if (m.Contains("opus-5", StringComparison.Ordinal)
            || m.Contains("opus-4-8", StringComparison.Ordinal)
            || m.Contains("opus-4-7", StringComparison.Ordinal)
            || m.Contains("opus-4-6", StringComparison.Ordinal)
            || m.Contains("opus-4-5", StringComparison.Ordinal))
            return new Rates(5, 6.25, 10, 0.5, 25);
        if (m.Contains("opus-4", StringComparison.Ordinal))
            return new Rates(15, 18.75, 30, 1.5, 75);
        if (m.Contains("sonnet-5", StringComparison.Ordinal))
            return new Rates(2, 2.5, 4, 0.2, 10);
        if (m.Contains("sonnet-4", StringComparison.Ordinal))
            return new Rates(3, 3.75, 6, 0.3, 15);
        if (m.Contains("haiku-4", StringComparison.Ordinal))
            return new Rates(1, 1.25, 2, 0.1, 5);
        if (m.Contains("haiku-3", StringComparison.Ordinal))
            return new Rates(0.8, 1, 1.6, 0.08, 4);
        return null;
    }

    private static void AddSlice(Dictionary<string, SliceAcc> map, string key, string model, Acc delta, DateTime at)
    {
        if (!map.TryGetValue(key, out var slice))
        {
            slice = new SliceAcc();
            map[key] = slice;
        }
        slice.Entries++;
        if (at != default)
        {
            if (slice.Oldest is null || at < slice.Oldest) slice.Oldest = at;
            if (slice.Newest is null || at > slice.Newest) slice.Newest = at;
        }
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

    private readonly record struct Rates(double Input, double Cache5m, double Cache1h, double CacheRead, double Output);

    private sealed class Acc
    {
        public long Input;
        public long Output;
        public long Cache5m;
        public long Cache1h;
        public long CacheRead;

        public void Add(Acc other)
        {
            Input += other.Input;
            Output += other.Output;
            Cache5m += other.Cache5m;
            Cache1h += other.Cache1h;
            CacheRead += other.CacheRead;
        }

        public TokenRow ToRow(string model)
        {
            var rates = RatesFor(model);
            double? usd = rates is { } r
                ? Math.Round(
                    (Input * r.Input
                     + Cache5m * r.Cache5m
                     + Cache1h * r.Cache1h
                     + CacheRead * r.CacheRead
                     + Output * r.Output) / 1_000_000d,
                    4,
                    MidpointRounding.AwayFromZero)
                : null;
            return new TokenRow(model, Input, Output, Cache5m, Cache1h, CacheRead, usd);
        }
    }
}
