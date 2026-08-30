using System.Runtime.InteropServices;
using System.Runtime.Versioning;

namespace UsageMonitor.Desktop.Security;

/// <summary>
/// Stores API keys in Windows Credential Manager via advapi32 P/Invoke (CredWrite/CredRead/CredDelete).
/// NOTE: written against the documented Win32 API but not yet run on a real Windows machine — this repo
/// was built on macOS. Smoke-test on Windows before relying on it (PRD M5 build verification).
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class WindowsSecretStore : ISecretStore
{
    private const string TargetPrefix = "SanRingUsageMonitor:";
    private const int CredTypeGeneric = 1;
    private const int CredPersistLocalMachine = 2;
    private const int ErrorNotFound = 1168;

    public string? Get(string sourceId)
    {
        if (!CredRead(TargetPrefix + sourceId, CredTypeGeneric, 0, out var credPtr))
        {
            var error = Marshal.GetLastWin32Error();
            if (error == ErrorNotFound) return null;
            throw new InvalidOperationException($"Windows Credential Manager 讀取失敗（{sourceId}），錯誤碼 {error}");
        }

        try
        {
            var cred = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
            if (cred.CredentialBlob == nint.Zero || cred.CredentialBlobSize == 0)
                return null;
            return Marshal.PtrToStringUni(cred.CredentialBlob, (int)cred.CredentialBlobSize / 2);
        }
        finally
        {
            CredFree(credPtr);
        }
    }

    public void Set(string sourceId, string apiKey)
    {
        var blob = System.Text.Encoding.Unicode.GetBytes(apiKey);
        var blobPtr = Marshal.AllocHGlobal(blob.Length);
        try
        {
            Marshal.Copy(blob, 0, blobPtr, blob.Length);

            var cred = new CREDENTIAL
            {
                Type = CredTypeGeneric,
                TargetName = TargetPrefix + sourceId,
                CredentialBlobSize = (uint)blob.Length,
                CredentialBlob = blobPtr,
                Persist = CredPersistLocalMachine,
                UserName = sourceId,
            };

            if (!CredWrite(ref cred, 0))
                throw new InvalidOperationException($"Windows Credential Manager 寫入失敗（{sourceId}），錯誤碼 {Marshal.GetLastWin32Error()}");
        }
        finally
        {
            Marshal.FreeHGlobal(blobPtr);
        }
    }

    public void Delete(string sourceId)
    {
        if (!CredDelete(TargetPrefix + sourceId, CredTypeGeneric, 0))
        {
            var error = Marshal.GetLastWin32Error();
            if (error != ErrorNotFound)
                throw new InvalidOperationException($"Windows Credential Manager 刪除失敗（{sourceId}），錯誤碼 {error}");
        }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string? Comment;
        public long LastWritten;
        public uint CredentialBlobSize;
        public nint CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public nint Attributes;
        public string? TargetAlias;
        public string? UserName;
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredWrite(ref CREDENTIAL credential, uint flags);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredRead(string target, int type, int reservedFlag, out nint credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredDelete(string target, int type, int flags);

    [DllImport("advapi32.dll")]
    private static extern void CredFree(nint credentialPtr);
}
