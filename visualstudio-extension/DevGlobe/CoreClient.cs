using System;
using System.Diagnostics;
using System.Text;
using Newtonsoft.Json;

namespace DevGlobe
{
    /// <summary>
    /// Client for the devglobe-core daemon: launches "devglobe-core-win-x64.exe daemon",
    /// communicates via JSON-lines over stdin/stdout, dispatches events to TrackerState
    /// and onStateChange, and restarts the process if it dies.
    /// </summary>
    public sealed class CoreClient : IDisposable
    {
        private readonly string _corePath;
        private readonly Action<TrackerState> _onStateChange;
        private readonly string _pluginVersion;
        private readonly Action _onInvalidApiKey;

        // Optional UI hooks. No-op by default so CoreClient stays decoupled from the VSSDK.
        private readonly Action<string> _notifyInfo;
        private readonly Action<string> _notifyError;
        private readonly Action _offerReconnect;
        private DevGlobeStatusBar? _statusBar;

        private readonly object _gate = new object();
        private Process? _proc;
        private TrackerState _state = NewDefaultState();
        private bool _disposed;

        public CoreClient(
            string corePath,
            Action<TrackerState> onStateChange,
            string pluginVersion,
            Action onInvalidApiKey)
            : this(corePath, onStateChange, pluginVersion, onInvalidApiKey,
                   statusBar: null, notifyInfo: null, notifyError: null, offerReconnect: null)
        {
        }

        /// <summary>Extended constructor that injects the status bar and UI hooks.</summary>
        public CoreClient(
            string corePath,
            Action<TrackerState> onStateChange,
            string pluginVersion,
            Action onInvalidApiKey,
            DevGlobeStatusBar? statusBar,
            Action<string>? notifyInfo,
            Action<string>? notifyError,
            Action? offerReconnect)
        {
            _corePath = corePath;
            _onStateChange = onStateChange ?? (_ => { });
            _pluginVersion = pluginVersion;
            _onInvalidApiKey = onInvalidApiKey ?? (() => { });
            _statusBar = statusBar;
            _notifyInfo = notifyInfo ?? (_ => { });
            _notifyError = notifyError ?? (_ => { });
            _offerReconnect = offerReconnect ?? (() => { });
        }

        private static TrackerState NewDefaultState() => new TrackerState
        {
            Configured = false,
            Tracking = false,
            CodingTime = "0m",
            TodaySeconds = 0,
            Language = null,
            Offline = false,
        };

        public TrackerState GetState()
        {
            lock (_gate)
            {
                // Defensive copy.
                return new TrackerState
                {
                    Configured = _state.Configured,
                    Tracking = _state.Tracking,
                    CodingTime = _state.CodingTime,
                    TodaySeconds = _state.TodaySeconds,
                    Language = _state.Language,
                    Offline = _state.Offline,
                };
            }
        }

        /// <summary>Serializes msg as JSON + '\n' and writes it to the daemon's stdin.</summary>
        private void Send(object msg)
        {
            Process? proc;
            lock (_gate) { proc = _proc; }
            if (proc == null) return;
            try
            {
                if (!proc.HasExited && proc.StandardInput.BaseStream.CanWrite)
                {
                    string json = JsonConvert.SerializeObject(msg);
                    proc.StandardInput.Write(json);
                    proc.StandardInput.Write('\n');
                    proc.StandardInput.Flush();
                }
            }
            catch (Exception ex)
            {
                Log.Warn("Failed to write to core stdin", new { error = ex.Message });
            }
        }

        /// <summary>(Re)starts the daemon process if it is not running.</summary>
        private void EnsureProcess()
        {
            lock (_gate)
            {
                if (_proc != null && !_proc.HasExited) return;

                var psi = new ProcessStartInfo
                {
                    FileName = _corePath,
                    Arguments = "daemon",
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8,
                };

                Process proc;
                try
                {
                    proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
                    proc.OutputDataReceived += OnOutputLine;
                    proc.ErrorDataReceived += OnErrorLine;
                    proc.Exited += OnProcessExited;
                    if (!proc.Start())
                    {
                        HandleProcessFailure("Failed to start devglobe-core (Process.Start returned false).");
                        return;
                    }
                }
                catch (Exception ex)
                {
                    HandleProcessFailure($"Failed to start devglobe-core: {ex.Message}");
                    return;
                }

                _proc = proc;
                proc.BeginOutputReadLine();
                proc.BeginErrorReadLine();
                Log.Info("core daemon started", new { path = _corePath });
            }
        }

        private void OnErrorLine(object sender, DataReceivedEventArgs e)
        {
            if (!string.IsNullOrEmpty(e.Data))
            {
                Log.Warn("core stderr", new { line = e.Data });
            }
        }

        private void OnProcessExited(object? sender, EventArgs e)
        {
            bool wasTracking;
            lock (_gate)
            {
                int code = -1;
                try { code = _proc?.ExitCode ?? -1; } catch { }
                Log.Info("core exited", new { code });
                wasTracking = _state.Tracking;
                _proc = null;
                if (wasTracking) _state.Tracking = false;
            }

            if (_disposed) return;

            if (wasTracking)
            {
                _onStateChange(GetState());
                _notifyError("Tracking stopped — devglobe-core exited unexpectedly.");
            }
        }

        private void HandleProcessFailure(string message)
        {
            Log.Error(message);
            bool wasTracking;
            lock (_gate)
            {
                _proc = null;
                wasTracking = _state.Tracking;
                if (wasTracking) _state.Tracking = false;
            }
            if (wasTracking) _onStateChange(GetState());
            _notifyError(message);
        }

        private void OnOutputLine(object sender, DataReceivedEventArgs e)
        {
            if (e.Data == null) return; // null signals the stream is closed
            HandleLineResult result;
            lock (_gate)
            {
                result = HandleLine(e.Data, _state);
            }
            ApplyEffects(result);
        }

        /// <summary>
        /// Pure logic: parses one JSON line, mutates the TrackerState and returns the side
        /// effects to trigger. Touches neither the process nor the VSSDK UI.
        /// </summary>
        internal static HandleLineResult HandleLine(string line, TrackerState state)
        {
            var result = new HandleLineResult();
            if (string.IsNullOrWhiteSpace(line)) return result;

            CoreEvent? evt;
            try
            {
                evt = JsonConvert.DeserializeObject<CoreEvent>(line);
            }
            catch (JsonException)
            {
                return result; // non-JSON line is ignored
            }
            if (evt?.Event == null) return result;

            switch (evt.Event)
            {
                case "ready":
                    state.Configured = evt.Data?.Configured ?? false;
                    result.StateChanged = true;
                    break;

                case "not_configured":
                    state.Configured = false;
                    state.Tracking = false;
                    result.StateChanged = true;
                    break;

                case "invalid_api_key":
                    state.Configured = false;
                    state.Tracking = false;
                    result.StateChanged = true;
                    result.InvalidApiKey = true;
                    break;

                case "heartbeat_ok":
                    state.TodaySeconds = evt.Data?.TodaySeconds ?? 0;
                    state.Language = evt.Data?.Language;
                    state.Tracking = true;
                    state.Offline = false;
                    result.UpdateStatusBar = true;
                    result.StatusBarSeconds = state.TodaySeconds;
                    result.StateChanged = true;
                    break;

                case "offline":
                    state.Offline = true;
                    result.StateChanged = true;
                    break;

                case "online":
                    state.Offline = false;
                    result.StateChanged = true;
                    break;

                case "status_ok":
                    result.StatusOk = true;
                    break;

                case "status_error":
                    result.StatusError = true;
                    result.StatusErrorMessage = evt.Data?.Message;
                    break;

                // unknown event is ignored (forward-compatible)
            }

            return result;
        }

        /// <summary>Executes the side effects described by HandleLine.</summary>
        private void ApplyEffects(HandleLineResult result)
        {
            if (result.UpdateStatusBar)
            {
                _statusBar?.UpdateTime(result.StatusBarSeconds);
                lock (_gate)
                {
                    _state.CodingTime = FormatCodingTime(result.StatusBarSeconds);
                }
            }

            if (result.StateChanged)
            {
                _onStateChange(GetState());
            }

            if (result.InvalidApiKey)
            {
                Log.Warn("core reported invalid API key");
                _offerReconnect();
                _onInvalidApiKey();
            }

            if (result.StatusOk)
            {
                Log.Info("core status ok");
                _notifyInfo("Status updated");
            }

            if (result.StatusError)
            {
                Log.Warn("core status error", new { message = result.StatusErrorMessage });
                _notifyError(result.StatusErrorMessage ?? "Status update failed");
            }
        }

        /// <summary>Formats seconds as "2h 15m" or "15m".</summary>
        private static string FormatCodingTime(long todaySeconds)
        {
            long h = todaySeconds / 3600;
            long m = (todaySeconds % 3600) / 60;
            return h > 0 ? $"{h}h {m}m" : $"{m}m";
        }

        public void Init()
        {
            EnsureProcess();
            Send(new
            {
                method = "init",
                @params = new
                {
                    plugin_version = _pluginVersion,
                    editor = EditorInfo.DetectEditor(),
                },
            });
        }

        public void Start()
        {
            lock (_gate) { _state.Tracking = true; }
            Send(new { method = "resume" });
            _onStateChange(GetState());
        }

        public void Pause()
        {
            lock (_gate) { _state.Tracking = false; }
            Send(new { method = "pause" });
            _statusBar?.Hide();
            _onStateChange(GetState());
        }

        public void Activity(string filePath, string? language)
        {
            if (string.IsNullOrEmpty(language))
            {
                Send(new { method = "activity", @params = new { file = filePath } });
            }
            else
            {
                Send(new { method = "activity", @params = new { file = filePath, language } });
            }
        }

        public void SetStatus(string message)
        {
            Log.Info("core setStatus requested", new { length = message?.Length ?? 0 });
            Send(new { method = "set_status", @params = new { message } });
        }

        public void Reset()
        {
            TearDownProcess();
            lock (_gate) { _state = NewDefaultState(); }
            _statusBar?.Hide();
            _onStateChange(GetState());
        }

        private void TearDownProcess()
        {
            Send(new { method = "shutdown" });
            Process? proc;
            lock (_gate)
            {
                proc = _proc;
                _proc = null;
            }
            if (proc == null) return;
            try
            {
                proc.OutputDataReceived -= OnOutputLine;
                proc.ErrorDataReceived -= OnErrorLine;
                proc.Exited -= OnProcessExited;
                if (!proc.HasExited)
                {
                    // Allow a graceful shutdown, then kill.
                    if (!proc.WaitForExit(500))
                    {
                        proc.Kill();
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Warn("Error during core teardown", new { error = ex.Message });
            }
            finally
            {
                proc.Dispose();
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            TearDownProcess();
        }
    }
}
