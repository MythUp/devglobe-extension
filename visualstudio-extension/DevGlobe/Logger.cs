using System;
using System.IO;
using System.Text;
using Newtonsoft.Json;

namespace DevGlobe
{
    /// <summary>
    /// File logger for the extension. Writes to DevGlobeConfig.LogPath, one line per call,
    /// in the format "ISO LEVEL [visualstudio] message {json-data}", with append and rotation.
    ///
    /// Levels: ERROR always; INFO/WARN only when debug is enabled (config.toml debug = true).
    /// The logger must NEVER throw, otherwise it would break the IDE.
    /// </summary>
    public static class Log
    {
        private const long MaxLogBytes = 5 * 1024 * 1024;       // rotate beyond 5 MB
        private const int TruncateKeepBytes = 1 * 1024 * 1024;  // keep the last 1 MB

        private static readonly object Gate = new object();
        private static bool _debug;

        /// <summary>
        /// Re-evaluates the log level from config (debug = true enables INFO/WARN).
        /// </summary>
        public static void RefreshLevel()
        {
            try { _debug = DevGlobeConfig.IsDebugEnabled(); }
            catch { _debug = false; }
        }

        public static void Info(string msg, object? data = null)
        {
            if (_debug) Write("INFO", msg, data);
        }

        public static void Warn(string msg, object? data = null)
        {
            if (_debug) Write("WARN", msg, data);
        }

        public static void Error(string msg, object? data = null)
        {
            Write("ERROR", msg, data);
        }

        private static void Write(string level, string msg, object? data)
        {
            try
            {
                var timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
                var payload = FormatData(data);
                var line = $"{timestamp} {level} [{EditorInfo.EditorId}] {msg}{payload}\n";

                var path = DevGlobeConfig.LogPath;
                var dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    Directory.CreateDirectory(dir);

                lock (Gate)
                {
                    File.AppendAllText(path, line, new UTF8Encoding(false));
                    MaybeRotate(path);
                }
            }
            catch
            {
                // Logging must never break the host process.
            }
        }

        private static string FormatData(object? data)
        {
            if (data == null) return string.Empty;
            try { return " " + JsonConvert.SerializeObject(data); }
            catch { return " " + data; }
        }

        private static void MaybeRotate(string path)
        {
            try
            {
                var info = new FileInfo(path);
                if (!info.Exists || info.Length <= MaxLogBytes) return;

                byte[] tail = new byte[TruncateKeepBytes];
                int read;
                using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read))
                {
                    fs.Seek(info.Length - TruncateKeepBytes, SeekOrigin.Begin);
                    read = fs.Read(tail, 0, TruncateKeepBytes);
                }

                using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write))
                {
                    fs.Write(tail, 0, read);
                }
            }
            catch
            {
                // Rotation failure is non-fatal.
            }
        }
    }
}
