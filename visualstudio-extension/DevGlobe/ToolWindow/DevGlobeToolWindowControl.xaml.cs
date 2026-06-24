using System;
using System.Threading.Tasks;
using System.Windows.Controls;

namespace DevGlobe.ToolWindow
{
    /// <summary>
    /// WPF host for both views. Toggles Login/Dashboard based on Configured and relays
    /// actions through <see cref="DevGlobeShell"/>. The package shell is the source of truth
    /// (rather than a one-time pushed state), so buttons stay active even if VS recreates this window.
    /// </summary>
    public partial class DevGlobeToolWindowControl : UserControl
    {
        public DevGlobeToolWindowControl()
        {
            InitializeComponent();

            // Wire view events to local handlers.
            LoginViewControl.ConnectRequested += OnConnectRequested;
            DashboardViewControl.StartRequested += OnStartRequested;
            DashboardViewControl.StopRequested += OnStopRequested;
            DashboardViewControl.SetStatusRequested += OnSetStatusRequested;
            DashboardViewControl.DisconnectRequested += OnDisconnectRequested;

            // Subscribe to the package shell (source of truth), resilient to window recreation.
            DevGlobeShell.Instance.StateChanged += OnShellStateChanged;
            Unloaded += (s, e) => DevGlobeShell.Instance.StateChanged -= OnShellStateChanged;

            // Initial state (defaults to Login when no client exists yet).
            UpdateState(DevGlobeShell.Instance.CurrentState ?? new TrackerState());
        }

        private void OnShellStateChanged(TrackerState state)
        {
            if (Dispatcher.CheckAccess()) UpdateState(state);
            else Dispatcher.Invoke(() => UpdateState(state));
        }

        /// <summary>
        /// Pushes state into the UI: if configured show Dashboard, otherwise show Login (cleared field).
        /// </summary>
        public void UpdateState(TrackerState state)
        {
            if (state == null)
            {
                return;
            }

            if (state.Configured)
            {
                LoginViewControl.Visibility = System.Windows.Visibility.Collapsed;
                DashboardViewControl.Visibility = System.Windows.Visibility.Visible;
                DashboardViewControl.ApplyState(state);
            }
            else
            {
                DashboardViewControl.Visibility = System.Windows.Visibility.Collapsed;
                LoginViewControl.Visibility = System.Windows.Visibility.Visible;
                LoginViewControl.Clear();
            }
        }

        private async void OnConnectRequested(string key)
        {
            var onConnect = DevGlobeShell.Instance.OnConnect;
            if (onConnect == null)
            {
                return;
            }

            try
            {
                await onConnect(key);
            }
            catch (Exception ex)
            {
                Log.Info("ToolWindow: connect failed", ex.Message);
            }
        }

        // Start/Stop go through the package shell (like connect/disconnect) to persist
        // tracking_enabled and show the notification.
        private void OnStartRequested()
        {
            var onStart = DevGlobeShell.Instance.OnStart;
            if (onStart != null) _ = onStart();
        }

        private void OnStopRequested()
        {
            var onStop = DevGlobeShell.Instance.OnStop;
            if (onStop != null) _ = onStop();
        }

        private void OnSetStatusRequested(string message) => DevGlobeShell.Instance.Client?.SetStatus(message);

        private async void OnDisconnectRequested()
        {
            var onDisconnect = DevGlobeShell.Instance.OnDisconnect;
            if (onDisconnect == null)
            {
                return;
            }

            try
            {
                await onDisconnect();
            }
            catch (Exception ex)
            {
                Log.Info("ToolWindow: disconnect failed", ex.Message);
            }
        }
    }
}
