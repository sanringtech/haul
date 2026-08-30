using System.Text.Json;
using UsageMonitor.Desktop.Models;

namespace UsageMonitor.Desktop.Services;

/// <summary>Loads/saves <see cref="AppSettings"/> as a plain local JSON file (no secrets in here, see ICredentialStore).</summary>
public static class SettingsStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static AppSettings Load()
    {
        try
        {
            if (!File.Exists(AppPaths.SettingsFilePath))
                return new AppSettings();

            var json = File.ReadAllText(AppPaths.SettingsFilePath);
            return JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings();
        }
        catch
        {
            // Corrupt/unreadable settings file must never crash the app — fall back to defaults.
            return new AppSettings();
        }
    }

    public static void Save(AppSettings settings)
    {
        var json = JsonSerializer.Serialize(settings, JsonOptions);
        File.WriteAllText(AppPaths.SettingsFilePath, json);
    }
}
