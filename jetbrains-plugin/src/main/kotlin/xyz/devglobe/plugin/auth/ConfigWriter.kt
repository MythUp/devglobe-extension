package xyz.devglobe.plugin.auth

import com.intellij.openapi.diagnostic.Logger
import java.io.File
import java.nio.file.attribute.PosixFilePermissions
import java.nio.file.Files

/**
 * Writes the API key to ~/.devglobe/config.toml so the core (running as a
 * subprocess) can pick it up on next init. Preserves other settings.
 */
object ConfigWriter {

    private val LOG = Logger.getInstance(ConfigWriter::class.java)

    private fun devglobeDir(): File = File(System.getProperty("user.home"), ".devglobe")
    fun configPath(): File = File(devglobeDir(), "config.toml")
    fun logPath(): File = File(devglobeDir(), "devglobe.log")

    fun writeApiKey(apiKey: String) {
        try {
            val dir = devglobeDir()
            if (!dir.exists()) dir.mkdirs()

            val configFile = configPath()
            val original = if (configFile.exists()) configFile.readText().split("\n") else emptyList()
            val newKeyLine = "api_key = \"$apiKey\""

            val lines = original.toMutableList()
            val existingIdx = findRootApiKeyIndex(lines)
            if (existingIdx >= 0) {
                lines[existingIdx] = newKeyLine
            } else {
                lines.add(0, newKeyLine)
            }

            val output = lines.joinToString("\n").replace(Regex("\n{3,}"), "\n\n")
            configFile.writeText(if (output.endsWith("\n")) output else "$output\n")
            setRestrictivePermissions(configFile)
        } catch (e: Exception) {
            LOG.warn("Failed to write config.toml: ${e.message}")
        }
    }

    fun hasApiKey(): Boolean {
        return try {
            val configFile = configPath()
            if (!configFile.exists()) return false
            val lines = configFile.readText().split("\n")
            val idx = findRootApiKeyIndex(lines)
            idx >= 0 && lines[idx].substringAfter("=").trim().trim('"').isNotEmpty()
        } catch (e: Exception) {
            LOG.warn("Failed to read config.toml: ${e.message}")
            false
        }
    }

    fun isDebugEnabled(): Boolean {
        return try {
            val configFile = configPath()
            if (!configFile.exists()) return false
            for (line in configFile.readText().split("\n")) {
                val trimmed = line.trim()
                if (trimmed.startsWith("[")) return false
                val m = Regex("^debug\\s*=\\s*(true|false)").find(trimmed) ?: continue
                return m.groupValues[1] == "true"
            }
            false
        } catch (e: Exception) {
            LOG.warn("Failed to read debug flag: ${e.message}")
            false
        }
    }

    fun setDebug(enabled: Boolean) {
        try {
            val dir = devglobeDir()
            if (!dir.exists()) dir.mkdirs()

            val configFile = configPath()
            val original = if (configFile.exists()) configFile.readText().split("\n") else emptyList()
            val lines = original.toMutableList()

            // Find or remove existing root-level debug line.
            var idx = -1
            for ((i, line) in lines.withIndex()) {
                val trimmed = line.trim()
                if (trimmed.startsWith("[")) break
                if (trimmed.startsWith("debug")) { idx = i; break }
            }

            when {
                idx >= 0 && enabled -> lines[idx] = "debug = true"
                idx >= 0 && !enabled -> lines.removeAt(idx)
                idx < 0 && enabled -> {
                    val apiKeyIdx = lines.indexOfFirst { it.trim().startsWith("api_key") }
                    if (apiKeyIdx >= 0) lines.add(apiKeyIdx + 1, "debug = true")
                    else lines.add(0, "debug = true")
                }
            }

            val output = lines.joinToString("\n").replace(Regex("\n{3,}"), "\n\n")
            configFile.writeText(if (output.endsWith("\n")) output else "$output\n")
            setRestrictivePermissions(configFile)
        } catch (e: Exception) {
            LOG.warn("Failed to set debug flag: ${e.message}")
        }
    }

    fun clearApiKey() {
        try {
            val configFile = configPath()
            if (!configFile.exists()) return
            val kept = mutableListOf<String>()
            var beforeSection = true
            for (line in configFile.readText().split("\n")) {
                val trimmed = line.trim()
                if (trimmed.startsWith("[")) beforeSection = false
                if (beforeSection && trimmed.startsWith("api_key")) continue
                kept.add(line)
            }
            configFile.writeText(kept.joinToString("\n"))
            setRestrictivePermissions(configFile)
        } catch (e: Exception) {
            LOG.warn("Failed to clear api_key from config.toml: ${e.message}")
        }
    }

    // Returns the index of the root-level `api_key = ...` line, or -1.
    // Only scans lines before the first `[section]` since api_key is in the
    // implicit root table.
    private fun findRootApiKeyIndex(lines: List<String>): Int {
        for ((i, line) in lines.withIndex()) {
            val trimmed = line.trim()
            if (trimmed.startsWith("[")) return -1
            if (trimmed.startsWith("api_key")) return i
        }
        return -1
    }

    private fun setRestrictivePermissions(file: File) {
        try {
            if (System.getProperty("os.name").lowercase().contains("win")) return
            Files.setPosixFilePermissions(file.toPath(), PosixFilePermissions.fromString("rw-------"))
        } catch (_: Exception) {
            // best effort; not critical
        }
    }
}
