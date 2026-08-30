using System.Diagnostics;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Runs a command through the user's login shell instead of spawning it directly.
/// Matters because a macOS .app launched from Finder does NOT inherit the Terminal
/// PATH (nvm/homebrew-installed `node`/`npx` would otherwise be invisible), and the
/// same class of problem exists on Windows for `npx.cmd`.
/// </summary>
public static class ShellCommandRunner
{
    public static async Task<(int ExitCode, string StdOut, string StdErr)> RunAsync(string command, TimeSpan timeout, CancellationToken ct)
    {
        var psi = OperatingSystem.IsWindows()
            ? new ProcessStartInfo("cmd.exe", $"/c {command}")
            : new ProcessStartInfo(LoginShellPath, $"-lc \"{command.Replace("\"", "\\\"")}\"");

        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;
        psi.UseShellExecute = false;

        using var process = Process.Start(psi) ?? throw new InvalidOperationException($"無法啟動指令：{command}");
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(timeout);

        var stdOutTask = process.StandardOutput.ReadToEndAsync(timeoutCts.Token);
        var stdErrTask = process.StandardError.ReadToEndAsync(timeoutCts.Token);

        try
        {
            await process.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
        {
            TryKill(process);
            throw new TimeoutException($"指令逾時（{timeout.TotalSeconds}s）：{command}");
        }

        return (process.ExitCode, await stdOutTask, await stdErrTask);
    }

    private static void TryKill(Process process)
    {
        try { process.Kill(entireProcessTree: true); } catch { /* best effort */ }
    }

    private static string LoginShellPath =>
        Environment.GetEnvironmentVariable("SHELL") is { Length: > 0 } shell ? shell : "/bin/zsh";
}
