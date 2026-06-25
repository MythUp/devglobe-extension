package xyz.devglobe.eclipse.auth;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.attribute.PosixFilePermission;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import xyz.devglobe.eclipse.core.DevGlobePlugin;

/**
 * Reads and writes the DevGlobe config.toml file (~/.devglobe/config.toml).
 * The API key is written directly into the TOML root so setup works before
 * the core binary has been downloaded, and the key never appears on a process
 * command line.
 */
public final class ConfigWriter {

    private static final Pattern ROOT_API_KEY = Pattern.compile("^api_key\\s*=\\s*\"([^\"]*)\"");

    private ConfigWriter() {}

    public static File devglobeDir() {
        return new File(System.getProperty("user.home"), ".devglobe");
    }

    public static File configPath() {
        return new File(devglobeDir(), "config.toml");
    }

    public static File logPath() {
        return new File(devglobeDir(), "devglobe.log");
    }

    // ── API Key ──────────────────────────────────────────────────────────

    /**
     * Writes the API key into the {@code api_key} root entry of config.toml,
     * preserving any other settings and sections. Written with 0600 permissions.
     */
    public static void writeApiKey(String apiKey) {
        try {
            File dir = devglobeDir();
            if (!dir.exists()) dir.mkdirs();

            File configFile = configPath();
            List<String> lines = configFile.exists()
                    ? new ArrayList<>(Files.readAllLines(configFile.toPath()))
                    : new ArrayList<>();

            String keyLine = "api_key = \"" + escapeToml(apiKey) + "\"";
            int idx = findRootApiKeyIndex(lines);
            if (idx >= 0) {
                lines.set(idx, keyLine);
            } else {
                lines.add(0, keyLine);
            }

            String output = String.join("\n", lines).replaceAll("\n{3,}", "\n\n");
            if (!output.endsWith("\n")) output += "\n";
            Files.writeString(configFile.toPath(), output);
            setRestrictivePermissions(configFile);
        } catch (IOException e) {
            DevGlobePlugin.log("Failed to write API key: " + e.getMessage());
        }
    }

    private static String escapeToml(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public static boolean hasApiKey() {
        try {
            File configFile = configPath();
            if (!configFile.exists()) return false;
            List<String> lines = Files.readAllLines(configFile.toPath());
            int idx = findRootApiKeyIndex(lines);
            if (idx < 0) return false;
            Matcher m = ROOT_API_KEY.matcher(lines.get(idx).trim());
            return m.matches() && !m.group(1).isEmpty();
        } catch (IOException e) {
            return false;
        }
    }

    public static String readApiKey() {
        try {
            File configFile = configPath();
            if (!configFile.exists()) return null;
            List<String> lines = Files.readAllLines(configFile.toPath());
            int idx = findRootApiKeyIndex(lines);
            if (idx < 0) return null;
            Matcher m = ROOT_API_KEY.matcher(lines.get(idx).trim());
            return m.matches() ? m.group(1) : null;
        } catch (IOException e) {
            return null;
        }
    }

    /**
     * Clears the API key by removing the {@code api_key} line from config.toml.
     * This avoids calling {@code devglobe-core setup ""} which doesn't accept
     * an empty argument.
     */
    public static void clearApiKey() {
        try {
            File configFile = configPath();
            if (!configFile.exists()) return;

            List<String> lines = new ArrayList<>(Files.readAllLines(configFile.toPath()));
            int idx = findRootApiKeyIndex(lines);
            if (idx < 0) return; // no key to clear

            lines.remove(idx);
            String output = String.join("\n", lines).replaceAll("\n{3,}", "\n\n");
            if (!output.endsWith("\n")) output += "\n";
            Files.writeString(configFile.toPath(), output);
            setRestrictivePermissions(configFile);
        } catch (IOException e) {
            DevGlobePlugin.log("Failed to clear API key: " + e.getMessage());
        }
    }

    // ── Debug ────────────────────────────────────────────────────────────

    private static final Pattern DEBUG_PATTERN = Pattern.compile("^debug\\s*=\\s*(true|false)");

    public static boolean isDebugEnabled() {
        try {
            File configFile = configPath();
            if (!configFile.exists()) return false;
            for (String line : Files.readAllLines(configFile.toPath())) {
                String trimmed = line.trim();
                if (trimmed.startsWith("[")) return false;
                Matcher m = DEBUG_PATTERN.matcher(trimmed);
                if (m.matches()) return Boolean.parseBoolean(m.group(1));
            }
            return false;
        } catch (IOException e) {
            return false;
        }
    }

    public static void setDebug(boolean enabled) {
        try {
            File dir = devglobeDir();
            if (!dir.exists()) dir.mkdirs();

            File configFile = configPath();
            List<String> lines = configFile.exists()
                    ? new ArrayList<>(Files.readAllLines(configFile.toPath()))
                    : new ArrayList<>();

            int idx = -1;
            for (int i = 0; i < lines.size(); i++) {
                String trimmed = lines.get(i).trim();
                if (trimmed.startsWith("[")) break;
                if (trimmed.startsWith("debug")) { idx = i; break; }
            }

            if (idx >= 0 && enabled) {
                lines.set(idx, "debug = true");
            } else if (idx >= 0 && !enabled) {
                lines.remove(idx);
            } else if (idx < 0 && enabled) {
                int apiKeyIdx = -1;
                for (int i = 0; i < lines.size(); i++) {
                    if (lines.get(i).trim().startsWith("api_key")) { apiKeyIdx = i; break; }
                }
                if (apiKeyIdx >= 0) lines.add(apiKeyIdx + 1, "debug = true");
                else lines.add(0, "debug = true");
            }

            String output = String.join("\n", lines).replaceAll("\n{3,}", "\n\n");
            if (!output.endsWith("\n")) output += "\n";
            Files.writeString(configFile.toPath(), output);
            setRestrictivePermissions(configFile);
        } catch (IOException e) {
            DevGlobePlugin.log("Failed to set debug flag: " + e.getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static int findRootApiKeyIndex(List<String> lines) {
        for (int i = 0; i < lines.size(); i++) {
            String trimmed = lines.get(i).trim();
            if (trimmed.startsWith("[")) return -1;
            if (trimmed.startsWith("api_key")) return i;
        }
        return -1;
    }

    private static void setRestrictivePermissions(File file) {
        try {
            String os = System.getProperty("os.name", "").toLowerCase();
            if (os.contains("win")) return;
            Set<PosixFilePermission> perms = EnumSet.of(
                    PosixFilePermission.OWNER_READ,
                    PosixFilePermission.OWNER_WRITE);
            Files.setPosixFilePermissions(file.toPath(), perms);
        } catch (Exception ignored) {
            // best effort
        }
    }
}
