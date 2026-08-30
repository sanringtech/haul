namespace UsageMonitor.Desktop.Services;

/// <summary>Resolves the per-OS local data directory (PRD §12 TODO, resolved here).</summary>
public static class AppPaths
{
    private const string AppFolderName = "SanRingUsageMonitor";

    /// <summary>
    /// macOS: ~/Library/Application Support/SanRingUsageMonitor
    /// Windows: %AppData%\SanRingUsageMonitor
    /// Linux (fallback): ~/.local/share/SanRingUsageMonitor
    /// </summary>
    public static string DataDirectory
    {
        get
        {
            var dir = OperatingSystem.IsMacOS()
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Personal), "Library", "Application Support", AppFolderName)
                : OperatingSystem.IsWindows()
                    ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), AppFolderName)
                    : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppFolderName);

            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    public static string SettingsFilePath => Path.Combine(DataDirectory, "settings.json");
}
