#if WINDOWS
using System.Drawing;
using System.Runtime.InteropServices;
using Photino.NET;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// Photino v4 沒有 Show/Hide API，也沒有可靠的 SetIcon —— 
/// 用 Win32 P/Invoke 直接控制 HWND。
/// </summary>
internal static class WindowHelper
{
    private const int SW_HIDE = 0;
    private const int SW_RESTORE = 9;
    private const int WM_SETICON = 0x0080;
    private const int ICON_SMALL = 0;
    private const int ICON_BIG = 1;
    private const int GCLP_HICON = -14;
    private const int GCLP_HICONSM = -34;

    [DllImport("user32.dll")] private static extern bool ShowWindow(nint hWnd, int nCmdShow);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(nint hWnd);
    [DllImport("user32.dll")] private static extern nint SendMessage(nint hWnd, int msg, nint wParam, nint lParam);
    [DllImport("user32.dll", SetLastError = true)] private static extern nint SetClassLongPtrW(nint hWnd, int index, nint value);


    public static void Hide(PhotinoWindow window)
    {
        var hwnd = window.WindowHandle;
        if (hwnd == nint.Zero) return;
        ShowWindow(hwnd, SW_HIDE);
    }

    public static void Show(PhotinoWindow window)
    {
        var hwnd = window.WindowHandle;
        if (hwnd == nint.Zero) return;
        ShowWindow(hwnd, SW_RESTORE);
        SetForegroundWindow(hwnd);
    }

    // The HICONs handed to WM_SETICON must outlive the call — Windows does not
    // copy them. Disposing the Icon destroys the handle and the window silently
    // falls back to the default icon, which is exactly what happened first try.
    private static Icon? _smallIcon;
    private static Icon? _largeIcon;

    /// <summary>
    /// Photino's SetIconFile calls Win32 LoadImage which is unreliable for
    /// PNG-in-ICO files, so we load via System.Drawing.Icon and apply the
    /// handles ourselves.
    /// </summary>
    /// <remarks>
    /// Both WM_SETICON and the window class icon have to be set. WM_SETICON
    /// alone gives you the title bar and Alt+Tab, but the Windows 11 taskbar
    /// button keeps showing the generic placeholder because it resolves
    /// GCLP_HICON from the class Photino registered.
    /// </remarks>
    public static void SetIcon(PhotinoWindow window, string? icoPath)
    {
        if (string.IsNullOrEmpty(icoPath) || !File.Exists(icoPath)) return;

        var hwnd = WaitForHandle(window);
        if (hwnd == nint.Zero) return;

        try
        {
            using var source = new Icon(icoPath);
            _smallIcon = new Icon(source, SystemInformation.SmallIconSize);
            _largeIcon = new Icon(source, SystemInformation.IconSize);

            SendMessage(hwnd, WM_SETICON, ICON_SMALL, _smallIcon.Handle);
            SendMessage(hwnd, WM_SETICON, ICON_BIG, _largeIcon.Handle);

            SetClassLongPtrW(hwnd, GCLP_HICON, _largeIcon.Handle);
            SetClassLongPtrW(hwnd, GCLP_HICONSM, _smallIcon.Handle);
        }
        catch
        {
            // A missing or unreadable icon must never take the app down.
        }
    }

    private static nint WaitForHandle(PhotinoWindow window)
    {
        // WaitForClose() creates the native window on another thread; poll briefly.
        for (var i = 0; i < 100; i++)
        {
            try
            {
                var hwnd = window.WindowHandle;
                if (hwnd != nint.Zero) return hwnd;
            }
            catch (ApplicationException)
            {
                // Photino throws until the native window exists.
            }

            Thread.Sleep(50);
        }

        return nint.Zero;
    }
}
#endif
