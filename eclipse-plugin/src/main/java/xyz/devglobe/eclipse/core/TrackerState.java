package xyz.devglobe.eclipse.core;

/**
 * Immutable snapshot of the DevGlobe tracker state.
 */
public class TrackerState {

    public static final TrackerState DEFAULT = new TrackerState();

    public final boolean configured;
    public final boolean tracking;
    public final String codingTime;
    public final int todaySeconds;
    public final String language;
    public final boolean offline;
    public final String error;

    private TrackerState() {
        this(false, false, "0m", 0, null, true, null);
    }

    private TrackerState(boolean configured, boolean tracking, String codingTime,
                         int todaySeconds, String language, boolean offline, String error) {
        this.configured = configured;
        this.tracking = tracking;
        this.codingTime = codingTime;
        this.todaySeconds = todaySeconds;
        this.language = language;
        this.offline = offline;
        this.error = error;
    }

    public TrackerState withConfigured(boolean v) {
        return new TrackerState(v, tracking, codingTime, todaySeconds, language, offline, error);
    }

    public TrackerState withTracking(boolean v) {
        return new TrackerState(configured, v, codingTime, todaySeconds, language, offline, error);
    }

    public TrackerState withCodingTime(String v) {
        return new TrackerState(configured, tracking, v, todaySeconds, language, offline, error);
    }

    public TrackerState withTodaySeconds(int v) {
        return new TrackerState(configured, tracking, codingTime, v, language, offline, error);
    }

    public TrackerState withLanguage(String v) {
        return new TrackerState(configured, tracking, codingTime, todaySeconds, v, offline, error);
    }

    public TrackerState withOffline(boolean v) {
        return new TrackerState(configured, tracking, codingTime, todaySeconds, language, v, error);
    }

    public TrackerState withError(String v) {
        return new TrackerState(configured, tracking, codingTime, todaySeconds, language, offline, v);
    }

    public static String formatSeconds(int seconds) {
        int h = seconds / 3600;
        int m = (seconds % 3600) / 60;
        return h > 0 ? h + "h " + m + "m" : m + "m";
    }
}
