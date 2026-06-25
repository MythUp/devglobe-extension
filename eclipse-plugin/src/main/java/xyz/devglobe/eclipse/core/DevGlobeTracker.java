package xyz.devglobe.eclipse.core;

import xyz.devglobe.eclipse.auth.ConfigWriter;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Central tracker orchestrating the core client lifecycle, document listening,
 * and state management. Mirrors DevGlobeTracker from the JetBrains plugin.
 */
public class DevGlobeTracker {

    private static final String PLUGIN_VERSION = "2.0.1";
    private static final String EDITOR = "eclipse";

    // ── Singleton ────────────────────────────────────────────────────────

    private static final DevGlobeTracker INSTANCE = new DevGlobeTracker();

    public static DevGlobeTracker getInstance() {
        return INSTANCE;
    }

    // ── State ────────────────────────────────────────────────────────────

    private volatile TrackerState state = TrackerState.DEFAULT;
    private final List<Runnable> stateListeners = new ArrayList<>();
    private final AtomicBoolean starting = new AtomicBoolean(false);
    private final AtomicBoolean intentionalShutdown = new AtomicBoolean(false);
    private CoreClient client;

    // ── Public API ───────────────────────────────────────────────────────

    public TrackerState getState() {
        return state;
    }

    public void addStateListener(Runnable listener) {
        synchronized (stateListeners) {
            stateListeners.add(listener);
        }
    }

    public void removeStateListener(Runnable listener) {
        synchronized (stateListeners) {
            stateListeners.remove(listener);
        }
    }

    private void fireStateChanged() {
        List<Runnable> listeners;
        synchronized (stateListeners) {
            listeners = new ArrayList<>(stateListeners);
        }
        for (Runnable l : listeners) {
            try { l.run(); } catch (Exception ignored) {}
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────────────

    public void saveApiKeyAndStart(String apiKey) {
        ConfigWriter.writeApiKey(apiKey);
        start();
    }

    public void start() {
        if (!starting.compareAndSet(false, true)) return;
        if (!ConfigWriter.hasApiKey()) {
            updateState(state.withConfigured(false).withError("No API key configured"));
            starting.set(false);
            return;
        }
        ensureCore();
    }

    public void pause() {
        if (client != null && client.isRunning()) {
            client.sendPause();
            updateState(state.withTracking(false));
            Notifier.confirm("Tracking paused");
        }
    }

    public void resume() {
        if (client != null && client.isRunning()) {
            client.sendResume();
            updateState(state.withTracking(true));
            Notifier.confirm("Tracking started");
        }
    }

    public void reset() {
        shutdownCore();
        ConfigWriter.clearApiKey();
        updateState(TrackerState.DEFAULT);
    }

    public void sendSetStatus(String message) {
        if (client != null && client.isRunning()) {
            client.sendSetStatus(message);
        }
    }

    public void shutdown() {
        shutdownCore();
        updateState(TrackerState.DEFAULT);
    }

    // ── Activity ────────────────────────────────────────────────────────

    public void sendActivity(String filePath, String language) {
        if (client != null && client.isRunning() && state.tracking) {
            client.sendActivity(filePath, language);
            // Update local language immediately so the UI reflects it
            // without waiting for the next heartbeat_ok from core
            if (language != null && !language.isEmpty() && !language.equals(state.language)) {
                updateState(state.withLanguage(language));
            }
        }
    }

    // ── Core management ─────────────────────────────────────────────────

    private void ensureCore() {
        intentionalShutdown.set(false);
        if (client != null && client.isRunning()) {
            // Already running — re-init
            client.sendInit(PLUGIN_VERSION, EDITOR);
            return;
        }

        if (!CoreDownloader.isInstalled()) {
            DevGlobePlugin.log("devglobe-core not found, downloading...");
            updateState(state.withError("Downloading devglobe-core..."));
            boolean ok = CoreDownloader.download();
            if (!ok) {
                updateState(state.withError("Failed to download devglobe-core"));
                starting.set(false);
                return;
            }
        }

        File binary = CoreDownloader.getBinaryPath();
        client = new CoreClient(new CoreCallbacks());
        boolean ok = client.start(binary.getAbsolutePath());
        if (!ok) {
            updateState(state.withError("Failed to start devglobe-core"));
            starting.set(false);
            return;
        }
        client.sendInit(PLUGIN_VERSION, EDITOR);
    }

    private void shutdownCore() {
        intentionalShutdown.set(true);
        if (client != null) {
            client.stop();
            client = null;
        }
        // Keep intentionalShutdown=true until onProcessDied() has run.
        // It will be reset at the start of the next ensureCore() call.
    }

    // ── State updates ────────────────────────────────────────────────────

    private void updateState(TrackerState newState) {
        this.state = newState;
        fireStateChanged();
    }

    // ── Core callbacks ──────────────────────────────────────────────────

    private class CoreCallbacks implements CoreClient.Callbacks {
        @Override
        public void onReady(boolean configured) {
            starting.set(false);
            if (configured) {
                // Don't assume online — wait for the actual "online" event from core.
                // Set tracking=true so the UI shows the dashboard, but keep offline=true
                // until the core confirms connectivity via onOnline().
                updateState(state.withConfigured(true).withTracking(true).withError(null).withOffline(true));
            } else {
                updateState(state.withConfigured(false).withError("Not configured"));
            }
        }

        @Override
        public void onNotConfigured() {
            starting.set(false);
            updateState(state.withConfigured(false).withError("Not configured — check your API key"));
        }

        @Override
        public void onInvalidApiKey() {
            starting.set(false);
            updateState(state.withConfigured(false).withError("Invalid API key"));
            Notifier.error("Invalid API key");
        }

        @Override
        public void onHeartbeatOk(int todaySeconds, String language) {
            String ct = TrackerState.formatSeconds(todaySeconds);
            TrackerState updated = state.withTodaySeconds(todaySeconds)
                    .withCodingTime(ct)
                    .withTracking(true)
                    .withOffline(false)
                    .withError(null);
            if (language != null && !language.isEmpty()) {
                updated = updated.withLanguage(language);
            }
            updateState(updated);
        }

        @Override
        public void onOffline() {
            updateState(state.withOffline(true));
        }

        @Override
        public void onOnline() {
            updateState(state.withOffline(false).withError(null));
            Notifier.confirm("Connected!");
        }

        @Override
        public void onStatusOk() {
            DevGlobePlugin.log("Status set successfully");
            Notifier.confirm("Status updated");
        }

        @Override
        public void onStatusError(String message) {
            DevGlobePlugin.log("Status error: " + message);
            updateState(state.withError(message));
            Notifier.error("Status error: " + message);
        }

        @Override
        public void onError(String message) {
            starting.set(false);
            DevGlobePlugin.log("Core error: " + message);
            updateState(state.withError(message));
            Notifier.error(message);
        }

        @Override
        public void onProcessDied() {
            starting.set(false);
            if (intentionalShutdown.get()) {
                // Expected during disconnect/reset - don't show error
                DevGlobePlugin.log("Core process stopped intentionally");
            } else {
                // Unexpected process death
                DevGlobePlugin.log("Core process died unexpectedly");
                updateState(state.withError("Core process died").withTracking(false));
                Notifier.error("Core process died");
            }
        }
    }
}
