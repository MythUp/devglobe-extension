package xyz.devglobe.plugin.core

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ApplicationInfo
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter

class CoreClient(private val binaryPath: String) : Disposable {

    private val LOG = Logger.getInstance(CoreClient::class.java)

    private var process: Process? = null
    private var writer: BufferedWriter? = null
    private var readerThread: Thread? = null

    var onReady: ((Boolean) -> Unit)? = null
    var onNotConfigured: (() -> Unit)? = null
    var onHeartbeatOk: ((Int, String?) -> Unit)? = null
    var onOffline: (() -> Unit)? = null
    var onOnline: (() -> Unit)? = null
    var onStatusOk: (() -> Unit)? = null
    var onStatusError: ((String) -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onProcessDied: (() -> Unit)? = null

    fun start(): Boolean {
        if (process != null) return true
        try {
            val proc = ProcessBuilder(binaryPath, "daemon").redirectErrorStream(false).start()
            process = proc
            writer = BufferedWriter(OutputStreamWriter(proc.outputStream, Charsets.UTF_8))

            readerThread = Thread({ readLoop(proc) }, "DevGlobe-CoreReader").apply {
                isDaemon = true
                start()
            }

            LOG.info("Core daemon started: $binaryPath")
            return true
        } catch (e: Exception) {
            LOG.error("Failed to start core daemon: ${e.message}")
            onError?.invoke("Failed to start devglobe-core: ${e.message}")
            return false
        }
    }

    private fun readLoop(proc: Process) {
        try {
            BufferedReader(InputStreamReader(proc.inputStream, Charsets.UTF_8)).useLines { lines ->
                lines.forEach(::handleLine)
            }
        } catch (_: Exception) {
            // stream closed — fall through to onProcessDied
        }
        ApplicationManager.getApplication().invokeLater { onProcessDied?.invoke() }
    }

    fun isAlive(): Boolean = process?.isAlive == true

    fun sendInit(pluginVersion: String) {
        val params = JsonObject().apply {
            addProperty("plugin_version", pluginVersion)
            addProperty("editor", detectEditor())
        }
        send("init", params)
    }

    fun sendActivity(filePath: String, language: String?) {
        val params = JsonObject().apply {
            addProperty("file", filePath)
            language?.let { addProperty("language", it) }
        }
        send("activity", params)
    }

    fun sendSetStatus(message: String) {
        val params = JsonObject().apply {
            addProperty("message", message)
        }
        send("set_status", params)
    }

    fun sendPause() = send("pause", null)
    fun sendResume() = send("resume", null)
    fun sendShutdown() = send("shutdown", null)

    private fun send(method: String, params: JsonObject?) {
        try {
            val msg = JsonObject().apply {
                addProperty("method", method)
                if (params != null) add("params", params)
            }
            writer?.write(msg.toString())
            writer?.newLine()
            writer?.flush()
        } catch (e: Exception) {
            LOG.warn("Failed to send to core: ${e.message}")
        }
    }

    private fun handleLine(line: String) {
        try {
            val obj = JsonParser.parseString(line).asJsonObject
            val event = obj.get("event")?.asString ?: return
            val data = obj.getAsJsonObject("data")

            ApplicationManager.getApplication().invokeLater {
                when (event) {
                    "ready" -> {
                        val configured = data?.get("configured")?.asBoolean ?: false
                        onReady?.invoke(configured)
                    }
                    "not_configured" -> onNotConfigured?.invoke()
                    "heartbeat_ok" -> {
                        val todaySeconds = data?.get("today_seconds")?.asInt ?: 0
                        val language = data?.get("language")?.takeIf { !it.isJsonNull }?.asString
                        onHeartbeatOk?.invoke(todaySeconds, language)
                    }
                    "offline" -> onOffline?.invoke()
                    "online" -> onOnline?.invoke()
                    "status_ok" -> onStatusOk?.invoke()
                    "status_error" -> onStatusError?.invoke(data?.get("message")?.asString ?: "")
                }
            }
        } catch (e: Exception) {
            LOG.warn("Failed to parse core event: ${e.message}")
        }
    }

    private fun detectEditor(): String {
        val productCode = ApplicationInfo.getInstance().build.productCode
        return when (productCode) {
            "IC", "IU" -> "intellij"
            "WS" -> "webstorm"
            "PY", "PC", "PE" -> "pycharm"
            "GO" -> "goland"
            "PS" -> "phpstorm"
            "RM" -> "rubymine"
            "CL" -> "clion"
            "RD" -> "rider"
            "DB" -> "datagrip"
            "AI" -> "android-studio"
            "RR" -> "rustrover"
            else -> "jetbrains"
        }
    }

    override fun dispose() {
        try { sendShutdown() } catch (_: Exception) { }
        process?.destroyForcibly()
        process = null
        writer = null
    }
}
