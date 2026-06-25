package xyz.devglobe.eclipse.core;

import java.io.*;
import java.util.concurrent.TimeUnit;

/**
 * JSON-line IPC client for the devglobe-core subprocess.
 * Mirrors the CoreClient from the JetBrains plugin.
 */
public class CoreClient {

    // ── Callbacks ───────────────────────────────────────────────────────

    public interface Callbacks {
        void onReady(boolean configured);
        void onNotConfigured();
        void onInvalidApiKey();
        void onHeartbeatOk(int todaySeconds, String language);
        void onOffline();
        void onOnline();
        void onStatusOk();
        void onStatusError(String message);
        void onError(String message);
        void onProcessDied();
    }

    // ── Fields ───────────────────────────────────────────────────────────

    private Process process;
    private BufferedWriter writer;
    private Thread readerThread;
    private volatile boolean running = false;
    private final Callbacks callbacks;

    public CoreClient(Callbacks callbacks) {
        this.callbacks = callbacks;
    }

    // ── Lifecycle ────────────────────────────────────────────────────────

    public synchronized boolean start(String binaryPath) {
        if (running) return true;
        try {
            ProcessBuilder pb = new ProcessBuilder(binaryPath, "daemon");
            pb.redirectErrorStream(false);

            process = pb.start();
            writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()));

            readerThread = new Thread(this::readLoop, "DevGlobe-CoreReader");
            readerThread.setDaemon(true);
            readerThread.start();

            running = true;
            return true;
        } catch (IOException e) {
            DevGlobePlugin.log("Failed to start core: " + e.getMessage());
            callbacks.onError("Failed to start core: " + e.getMessage());
            return false;
        }
    }

    public synchronized void stop() {
        try {
            if (writer != null) {
                sendShutdown();
                writer.flush();
            }
        } catch (IOException ignored) {}
        running = false;
        try {
            if (process != null) process.waitFor(1, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        try {
            if (writer != null) writer.close();
        } catch (IOException ignored) {}
        if (process != null) process.destroyForcibly();
        if (readerThread != null) readerThread.interrupt();
        process = null;
        writer = null;
        readerThread = null;
    }

    public boolean isRunning() {
        return running && process != null && process.isAlive();
    }

    // ── Send methods ─────────────────────────────────────────────────────

    public synchronized void sendInit(String pluginVersion, String editor) {
        send("init", "plugin_version", pluginVersion, "editor", editor);
    }

    public synchronized void sendActivity(String file, String language) {
        if (language != null && !language.isEmpty()) {
            send("activity", "file", file, "language", language);
        } else {
            send("activity", "file", file);
        }
    }

    public synchronized void sendSetStatus(String message) {
        send("set_status", "message", message);
    }

    public synchronized void sendPause() {
        send("pause");
    }

    public synchronized void sendResume() {
        send("resume");
    }

    public synchronized void sendShutdown() {
        send("shutdown");
    }

    // ── Internal ─────────────────────────────────────────────────────────

    private void send(String method, Object... keyValues) {
        if (!running || writer == null) return;
        try {
            StringBuilder sb = new StringBuilder();
            sb.append("{\"method\":\"").append(method).append("\"");
            if (keyValues != null && keyValues.length >= 2) {
                sb.append(",\"params\":{");
                for (int i = 0; i < keyValues.length; i += 2) {
                    if (i > 0) sb.append(",");
                    sb.append("\"").append(keyValues[i]).append("\":");
                    Object val = keyValues[i + 1];
                    if (val instanceof Number) {
                        sb.append(val);
                    } else {
                        sb.append("\"").append(escapeJson(val.toString())).append("\"");
                    }
                }
                sb.append("}");
            }
            sb.append("}\n");
            writer.write(sb.toString());
            writer.flush();
        } catch (IOException e) {
            DevGlobePlugin.log("Failed to send to core: " + e.getMessage());
        }
    }

    private void readLoop() {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()))) {
            String line;
            while (running && (line = reader.readLine()) != null) {
                handleLine(line.trim());
            }
        } catch (IOException ignored) {
        } finally {
            running = false;
            callbacks.onProcessDied();
        }
    }

    private void handleLine(String line) {
        if (line.isEmpty()) return;
        try {
            // Minimal JSON parsing — no external dependency
            String event = extractString(line, "event");
            if (event == null) return;

            switch (event) {
                case "ready": {
                    boolean configured = extractBool(line, "configured");
                    callbacks.onReady(configured);
                    break;
                }
                case "not_configured":
                    callbacks.onNotConfigured();
                    break;
                case "invalid_api_key":
                    callbacks.onInvalidApiKey();
                    break;
                case "heartbeat_ok": {
                    int secs = extractInt(line, "today_seconds");
                    String lang = extractString(line, "language");
                    callbacks.onHeartbeatOk(secs, lang);
                    break;
                }
                case "offline":
                    callbacks.onOffline();
                    break;
                case "online":
                    callbacks.onOnline();
                    break;
                case "status_ok":
                    callbacks.onStatusOk();
                    break;
                case "status_error": {
                    String msg = extractString(line, "message");
                    callbacks.onStatusError(msg != null ? msg : "Unknown status error");
                    break;
                }
                default:
                    DevGlobePlugin.log("Unknown event from core: " + event);
            }
        } catch (Exception e) {
            DevGlobePlugin.log("Error parsing core message: " + e.getMessage());
        }
    }

    // ── Minimal JSON helpers ─────────────────────────────────────────────

    private static String extractString(String json, String key) {
        String needle = "\"" + key + "\":\"";
        int start = json.indexOf(needle);
        if (start < 0) {
            // try without quotes (number, bool, or null literal)
            needle = "\"" + key + "\":";
            start = json.indexOf(needle);
            if (start < 0) return null;
            start += needle.length();
            int end = json.indexOf(",", start);
            if (end < 0) end = json.indexOf("}", start);
            if (end < 0) end = json.length();
            String raw = json.substring(start, end).trim();
            // JSON null literal → Java null
            if ("null".equals(raw)) return null;
            return raw;
        }
        start += needle.length();
        int end = json.indexOf("\"", start);
        if (end < 0) return null;
        return json.substring(start, end);
    }

    private static int extractInt(String json, String key) {
        String val = extractString(json, key);
        if (val == null) return 0;
        try { return Integer.parseInt(val); } catch (NumberFormatException e) { return 0; }
    }

    private static boolean extractBool(String json, String key) {
        String val = extractString(json, key);
        return "true".equalsIgnoreCase(val);
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }
}
