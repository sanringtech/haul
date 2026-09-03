using System.Reflection;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// Finds the published <c>wwwroot</c> next to the exe <em>or</em> inside the
/// single-file extract directory. <see cref="AppContext.BaseDirectory"/> for a
/// <c>PublishSingleFile</c> build is the folder containing the .exe, but
/// <c>IncludeAllContentForSelfExtract</c> unpacks content files (wwwroot) next
/// to the native DLLs under <c>%TEMP%\.net\...</c>. Looking in only one of
/// those two places is how the Windows zip build ended up with a titled black
/// window: Photino.Load("wwwroot/...") resolved against the extract dir, where
/// the sidecar folder was never copied.
/// </summary>
internal static class AppContent
{
    public static string? FindWwwRoot()
    {
        foreach (var dir in CandidateRoots())
        {
            var wwwroot = Path.Combine(dir, "wwwroot");
            if (File.Exists(Path.Combine(wwwroot, "browser", "index.html")))
                return wwwroot;
        }

        return ExtractEmbeddedWwwRoot();
    }

    private static string? ExtractEmbeddedWwwRoot()
    {
        var assembly = Assembly.GetExecutingAssembly();
        // Manifest resource names can be prefixed with a default namespace (e.g.
        // "UsageMonitor.Desktop.wwwroot/...") so we must search by substring,
        // not rely on StartsWith("wwwroot/").
        var resources = assembly.GetManifestResourceNames()
            .Where(name => name.Contains("wwwroot/", StringComparison.Ordinal) ||
                           name.Contains("wwwroot.", StringComparison.Ordinal) ||
                           name.Contains("wwwroot\\", StringComparison.Ordinal))
            .ToArray();

        if (resources.Length == 0) return null;

        var version = assembly.GetName().Version?.ToString() ?? "dev";
        var targetRoot = Path.Combine(Path.GetTempPath(), "SanringHaul", "wwwroot-" + version);
        var browserIndex = Path.Combine(targetRoot, "browser", "index.html");
        if (File.Exists(browserIndex)) return targetRoot;

        foreach (var resource in resources)
        {
            var relative = ExtractRelativeWwwRootPath(resource);
            if (relative is null) continue;

            var targetPath = Path.Combine(targetRoot, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);

            using var input = assembly.GetManifestResourceStream(resource);
            if (input is null) continue;

            using var output = File.Create(targetPath);
            input.CopyTo(output);
        }

        return File.Exists(browserIndex) ? targetRoot : null;
    }

    public static string BuildMissingUiMessage()
    {
        return """
<!doctype html>
<meta charset="utf-8">
<title>sanring Haul</title>
<body style="font-family:system-ui,sans-serif;padding:2rem;background:#202424;color:#edf1f2">
  <h1 style="font-size:1.1rem">找不到介面檔案</h1>
  <p>wwwroot/browser/index.html 不在執行檔旁邊，也無法從內嵌資源解出。請重新下載完整的發布檔。</p>
</body>
""";
    }

    private static string? ExtractRelativeWwwRootPath(string manifestResourceName)
    {
        // Normalise to forward-slash so one search covers all separator variants
        // (MSBuild on Windows often emits mixed "wwwroot/browser\file.js").
        var normalised = manifestResourceName.Replace('\\', '/');

        // Try "wwwroot/" first (the LogicalName we set in the csproj).
        const string marker = "wwwroot/";
        var idx = normalised.IndexOf(marker, StringComparison.Ordinal);
        if (idx < 0) return null;

        var relative = normalised[(idx + marker.Length)..];
        if (string.IsNullOrEmpty(relative)) return null;

        // Map to OS path separator.
        return relative.Replace('/', Path.DirectorySeparatorChar);
    }

    public static string? FindIconPath(string? wwwroot)
    {
        if (!string.IsNullOrEmpty(wwwroot))
        {
            foreach (var name in new[] { "favicon.ico", "logo.png", "logo.svg" })
            {
                var candidate = Path.Combine(wwwroot, "browser", name);
                if (File.Exists(candidate)) return candidate;
            }
        }

        // Fallback: extract embedded app.ico to temp so Photino's SetIconFile can use it
        return ExtractEmbeddedIcon();
    }

    private static string? ExtractEmbeddedIcon()
    {
        try
        {
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("app.ico");
            if (stream is null) return null;

            var target = Path.Combine(Path.GetTempPath(), "SanringHaul", "app.ico");
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            using var file = File.Create(target);
            stream.CopyTo(file);
            return target;
        }
        catch { return null; }
    }

    private static IEnumerable<string> CandidateRoots()
    {
        yield return AppContext.BaseDirectory;

        var processDir = Path.GetDirectoryName(Environment.ProcessPath);
        if (!string.IsNullOrEmpty(processDir))
            yield return processDir;

        // Single-file extract path(s). Semicolon on Windows, colon on Unix.
        if (AppContext.GetData("NATIVE_DLL_SEARCH_DIRECTORIES") is string nativeDirs)
        {
            foreach (var dir in nativeDirs.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (Directory.Exists(dir))
                    yield return dir;
            }
        }
    }
}
