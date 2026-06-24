namespace DevGlobe
{
    /// <summary>
    /// Observable tracker state pushed to the tool window and status bar on every change.
    /// Shared across CoreClient, DevGlobePackage, DevGlobeToolWindow, DashboardView and
    /// DevGlobeStatusBar.
    /// </summary>
    public sealed class TrackerState
    {
        /// <summary>API key is present and the core is configured.</summary>
        public bool Configured { get; set; }

        /// <summary>Tracking is active (heartbeats in progress).</summary>
        public bool Tracking { get; set; }

        /// <summary>Today's coding time, formatted for display (e.g. "2h 15m").</summary>
        public string CodingTime { get; set; } = "0m";

        /// <summary>Today's coding time in seconds.</summary>
        public long TodaySeconds { get; set; }

        /// <summary>Detected active language, or null if unknown.</summary>
        public string? Language { get; set; }

        /// <summary>Core is offline (network failure, awaiting reconnect).</summary>
        public bool Offline { get; set; }
    }
}
