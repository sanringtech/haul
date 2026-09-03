#if WINDOWS
using System.Drawing;
using System.Windows.Forms;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// Windows 系統匣圖示（右下角通知區）。
/// 雙擊或右鍵 → 「顯示」還原視窗；右鍵 → 「結束」退出 app。
/// 只在 win-* RID 編譯（#if WINDOWS），macOS/Linux 不受影響。
/// </summary>
internal sealed class TrayIcon : IDisposable
{
    private readonly NotifyIcon _notify;

    private TrayIcon(NotifyIcon notify) => _notify = notify;

    public static TrayIcon Start(string? iconPath, Action onShow, Action onQuit)
    {
        var icon = TryLoadIcon(iconPath) ?? TryLoadEmbeddedIcon() ?? SystemIcons.Application;

        var menu = new ContextMenuStrip();
        menu.Items.Add("顯示", null, (_, _) => onShow());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("結束", null, (_, _) => onQuit());

        var notify = new NotifyIcon
        {
            Icon = icon,
            Text = "sanring Haul",
            ContextMenuStrip = menu,
            Visible = true,
        };

        notify.DoubleClick += (_, _) => onShow();

        return new TrayIcon(notify);
    }

    public void Dispose()
    {
        _notify.Visible = false;
        _notify.Dispose();
    }

    private static Icon? TryLoadIcon(string? path)
    {
        if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
        if (!path.EndsWith(".ico", StringComparison.OrdinalIgnoreCase)) return null;
        try { return new Icon(path); }
        catch { return null; }
    }

    private static Icon? TryLoadEmbeddedIcon()
    {
        try
        {
            using var stream = typeof(TrayIcon).Assembly.GetManifestResourceStream("app.ico");
            if (stream is null) return null;
            return new Icon(stream);
        }
        catch { return null; }
    }
}
#endif
