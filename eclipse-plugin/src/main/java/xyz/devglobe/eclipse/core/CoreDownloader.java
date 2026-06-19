package xyz.devglobe.eclipse.core;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.util.EnumSet;
import java.util.Set;

/**
 * Downloads the devglobe-core binary from GitHub releases.
 * Mirrors the CoreDownloader from the JetBrains plugin.
 */
public final class CoreDownloader {

    public static final String CORE_VERSION = "2.0.1";
    private static final String BASE_URL =
            "https://github.com/Nako0/devglobe-extension/releases/download/core-v"
                    + CORE_VERSION + "/devglobe-core-";
    private static final int MAX_ATTEMPTS = 3;
    private static final long RETRY_BACKOFF_MS = 1500L;
    private static final int CONNECT_TIMEOUT_MS = 30_000;
    private static final int READ_TIMEOUT_MS = 120_000;

    private CoreDownloader() {}

    // ── Platform detection ───────────────────────────────────────────────

    public static String detectPlatform() {
        String os = System.getProperty("os.name", "").toLowerCase();
        String arch = System.getProperty("os.arch", "").toLowerCase();

        String platform;
        if (os.contains("mac") || os.contains("darwin")) {
            platform = arch.contains("aarch64") || arch.contains("arm")
                    ? "darwin-arm64" : "darwin-x64";
        } else if (os.contains("linux") || os.contains("nix")) {
            platform = arch.contains("aarch64") || arch.contains("arm")
                    ? "linux-arm64" : "linux-x64";
        } else if (os.contains("win")) {
            platform = arch.contains("aarch64") || arch.contains("arm")
                    ? "win-arm64" : "win-x64";
        } else {
            platform = "linux-x64"; // fallback
        }
        return platform;
    }

    // ── Binary path ─────────────────────────────────────────────────────

    public static File getBinaryPath() {
        String ext = detectPlatform().startsWith("win") ? ".exe" : "";
        return new File(CoreDownloader.devglobeBinDir(),
                "devglobe-core-" + CORE_VERSION + ext);
    }

    public static File devglobeBinDir() {
        return new File(new File(System.getProperty("user.home"), ".devglobe"), "bin");
    }

    public static boolean isInstalled() {
        File binary = getBinaryPath();
        return binary.exists() && binary.length() > 0;
    }

    // ── Download ─────────────────────────────────────────────────────────

    public static boolean download() {
        String platform = detectPlatform();
        String downloadUrl = BASE_URL + platform;
        if (platform.startsWith("win")) downloadUrl += ".exe";

        File binDir = devglobeBinDir();
        if (!binDir.exists()) binDir.mkdirs();

        File target = getBinaryPath();
        File tmp = new File(target.getParent(), target.getName() + ".tmp");

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                DevGlobePlugin.log("Downloading devglobe-core (attempt " + attempt + ") from " + downloadUrl);
                if (downloadOnce(downloadUrl, tmp)) {
                    Files.move(tmp.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
                    setExecutable(target);
                    DevGlobePlugin.log("devglobe-core downloaded successfully");
                    return true;
                }
            } catch (Exception e) {
                DevGlobePlugin.log("Download attempt " + attempt + " failed: " + e.getMessage());
            } finally {
                tmp.delete();
            }

            if (attempt < MAX_ATTEMPTS) {
                try { Thread.sleep(RETRY_BACKOFF_MS * attempt); } catch (InterruptedException ignored) {}
            }
        }
        return false;
    }

    private static boolean downloadOnce(String urlStr, File target) throws IOException {
        HttpURLConnection conn = null;
        try {
            URL url = URI.create(urlStr).toURL();
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setInstanceFollowRedirects(true);

            int code = conn.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                DevGlobePlugin.log("HTTP " + code + " for " + urlStr);
                return false;
            }

            try (InputStream in = conn.getInputStream();
                 OutputStream out = new FileOutputStream(target)) {
                in.transferTo(out);
            }
            return true;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static void setExecutable(File file) {
        try {
            String os = System.getProperty("os.name", "").toLowerCase();
            if (os.contains("win")) return;
            Set<PosixFilePermission> perms = EnumSet.of(
                    PosixFilePermission.OWNER_READ,
                    PosixFilePermission.OWNER_WRITE,
                    PosixFilePermission.OWNER_EXECUTE);
            Files.setPosixFilePermissions(file.toPath(), perms);
        } catch (Exception ignored) {
            file.setExecutable(true);
        }
    }
}
