using System.Diagnostics;
using System.Text;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// Candidate CLI home directories. On Windows this is the Windows user profile plus
/// <c>$HOME</c> of <b>already running</b> WSL distros (UNC via <c>wslpath -w</c>).
/// Stopped distros are never started. Distros with none of
/// <c>.claude</c> / <c>.codex</c> / <c>.kimi-code</c> / <c>.grok</c> are skipped
/// (e.g. a running <c>podman-machine</c>).
/// </summary>
public static class CliHomeRoots
{
    public readonly record struct Root(string Path, bool IsWindowsProfile);

    private static readonly TimeSpan WslTtl = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan WslTimeout = TimeSpan.FromSeconds(3);
    private static readonly object CacheLock = new();
    private static List<Root>? _wslCache;
    private static DateTime _wslCacheAtUtc;

    private static readonly string[] MarkerNames =
    [
        ".claude",
        ".claude.json",
        ".codex",
        ".kimi-code",
        ".grok",
        Path.Combine(".config", "claude"),
    ];

    public static IReadOnlyList<Root> All()
    {
        var list = new List<Root>();
        var windows = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (!string.IsNullOrEmpty(windows))
            list.Add(new Root(windows, IsWindowsProfile: true));

        if (OperatingSystem.IsWindows())
        {
            foreach (var wsl in RunningWslHomesCached())
            {
                if (list.Any(r => PathsEqual(r.Path, wsl.Path))) continue;
                list.Add(wsl);
            }
        }

        return list;
    }

    public static IEnumerable<string> ClaudeConfigDirs()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var env = Environment.GetEnvironmentVariable("CLAUDE_CONFIG_DIR");
        if (!string.IsNullOrWhiteSpace(env))
        {
            foreach (var part in env.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
                if (seen.Add(part)) yield return part;
        }

        foreach (var root in All())
        {
            var claude = Path.Combine(root.Path, ".claude");
            if (seen.Add(claude)) yield return claude;
            var xdg = Path.Combine(root.Path, ".config", "claude");
            if (seen.Add(xdg)) yield return xdg;
        }
    }

    public static IEnumerable<string> CodexHomes()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var env = Environment.GetEnvironmentVariable("CODEX_HOME");
        if (!string.IsNullOrWhiteSpace(env) && seen.Add(env))
            yield return env;

        foreach (var root in All())
        {
            var home = Path.Combine(root.Path, ".codex");
            if (seen.Add(home)) yield return home;
        }
    }

    public static IEnumerable<string> GrokHomes()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var env = Environment.GetEnvironmentVariable("GROK_HOME");
        if (!string.IsNullOrWhiteSpace(env) && seen.Add(env))
            yield return env;

        foreach (var root in All())
        {
            var home = Path.Combine(root.Path, ".grok");
            if (seen.Add(home)) yield return home;
        }
    }

    public static IEnumerable<(string Path, bool IsWindowsProfile)> HomesWith(string relativeDir)
    {
        foreach (var root in All())
            yield return (Path.Combine(root.Path, relativeDir), root.IsWindowsProfile);
    }

    public static bool PathsEqual(string a, string b) =>
        string.Equals(Normalize(a), Normalize(b), StringComparison.OrdinalIgnoreCase);

    private static string Normalize(string path)
    {
        try { return Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
        catch { return path.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
    }

    private static IReadOnlyList<Root> RunningWslHomesCached()
    {
        lock (CacheLock)
        {
            if (_wslCache is not null && DateTime.UtcNow - _wslCacheAtUtc < WslTtl)
                return _wslCache;
            _wslCache = [.. DiscoverRunningWslHomes()];
            _wslCacheAtUtc = DateTime.UtcNow;
            return _wslCache;
        }
    }

    private static IEnumerable<Root> DiscoverRunningWslHomes()
    {
        foreach (var distro in RunningDistroNames())
        {
            var home = WslHomeUnc(distro);
            if (string.IsNullOrEmpty(home)) continue;
            if (!HasCliMarkers(home)) continue;
            yield return new Root(home, IsWindowsProfile: false);
        }
    }

    private static bool HasCliMarkers(string home)
    {
        foreach (var name in MarkerNames)
        {
            var path = Path.Combine(home, name);
            try
            {
                if (Directory.Exists(path) || File.Exists(path)) return true;
            }
            catch
            {
                // UNC can throw if the distro disappeared mid-scan.
            }
        }
        return false;
    }

    private static IEnumerable<string> RunningDistroNames()
    {
        var output = RunWsl(["-l", "--running"], Encoding.Unicode);
        if (string.IsNullOrWhiteSpace(output)) yield break;

        foreach (var raw in output.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            var name = ParseDistroName(raw);
            if (name is not null) yield return name;
        }
    }

    /// <summary>
    /// Parses one <c>wsl -l --running</c> line. UTF-16 listing may include a BOM, a leading
    /// <c>*</c> on the default distro, and a <c>(Default)</c> / <c>（預設）</c> suffix.
    /// </summary>
    internal static string? ParseDistroName(string raw)
    {
        var line = raw.Replace("\0", "").Trim().TrimStart('\uFEFF', '*').Trim();
        if (line.Length == 0) return null;
        if (line.Equals("NAME", StringComparison.OrdinalIgnoreCase)) return null;
        if (line.Contains("Windows Subsystem", StringComparison.OrdinalIgnoreCase)) return null;
        if (line.Contains("發行版本", StringComparison.Ordinal)) return null;
        if (line.Contains("SUBSYSTEM", StringComparison.OrdinalIgnoreCase) &&
            line.Contains("LINUX", StringComparison.OrdinalIgnoreCase)) return null;

        var name = line;
        var paren = name.IndexOf(" (", StringComparison.Ordinal);
        if (paren > 0) name = name[..paren];
        var fullwidth = name.IndexOf("（", StringComparison.Ordinal);
        if (fullwidth > 0) name = name[..fullwidth];
        name = name.Trim();
        return name.Length == 0 ? null : name;
    }

    private static string? WslHomeUnc(string distro)
    {
        var output = RunWsl(["-d", distro, "-e", "sh", "-c", "wslpath -w \"$HOME\""], Encoding.UTF8);
        if (string.IsNullOrWhiteSpace(output)) return null;
        var path = output.Replace("\0", "").Trim();
        return path.Length == 0 ? null : path;
    }

    private static string? RunWsl(IReadOnlyList<string> args, Encoding encoding)
    {
        var wsl = Path.Combine(Environment.SystemDirectory, "wsl.exe");
        if (!File.Exists(wsl)) wsl = "wsl.exe";

        var psi = new ProcessStartInfo(wsl)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = encoding,
            StandardErrorEncoding = encoding,
        };
        foreach (var arg in args)
            psi.ArgumentList.Add(arg);

        try
        {
            using var process = Process.Start(psi);
            if (process is null) return null;
            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();
            if (!process.WaitForExit((int)WslTimeout.TotalMilliseconds))
            {
                try { process.Kill(entireProcessTree: true); } catch { /* best effort */ }
                return null;
            }

            var stdout = stdoutTask.GetAwaiter().GetResult();
            _ = stderrTask.GetAwaiter().GetResult();
            return string.IsNullOrWhiteSpace(stdout) ? null : stdout.Replace("\0", "");
        }
        catch
        {
            return null;
        }
    }
}
