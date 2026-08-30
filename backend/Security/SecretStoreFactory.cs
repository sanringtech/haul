namespace UsageMonitor.Desktop.Security;

public static class SecretStoreFactory
{
    public static ISecretStore Create()
    {
        if (OperatingSystem.IsMacOS()) return new MacKeychainSecretStore();
        if (OperatingSystem.IsWindows()) return new WindowsSecretStore();
        throw new PlatformNotSupportedException("SanRing Usage Monitor 目前只支援 macOS 與 Windows（憲法範圍：Win + macOS）。");
    }
}
