using System.Text;
using System.Text.Json;

namespace UsageMonitor.Desktop.Security;

/// <summary>讀 JWT payload 裡常見的 email claim，不驗證簽章——只用來當帳號標籤。</summary>
internal static class JwtEmail
{
    public static string? TryRead(string token)
    {
        try
        {
            var parts = token.Split('.');
            if (parts.Length < 2) return null;
            var payload = parts[1];
            var padded = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=')
                .Replace('-', '+').Replace('_', '/');
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(padded)));
            foreach (var name in new[] { "email", "preferred_username", "unique_name" })
            {
                if (doc.RootElement.TryGetProperty(name, out var prop))
                {
                    var value = prop.GetString();
                    if (!string.IsNullOrEmpty(value) && value.Contains('@')) return value;
                }
            }
        }
        catch
        {
            return null;
        }
        return null;
    }
}
