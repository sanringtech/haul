using System.Net;
using System.Net.Sockets;

namespace UsageMonitor.Desktop.Services;

/// <summary>
/// Serves the bundled Angular UI over loopback HTTP.
/// Photino on Windows is WebView2: loading <c>wwwroot/browser/index.html</c> via
/// <c>file://</c> makes every <c>&lt;script type="module"&gt;</c> fail CORS
/// (<c>origin: null</c>), so the window opens titled but stays black. macOS
/// WKWebView is more lenient, which is why this only showed up once a real
/// Windows box ran the published build (2026-09-03). A loopback server is the
/// official Photino workaround (see Photino.NET.Server / issue #93); we roll
/// a tiny <see cref="HttpListener"/> instead of taking that package because
/// it targets net8/net9 only and would pull the ASP.NET shared framework into
/// an already-large self-contained exe.
/// </summary>
internal sealed class UiFileServer : IDisposable
{
    private readonly HttpListener _listener;
    private readonly string _root;
    private int _disposed;

    public string BaseUrl { get; }

    private UiFileServer(HttpListener listener, string root, string baseUrl)
    {
        _listener = listener;
        _root = root;
        BaseUrl = baseUrl;
    }

    public static UiFileServer Start(string webRoot)
    {
        var root = Path.GetFullPath(webRoot);
        if (!Directory.Exists(root))
            throw new DirectoryNotFoundException($"UI web root not found: {root}");

        var port = GetFreeLoopbackPort();
        var prefix = $"http://127.0.0.1:{port}/";
        var listener = new HttpListener();
        listener.Prefixes.Add(prefix);
        listener.Start();

        var server = new UiFileServer(listener, root, prefix.TrimEnd('/'));
        listener.BeginGetContext(server.HandleRequest, null);
        return server;
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        try { _listener.Stop(); } catch (ObjectDisposedException) { }
        _listener.Close();
    }

    private void HandleRequest(IAsyncResult result)
    {
        if (Volatile.Read(ref _disposed) != 0) return;

        HttpListenerContext context;
        try
        {
            context = _listener.EndGetContext(result);
        }
        catch (Exception) when (Volatile.Read(ref _disposed) != 0)
        {
            return;
        }
        catch (HttpListenerException)
        {
            return;
        }

        try { _listener.BeginGetContext(HandleRequest, null); }
        catch (Exception) when (Volatile.Read(ref _disposed) != 0) { return; }

        try
        {
            Serve(context);
        }
        catch
        {
            try { context.Response.Abort(); } catch { /* already gone */ }
        }
    }

    private void Serve(HttpListenerContext context)
    {
        var response = context.Response;
        var relative = Uri.UnescapeDataString(context.Request.Url?.AbsolutePath ?? "/");
        if (relative == "/") relative = "/index.html";

        // Strip the leading slash, then reject anything that walks above _root
        // (encoded ".." included — GetFullPath + prefix check is the real gate).
        var candidate = Path.GetFullPath(Path.Combine(_root, relative.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));
        var rootPrefix = _root.EndsWith(Path.DirectorySeparatorChar) ? _root : _root + Path.DirectorySeparatorChar;
        if (!candidate.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(candidate, _root, StringComparison.OrdinalIgnoreCase))
        {
            response.StatusCode = 404;
            response.Close();
            return;
        }

        if (!File.Exists(candidate))
        {
            response.StatusCode = 404;
            response.Close();
            return;
        }

        response.ContentType = ContentType(candidate);
        response.StatusCode = 200;
        using var file = File.OpenRead(candidate);
        response.ContentLength64 = file.Length;
        file.CopyTo(response.OutputStream);
        response.Close();
    }

    private static int GetFreeLoopbackPort()
    {
        using var probe = new TcpListener(IPAddress.Loopback, 0);
        probe.Start();
        var port = ((IPEndPoint)probe.LocalEndpoint).Port;
        probe.Stop();
        return port;
    }

    private static string ContentType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".html" => "text/html; charset=utf-8",
        ".js" or ".mjs" => "text/javascript; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".svg" => "image/svg+xml",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".webp" => "image/webp",
        ".ico" => "image/x-icon",
        ".woff" => "font/woff",
        ".woff2" => "font/woff2",
        ".ttf" => "font/ttf",
        ".json" or ".map" => "application/json",
        _ => "application/octet-stream",
    };
}
