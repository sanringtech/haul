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
            // .SpecialFolder.Personal is a classic .NET trap on macOS — it resolves to ~/Documents,
            // not the home directory, despite plenty of code (including an earlier version of this
            // file) assuming otherwise. .UserProfile is the one that actually means "home dir" here.
            var dir = OperatingSystem.IsMacOS()
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Library", "Application Support", AppFolderName)
                : OperatingSystem.IsWindows()
                    ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), AppFolderName)
                    : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppFolderName);

            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    public static string SettingsFilePath => Path.Combine(DataDirectory, "settings.json");

    /// <summary>SQLite 檔——用量歷史記錄（設定頁「記錄用量歷史」開關），見 Services/UsageHistoryStore.cs。</summary>
    public static string UsageHistoryDbPath => Path.Combine(DataDirectory, "usage-history.sqlite3");
}
