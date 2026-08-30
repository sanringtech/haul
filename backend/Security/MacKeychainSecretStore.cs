using System.Diagnostics;

namespace UsageMonitor.Desktop.Security;

/// <summary>Stores API keys in the macOS login Keychain via the `security` CLI (no extra native deps).</summary>
public sealed class MacKeychainSecretStore : ISecretStore
{
    private const string ServiceName = "SanRingUsageMonitor";

    public string? Get(string sourceId)
    {
        var result = Run("find-generic-password", "-a", sourceId, "-s", ServiceName, "-w");
        return result.ExitCode == 0 ? result.StdOut.Trim() : null;
    }

    public void Set(string sourceId, string apiKey)
    {
        // -U updates in place if an entry already exists, avoiding a duplicate-item error.
        // NOTE: the key is passed as a process argument (`security` has no stdin option for -w),
        // so it's briefly visible to `ps` for other processes owned by the same user. Acceptable
        // for a single-user desktop tool; revisit if this ever needs a stricter threat model.
        var result = Run("add-generic-password", "-a", sourceId, "-s", ServiceName, "-w", apiKey, "-U");
        if (result.ExitCode != 0)
            throw new InvalidOperationException($"macOS Keychain 寫入失敗（{sourceId}）：{result.StdErr}");
    }

    public void Delete(string sourceId)
    {
        var result = Run("delete-generic-password", "-a", sourceId, "-s", ServiceName);
        // Exit code 44 = "item not found", which is fine — deleting something already gone is a no-op.
        if (result.ExitCode != 0 && result.ExitCode != 44)
            throw new InvalidOperationException($"macOS Keychain 刪除失敗（{sourceId}）：{result.StdErr}");
    }

    private static (int ExitCode, string StdOut, string StdErr) Run(params string[] args)
    {
        var psi = new ProcessStartInfo("/usr/bin/security")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var arg in args)
            psi.ArgumentList.Add(arg);

        using var process = Process.Start(psi) ?? throw new InvalidOperationException("無法啟動 /usr/bin/security");
        var stdOut = process.StandardOutput.ReadToEnd();
        var stdErr = process.StandardError.ReadToEnd();
        process.WaitForExit();
        return (process.ExitCode, stdOut, stdErr);
    }
}
