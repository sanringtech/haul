namespace UsageMonitor.Desktop.Providers;

/// <summary>One shared HttpClient (the documented .NET guidance — a new instance per call risks socket exhaustion).</summary>
internal static class SharedHttpClient
{
    public static readonly HttpClient Instance = new() { Timeout = TimeSpan.FromSeconds(15) };
}
