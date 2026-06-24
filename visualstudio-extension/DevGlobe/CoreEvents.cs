using Newtonsoft.Json;

namespace DevGlobe
{
    /// <summary>
    /// Deserialization DTO for one daemon stdout line: { "event": "...", "data": { ... } }.
    /// </summary>
    internal sealed class CoreEvent
    {
        [JsonProperty("event")]
        public string? Event { get; set; }

        [JsonProperty("data")]
        public CoreEventData? Data { get; set; }
    }

    internal sealed class CoreEventData
    {
        [JsonProperty("configured")]
        public bool Configured { get; set; }

        [JsonProperty("today_seconds")]
        public long TodaySeconds { get; set; }

        [JsonProperty("language")]
        public string? Language { get; set; }

        [JsonProperty("message")]
        public string? Message { get; set; }
    }

    /// <summary>
    /// Side effects for CoreClient to apply after HandleLine. HandleLine only mutates the
    /// TrackerState and fills this descriptor; CoreClient then runs the effects.
    /// </summary>
    internal sealed class HandleLineResult
    {
        /// <summary>State changed: call onStateChange.</summary>
        public bool StateChanged { get; set; }

        /// <summary>heartbeat_ok received: update the status bar with these seconds.</summary>
        public bool UpdateStatusBar { get; set; }
        public long StatusBarSeconds { get; set; }

        /// <summary>invalid_api_key received: warn the user and call onInvalidApiKey.</summary>
        public bool InvalidApiKey { get; set; }

        /// <summary>status_ok received: notify the user.</summary>
        public bool StatusOk { get; set; }

        /// <summary>status_error received: warn the user with this message.</summary>
        public bool StatusError { get; set; }
        public string? StatusErrorMessage { get; set; }
    }
}
