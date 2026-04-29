package xyz.devglobe.plugin.core

data class TrackerState(
    val configured: Boolean = false,
    val tracking: Boolean = false,
    val codingTime: String = "0m",
    val todaySeconds: Int = 0,
    val language: String? = null,
    val offline: Boolean = false,
    val error: String? = null,
)
