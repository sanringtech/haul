using System.Runtime.InteropServices;
using System.Runtime.Versioning;

namespace UsageMonitor.Desktop.Security;

/// <summary>
/// Stores API keys in Windows Credential Manager via advapi32 P/Invoke (CredWrite/CredRead/CredDelete).
/// </summary>
/// <remarks>
/// A single credential blob cannot exceed CRED_MAX_CREDENTIAL_BLOB_SIZE (2560 bytes); CredWrite
/// rejects anything larger with error 1783 (ERROR_BAD_STUB_DATA), measured on Windows 11:
/// 2560 bytes succeeds, 2562 fails. That is well within reach for a
/// <see cref="SubscriptionSnapshot"/>, whose JSON carries an OAuth access token (Codex issues a
/// JWT) plus a refresh token, and UTF-16 doubles the byte count. Oversized values are therefore
/// split across numbered companion credentials rather than dropped or moved out of the OS store.
/// </remarks>
[SupportedOSPlatform("windows")]
public sealed class WindowsSecretStore : ISecretStore
{
    private const string TargetPrefix = "SanRingUsageMonitor:";
    private const int CredTypeGeneric = 1;
    private const int CredPersistLocalMachine = 2;
    private const int ErrorNotFound = 1168;

    /// <summary>CRED_MAX_CREDENTIAL_BLOB_SIZE.</summary>
    private const int MaxBlobBytes = 5 * 512;

    /// <summary>Must stay even so a UTF-16 code unit is never split across chunks.</summary>
    private const int ChunkBytes = 2048;

    /// <summary>
    /// Marks the head credential as a chunk manifest instead of a value. The leading control
    /// character keeps it from ever colliding with an API key or serialised JSON.
    /// </summary>
    private const string ChunkManifestPrefix = "\u0001haul-chunks:";

    public string? Get(string sourceId)
    {
        var head = ReadString(TargetPrefix + sourceId);
        if (head is null) return null;
        if (!head.StartsWith(ChunkManifestPrefix, StringComparison.Ordinal)) return head;

        if (!int.TryParse(head.AsSpan(ChunkManifestPrefix.Length), out var count) || count <= 0)
            return null;

        var parts = new byte[count][];
        var total = 0;
        for (var i = 0; i < count; i++)
        {
            var chunk = ReadBlob(ChunkTarget(sourceId, i));
            // A missing chunk means the value was only partially written; report it as absent
            // so the caller re-authenticates rather than decoding a truncated token.
            if (chunk is null) return null;
            parts[i] = chunk;
            total += chunk.Length;
        }

        var joined = new byte[total];
        var offset = 0;
        foreach (var part in parts)
        {
            Buffer.BlockCopy(part, 0, joined, offset, part.Length);
            offset += part.Length;
        }

        return System.Text.Encoding.Unicode.GetString(joined);
    }

    public void Set(string sourceId, string apiKey)
    {
        var blob = System.Text.Encoding.Unicode.GetBytes(apiKey);

        if (blob.Length <= MaxBlobBytes)
        {
            WriteBlob(TargetPrefix + sourceId, sourceId, blob);
            DeleteChunksFrom(sourceId, 0);
            return;
        }

        var count = (blob.Length + ChunkBytes - 1) / ChunkBytes;
        for (var i = 0; i < count; i++)
        {
            var start = i * ChunkBytes;
            var length = Math.Min(ChunkBytes, blob.Length - start);
            var chunk = new byte[length];
            Buffer.BlockCopy(blob, start, chunk, 0, length);
            WriteBlob(ChunkTarget(sourceId, i), sourceId, chunk);
        }

        // Manifest last: if we die mid-write the head still holds the previous value or nothing,
        // never a pointer to chunks that were not all written.
        WriteBlob(
            TargetPrefix + sourceId,
            sourceId,
            System.Text.Encoding.Unicode.GetBytes(ChunkManifestPrefix + count));

        DeleteChunksFrom(sourceId, count);
    }

    public void Delete(string sourceId)
    {
        DeleteTarget(TargetPrefix + sourceId);
        DeleteChunksFrom(sourceId, 0);
    }

    private static string ChunkTarget(string sourceId, int index) => $"{TargetPrefix}{sourceId}#{index}";

    /// <summary>Clears leftover chunks from a previously larger value, starting at <paramref name="startIndex"/>.</summary>
    private static void DeleteChunksFrom(string sourceId, int startIndex)
    {
        // Stop at the first gap: chunks are always written as a contiguous run.
        for (var i = startIndex; ; i++)
        {
            if (!DeleteTarget(ChunkTarget(sourceId, i))) return;
        }
    }

    private static string? ReadString(string target)
    {
        var blob = ReadBlob(target);
        return blob is null ? null : System.Text.Encoding.Unicode.GetString(blob);
    }

    private static byte[]? ReadBlob(string target)
    {
        if (!CredRead(target, CredTypeGeneric, 0, out var credPtr))
        {
            var error = Marshal.GetLastWin32Error();
            if (error == ErrorNotFound) return null;
            throw new InvalidOperationException($"Windows Credential Manager 讀取失敗（{target}），錯誤碼 {error}");
        }

        try
        {
            var cred = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
            if (cred.CredentialBlob == nint.Zero || cred.CredentialBlobSize == 0) return null;

            var buffer = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, buffer, 0, buffer.Length);
            return buffer;
        }
        finally
        {
            CredFree(credPtr);
        }
    }

    private static void WriteBlob(string target, string userName, byte[] blob)
    {
        var blobPtr = Marshal.AllocHGlobal(blob.Length);
        try
        {
            Marshal.Copy(blob, 0, blobPtr, blob.Length);

            var cred = new CREDENTIAL
            {
                Type = CredTypeGeneric,
                TargetName = target,
                CredentialBlobSize = (uint)blob.Length,
                CredentialBlob = blobPtr,
                Persist = CredPersistLocalMachine,
                UserName = userName,
            };

            if (!CredWrite(ref cred, 0))
                throw new InvalidOperationException($"Windows Credential Manager 寫入失敗（{target}），錯誤碼 {Marshal.GetLastWin32Error()}");
        }
        finally
        {
            Marshal.FreeHGlobal(blobPtr);
        }
    }

    /// <summary>Returns false when the target did not exist.</summary>
    private static bool DeleteTarget(string target)
    {
        if (CredDelete(target, CredTypeGeneric, 0)) return true;

        var error = Marshal.GetLastWin32Error();
        if (error == ErrorNotFound) return false;
        throw new InvalidOperationException($"Windows Credential Manager 刪除失敗（{target}），錯誤碼 {error}");
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
