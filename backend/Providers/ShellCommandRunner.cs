using System.Diagnostics;

namespace UsageMonitor.Desktop.Providers;

/// <summary>
/// Runs a command through the user's login shell instead of spawning it directly.
/// Matters because a macOS .app launched from Finder does NOT inherit the Terminal
/// PATH (nvm/homebrew-installed `node`/`npx` would otherwise be invisible), and the
/// same class of problem exists on Windows for `npx.cmd`.
///
/// <para>
/// <b>要 -i（interactive），不能只有 -l（login）</b>（2026-08-31，實測抓到）：`~/.local/bin` 這類
/// pipx/pip --user/uv tool 常見的安裝路徑，很多人是加在 <c>~/.zshrc</c>，不是 <c>~/.zprofile</c>——
/// zsh 只有「互動式」shell 才會載入 .zshrc，單純 login（-l）不算。原本只用 -lc 時，從乾淨環境
/// （模擬 Finder 啟動 .app 的最小 PATH）直接呼叫 `zsh -lc "cswap ..."` 會找不到指令、靜默 exit 127，
/// 呼叫端（見 ClaudeUsageProvider.TryDetectCswapAccountsAsync）把這個當成「沒裝 cswap」處理，完全
/// 沒有錯誤訊息——使用者看到的現象是「本來可以掃出好幾個帳號，突然又變回只有一個」，很難聯想到
/// 是 PATH 的問題。改成 -ilc 後，用同樣的乾淨環境測試過 stdout 仍然是乾淨的 JSON（使用者的
/// .zshrc 沒有在最上層印東西，都包在 function 裡才會印），沒有多出來的雜訊污染 JSON 解析。
/// </para>
/// </summary>
public static class ShellCommandRunner
{
    public static async Task<(int ExitCode, string StdOut, string StdErr)> RunAsync(string command, TimeSpan timeout, CancellationToken ct)
    {
        var psi = OperatingSystem.IsWindows()
            ? new ProcessStartInfo("cmd.exe", $"/c {command}")
            : new ProcessStartInfo(LoginShellPath, $"-ilc \"{command.Replace("\"", "\\\"")}\"");

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
