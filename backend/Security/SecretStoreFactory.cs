namespace UsageMonitor.Desktop.Security;

public static class SecretStoreFactory
{
    public static ISecretStore Create()
    {
        if (OperatingSystem.IsMacOS()) return new MacKeychainSecretStore();
        if (OperatingSystem.IsWindows()) return new WindowsSecretStore();
        throw new PlatformNotSupportedException("sanring Haul 目前只支援 macOS 與 Windows（憲法範圍：Win + macOS）。");
    }
}
