using System;
using System.Threading.Tasks;

namespace DevGlobe
{
    /// <summary>
    /// Shared package state accessible to the tool window regardless of its lifecycle. VS may
    /// recreate the tool window via its parameterless constructor (layout restore, reopen) without
    /// going through the package, so this singleton holds the callbacks and survives those
    /// recreations: the package fills it in InitializeAsync, and the tool window consumes it in its
    /// constructor and subscribes to <see cref="StateChanged"/>.
    /// </summary>
    public sealed class DevGlobeShell
    {
        public static DevGlobeShell Instance { get; } = new DevGlobeShell();

        private DevGlobeShell() { }

        /// <summary>Current daemon client (recreated after reset/reconnect, null in degraded mode).</summary>
        public CoreClient Client { get; set; }

        /// <summary>Connect from the Login view: writes config and (re)inits and starts.</summary>
        public Func<string, Task> OnConnect { get; set; }

        /// <summary>Disconnect from the Dashboard: clears the key and resets the core.</summary>
        public Func<Task> OnDisconnect { get; set; }

        /// <summary>Start tracking from the Dashboard: persists tracking_enabled and (re)inits and starts.</summary>
        public Func<Task> OnStart { get; set; }

        /// <summary>Stop tracking from the Dashboard: persists tracking_enabled=false and pauses.</summary>
        public Func<Task> OnStop { get; set; }

        /// <summary>Raised on every state change; the tool window subscribes to refresh itself.</summary>
        public event Action<TrackerState> StateChanged;

        public void RaiseStateChanged(TrackerState state) => StateChanged?.Invoke(state);

        /// <summary>Current state from the client, or null if there is no client.</summary>
        public TrackerState CurrentState => Client?.GetState();
    }
}
