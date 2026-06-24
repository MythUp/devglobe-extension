using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using DevGlobe.Commands;
using DevGlobe.ToolWindow;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.Threading; // provides GetAwaiter for `await TaskScheduler.Default`
using Task = System.Threading.Tasks.Task;

namespace DevGlobe
{
    /// <summary>Fixed integration GUIDs shared by the manifest, the .vsct, and the VSSDK components.</summary>
    public static class DevGlobeGuids
    {
        public const string PackageGuidString    = "5f3a9c2e-7b14-4e8a-9d6f-1a2b3c4d5e6f";
        public const string ToolWindowGuidString = "6a4b0d3f-8c25-4f9b-ae7a-2b3c4d5e6f70";
        public const string CommandSetGuidString = "7b5c1e40-9d36-40ac-bf8b-3c4d5e6f7081";

        public static readonly Guid CommandSet = new Guid(CommandSetGuidString);
    }

    /// <summary>
    /// In-proc VSSDK entry point. Registers commands before any network work, then bootstraps the
    /// core binary best-effort (never blocking UI registration). The tool window wires to the
    /// CoreClient via <see cref="DevGlobeShell"/>, which survives VS recreating the window.
    /// </summary>
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [ProvideAutoLoad(VSConstants.UICONTEXT.NoSolution_string, PackageAutoLoadFlags.BackgroundLoad)]
    [ProvideAutoLoad(VSConstants.UICONTEXT.SolutionExists_string, PackageAutoLoadFlags.BackgroundLoad)]
    [ProvideToolWindow(typeof(DevGlobeToolWindow))]
    [ProvideMenuResource("Menus.ctmenu", 2)]
    [Guid(DevGlobeGuids.PackageGuidString)]
    public sealed class DevGlobePackage : AsyncPackage
    {
        private CoreClient _coreClient;
        private ActivityTracker _activityTracker;
        private DevGlobeStatusBar _statusBar;

        private const string PluginVersion = "0.1.0"; // must match source.extension.vsixmanifest

        /// <summary>
        /// Returns this package as the async factory for the tool window GUID. Required for
        /// ShowToolWindowAsync(create:true) on an AsyncPackage; without it creation fails and
        /// ShowToolWindowAsync returns null.
        /// </summary>
        public override IVsAsyncToolWindowFactory GetAsyncToolWindowFactory(Guid toolWindowType)
            => toolWindowType.Equals(new Guid(DevGlobeToolWindow.WindowGuidString)) ? this : null;

        /// <summary>Title shown while the tool window is created asynchronously.</summary>
        protected override string GetToolWindowTitle(Type toolWindowType, int id)
            => toolWindowType == typeof(DevGlobeToolWindow)
                ? "DevGlobe"
                : base.GetToolWindowTitle(toolWindowType, id);

        /// <summary>
        /// Async initialization. Commands (network-independent) are registered before the
        /// best-effort core bootstrap. Wrapped in try/catch so a failure does not surface as an
        /// opaque "SetSite failed" that blacklists the package.
        /// </summary>
        protected override async Task InitializeAsync(
            CancellationToken cancellationToken,
            IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);

            try
            {
                await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
                Log.RefreshLevel();
                Log.Info("DevGlobe activating…");

                // User notifications via the VS info bar.
                DevGlobeNotifications.Initialize(this);

                // Wire shell callbacks first: VS may create or restore the tool window at any time
                // and it reads from the shell.
                DevGlobeShell.Instance.OnConnect = OnConnectAsync;
                DevGlobeShell.Instance.OnDisconnect = OnDisconnectAsync;
                DevGlobeShell.Instance.OnStart = OnStartAsync;
                DevGlobeShell.Instance.OnStop = OnStopAsync;

                // Register commands independently of the network.
                await DevGlobeCommands.InitializeAllAsync(this, () => _coreClient);

                // Resolve and migrate the API key.
                var apiKey = ResolveAndMigrateApiKey();

                var statusbarSvc = await GetServiceAsync(typeof(SVsStatusbar)) as IVsStatusbar;
                _statusBar = statusbarSvc != null ? new DevGlobeStatusBar(statusbarSvc) : null;

                // Bootstrap the core binary best-effort, on a background task. An auto-load package
                // must never await a network operation (the core is ~114 MB) on its load path, or
                // the IDE appears frozen during the download on first launch. Commands and the shell
                // are already in place; StartCoreAsync wires the core once the binary is ready.
                // DisposalToken keeps the task alive past the end of InitializeAsync.
                _ = JoinableTaskFactory.RunAsync(async () =>
                {
                    // Leave the init path immediately. Since the work below can complete synchronously
                    // (cached binary, already on the UI thread), RunAsync would otherwise execute this
                    // delegate inline during InitializeAsync and delay package initialization.
                    await TaskScheduler.Default;

                    string corePath = null;
                    try
                    {
                        corePath = await CoreBootstrap.EnsureBinaryAsync(DisposalToken);
                        Log.Info("DevGlobe core binary ready", new { corePath });
                    }
                    catch (Exception ex)
                    {
                        Log.Error("DevGlobe: core binary unavailable (degraded mode)", new { error = ex.Message });
                    }

                    await JoinableTaskFactory.SwitchToMainThreadAsync();
                    if (corePath != null)
                    {
                        await StartCoreAsync(corePath, apiKey, DisposalToken);
                    }
                    else
                    {
                        // Degraded mode: no client, but commands and shell.OnConnect are in place.
                        DevGlobeShell.Instance.RaiseStateChanged(new TrackerState());
                    }
                });

                // Show the DevGlobe toolbar once on first launch (custom toolbars are hidden by
                // default in VS); afterwards VS remembers the user's choice. Deferred so the init
                // path does not touch the shell (DTE/CommandBars).
                _ = JoinableTaskFactory.RunAsync(async () =>
                {
                    await TaskScheduler.Default;
                    await JoinableTaskFactory.SwitchToMainThreadAsync();
                    EnsureToolbarShownOnce();
                });

                // The panel is not opened automatically at startup; the user opens it via the
                // DevGlobe toolbar button or View > Other Windows > DevGlobe. VS restores the tool
                // window if it was docked in the previous session.
                Log.Info("DevGlobe activated.");
            }
            catch (Exception ex)
            {
                Log.Error("DevGlobe: InitializeAsync failed", new { error = ex.ToString() });
            }
        }

        /// <summary>Creates the CoreClient and ActivityTracker, then starts tracking per config.</summary>
        private async Task StartCoreAsync(string corePath, string apiKey, CancellationToken ct)
        {
            _coreClient = new CoreClient(
                corePath,
                state => UpdateToolWindowState(state),
                PluginVersion,
                OnInvalidApiKey,
                statusBar: null, // status bar is handled at the package level (UpdateToolWindowState).
                notifyInfo: msg => DevGlobeNotifications.Info("DevGlobe: " + msg),
                notifyError: msg => DevGlobeNotifications.Error("DevGlobe: " + msg),
                offerReconnect: OfferReconnect);
            DevGlobeShell.Instance.Client = _coreClient;

            _activityTracker = new ActivityTracker(this, _coreClient);
            await _activityTracker.InitializeAsync(ct);
            Log.Info("DevGlobe: ActivityTracker initialized");

            var trackingEnabled = DevGlobeConfig.IsTrackingEnabled();
            if (!string.IsNullOrEmpty(apiKey) && trackingEnabled)
            {
                _coreClient.Init();
                _coreClient.Start();
            }
            else if (!string.IsNullOrEmpty(apiKey))
            {
                _coreClient.Init();
                UpdateToolWindowState(_coreClient.GetState());
            }
            else
            {
                UpdateToolWindowState(_coreClient.GetState());
            }
        }

        private string ResolveAndMigrateApiKey()
        {
            var configKey = DevGlobeConfig.ReadApiKey();
            if (!string.IsNullOrEmpty(configKey))
            {
                Log.Info("desktop api key resolved from config.toml", new { length = configKey.Length });
                DevGlobeConfig.StoreSecret(configKey);
                return configKey;
            }

            var stored = DevGlobeConfig.GetSecret();
            if (!string.IsNullOrEmpty(stored))
            {
                Log.Info("desktop api key resolved from secret store", new { length = stored.Length });
                DevGlobeConfig.WriteApiKey(stored);
                return stored;
            }

            Log.Info("desktop api key resolved: none");
            return string.Empty;
        }

        private void OnInvalidApiKey()
        {
            DevGlobeConfig.DeleteSecret();
            DevGlobeConfig.ClearApiKey();
            Log.Info("API key cleared after server rejected it (401)");
        }

        /// <summary>
        /// Updates the status bar and broadcasts state via the shell (the tool window subscribes).
        /// May be called from CoreClient.onStateChange on a non-UI thread, so work is marshalled
        /// onto the UI thread.
        /// </summary>
        private void UpdateToolWindowState(TrackerState state)
        {
            _ = JoinableTaskFactory.RunAsync(async () =>
            {
                await JoinableTaskFactory.SwitchToMainThreadAsync();

                if (_statusBar != null)
                {
                    if (state.Tracking) _statusBar.UpdateTime(state.TodaySeconds);
                    else _statusBar.Hide();
                }

                DevGlobeShell.Instance.RaiseStateChanged(state);
            });
        }

        /// <summary>
        /// Connect from the Login view. Writes the key to both stores, then starts the core
        /// (bootstrapping the binary on demand if running in degraded mode).
        /// </summary>
        private async Task OnConnectAsync(string rawKey)
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync();

            var token = (rawKey ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(token))
            {
                Log.Warn("desktop token empty, ignored");
                DevGlobeNotifications.Error("DevGlobe: API key is empty.");
                return;
            }

            Log.Info("desktop token saved from tool window", new { length = token.Length });
            DevGlobeConfig.StoreSecret(token);
            DevGlobeConfig.WriteApiKey(token);
            DevGlobeConfig.SetTrackingEnabled(true);

            if (_coreClient == null)
            {
                try
                {
                    var corePath = await CoreBootstrap.EnsureBinaryAsync(DisposalToken);
                    await StartCoreAsync(corePath, token, DisposalToken);
                    DevGlobeNotifications.Info("DevGlobe: Connected!");
                    return; // StartCoreAsync already performed Init/Start.
                }
                catch (Exception ex)
                {
                    Log.Error("DevGlobe: failed to start core on connect", new { error = ex.Message });
                    DevGlobeNotifications.Error("DevGlobe: failed to start tracking.");
                    return;
                }
            }

            _coreClient.Init();
            _coreClient.Start();
            UpdateToolWindowState(_coreClient.GetState());
            DevGlobeNotifications.Info("DevGlobe: Connected!");
        }

        /// <summary>Disconnect: clears the key from both stores and resets the core.</summary>
        private async Task OnDisconnectAsync()
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync();

            DevGlobeConfig.DeleteSecret();
            DevGlobeConfig.ClearApiKey();
            _coreClient?.Reset();
            UpdateToolWindowState(new TrackerState());
            Log.Info("DevGlobe disconnected");
            DevGlobeNotifications.Info("DevGlobe: Disconnected.");
        }

        /// <summary>
        /// Start tracking from the Dashboard: requires a key, persists trackingEnabled=true,
        /// (re)inits and starts, then notifies.
        /// </summary>
        private async Task OnStartAsync()
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync();

            var apiKey = DevGlobeConfig.ReadApiKey();
            if (string.IsNullOrEmpty(apiKey))
            {
                // No key: do nothing (and no notification).
                Log.Info("start tracking skipped: no api key");
                return;
            }

            DevGlobeConfig.SetTrackingEnabled(true);

            if (_coreClient == null)
            {
                try
                {
                    var corePath = await CoreBootstrap.EnsureBinaryAsync(DisposalToken);
                    await StartCoreAsync(corePath, apiKey, DisposalToken);
                }
                catch (Exception ex)
                {
                    Log.Error("DevGlobe: failed to start core on startTracking", new { error = ex.Message });
                    DevGlobeNotifications.Error("DevGlobe: failed to start tracking.");
                    return;
                }
            }
            else
            {
                _coreClient.Init();
                _coreClient.Start();
            }

            DevGlobeNotifications.Info("DevGlobe: Tracking started.");
        }

        /// <summary>
        /// Stop tracking from the Dashboard: persists trackingEnabled=false, pauses, then notifies.
        /// </summary>
        private async Task OnStopAsync()
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync();

            DevGlobeConfig.SetTrackingEnabled(false);
            _coreClient?.Pause();
            UpdateToolWindowState(_coreClient?.GetState() ?? new TrackerState());
            Log.Info("DevGlobe tracking stopped");
            DevGlobeNotifications.Info("DevGlobe: Tracking stopped.");
        }

        /// <summary>
        /// API key rejected (401): shows an error with a "Get API key" action that opens the
        /// dashboard settings page.
        /// </summary>
        private void OfferReconnect()
        {
            DevGlobeNotifications.ErrorWithAction(
                "DevGlobe: invalid API key. Please reconnect with a valid key.",
                "Get API key",
                () =>
                {
                    try
                    {
                        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(
                            "https://devglobe.app/dashboard/settings") { UseShellExecute = true });
                    }
                    catch (Exception ex)
                    {
                        Log.Warn("OfferReconnect: open browser failed", new { error = ex.Message });
                    }
                });
        }

        /// <summary>
        /// Shows the DevGlobe toolbar on the first launch only (tracked by a marker file in
        /// ~/.devglobe). Custom toolbars are hidden by default in VS; this surfaces the panel once,
        /// then respects the user's later choice.
        /// </summary>
        private void EnsureToolbarShownOnce()
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                var marker = System.IO.Path.Combine(DevGlobeConfig.DevGlobeDir, ".vs_toolbar_initialized");
                if (System.IO.File.Exists(marker)) return;

                if (GetService(typeof(SDTE)) is EnvDTE.DTE dte)
                {
                    dynamic commandBars = dte.CommandBars;
                    dynamic bar = commandBars["DevGlobe"];
                    if (bar != null)
                    {
                        bar.Visible = true;
                        Log.Info("DevGlobe toolbar shown (first run)");
                    }
                }

                System.IO.Directory.CreateDirectory(DevGlobeConfig.DevGlobeDir);
                System.IO.File.WriteAllText(marker, "1");
            }
            catch (Exception ex)
            {
                Log.Warn("DevGlobe: could not show toolbar on first run", new { error = ex.Message });
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _activityTracker?.Dispose();
                _coreClient?.Dispose();
                _statusBar?.Hide();
            }
            base.Dispose(disposing);
        }
    }
}
