package xyz.devglobe.plugin.core

import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.extensions.PluginId
import xyz.devglobe.plugin.auth.ApiKeyStorage
import xyz.devglobe.plugin.auth.ConfigWriter
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean

class DevGlobeTracker : Disposable {

    private val LOG = Logger.getInstance(DevGlobeTracker::class.java)

    @Volatile private var state = TrackerState()
    @Volatile private var coreClient: CoreClient? = null
    private val started = AtomicBoolean(false)
    private var documentListener: DocumentListener? = null
    private val stateListeners = CopyOnWriteArrayList<(TrackerState) -> Unit>()

    fun getState(): TrackerState = state.copy()

    fun addStateListener(listener: (TrackerState) -> Unit) {
        stateListeners.add(listener)
    }

    fun removeStateListener(listener: (TrackerState) -> Unit) {
        stateListeners.remove(listener)
    }

    /** Called when the user enters their API key. Writes to config.toml + OS keychain, then starts. */
    fun saveApiKeyAndStart(apiKey: String) {
        ConfigWriter.writeApiKey(apiKey)
        ApiKeyStorage.set(apiKey)
        start()
    }

    fun start() {
        if (!started.compareAndSet(false, true)) return

        updateState { it.copy(tracking = true) }

        ApplicationManager.getApplication().executeOnPooledThread {
            if (!ensureCore()) {
                started.set(false)
                updateState { it.copy(tracking = false) }
                return@executeOnPooledThread
            }
            coreClient?.sendInit(pluginVersion())
            coreClient?.sendResume()
            ApplicationManager.getApplication().invokeLater { registerDocumentListener() }
        }
    }

    fun pause() {
        started.set(false)
        coreClient?.sendPause()
        updateState { it.copy(tracking = false) }
    }

    fun reset() {
        started.set(false)
        coreClient?.sendShutdown()
        coreClient?.dispose()
        synchronized(this) { coreClient = null }
        ConfigWriter.clearApiKey()
        ApiKeyStorage.clear()
        updateState { TrackerState() }
    }

    fun restoreConnected() {
        updateState { it.copy(configured = true, tracking = false, error = null) }
    }

    fun sendSetStatus(message: String) {
        ApplicationManager.getApplication().executeOnPooledThread {
            ensureCore()
            coreClient?.sendSetStatus(message)
        }
    }

    @Synchronized
    private fun ensureCore(): Boolean {
        if (coreClient?.isAlive() == true) return true

        coreClient?.dispose()
        coreClient = null

        if (!CoreDownloader.isInstalled() && !downloadCore()) return false

        val client = CoreClient(CoreDownloader.getBinaryPath()).also(::wireCallbacks)
        if (!client.start()) {
            updateState { it.copy(error = "Failed to start devglobe-core") }
            return false
        }
        coreClient = client
        return true
    }

    private fun downloadCore(): Boolean {
        LOG.info("devglobe-core not found, downloading...")
        notify("Downloading devglobe-core...", NotificationType.INFORMATION)
        if (!CoreDownloader.download()) {
            CoreDownloader.notifyDownloadFailed()
            updateState { it.copy(error = "Failed to download devglobe-core") }
            return false
        }
        notify("devglobe-core downloaded successfully", NotificationType.INFORMATION)
        return true
    }

    private fun wireCallbacks(client: CoreClient) {
        client.onReady = { configured ->
            updateState { it.copy(configured = configured, error = null) }
        }
        client.onNotConfigured = {
            updateState { it.copy(configured = false, tracking = false) }
        }
        client.onInvalidApiKey = {
            LOG.warn("API key rejected by server (401), clearing local key")
            ApiKeyStorage.clear()
            ConfigWriter.clearApiKey()
            updateState { it.copy(configured = false, tracking = false) }
            notify(
                "Invalid API key. Please reconnect with a valid key from devglobe.app/dashboard/settings.",
                NotificationType.ERROR,
            )
        }
        client.onHeartbeatOk = { todaySeconds, language ->
            updateState {
                it.copy(
                    todaySeconds = todaySeconds,
                    codingTime = formatSeconds(todaySeconds),
                    language = language,
                    tracking = true,
                    offline = false,
                )
            }
        }
        client.onOffline = { updateState { it.copy(offline = true) } }
        client.onOnline = { updateState { it.copy(offline = false) } }
        client.onStatusOk = { notify("Status updated", NotificationType.INFORMATION) }
        client.onStatusError = { msg -> notify(msg, NotificationType.ERROR) }
        client.onError = { msg ->
            notify(msg, NotificationType.ERROR)
            updateState { it.copy(error = msg) }
        }
        client.onProcessDied = {
            LOG.warn("devglobe-core process died unexpectedly")
            synchronized(this) {
                coreClient = null
                started.set(false)
            }
            updateState { it.copy(tracking = false, error = "devglobe-core stopped unexpectedly") }
            notify("DevGlobe tracking stopped — devglobe-core crashed", NotificationType.WARNING)
        }
    }

    private fun registerDocumentListener() {
        if (documentListener != null) return
        val listener = object : DocumentListener {
            override fun documentChanged(event: DocumentEvent) {
                val project = LanguageService.getFocusedProject() ?: return
                val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return
                val file = editor.virtualFile ?: return
                coreClient?.sendActivity(file.path, LanguageService.detectLanguage(file))
            }
        }
        documentListener = listener
        EditorFactory.getInstance().eventMulticaster.addDocumentListener(listener, this)
    }

    private fun updateState(transform: (TrackerState) -> TrackerState) {
        val snapshot = synchronized(this) {
            state = transform(state)
            state.copy()
        }
        ApplicationManager.getApplication().invokeLater {
            for (listener in stateListeners) {
                listener(snapshot)
            }
        }
    }

    private fun notify(message: String, type: NotificationType) {
        ApplicationManager.getApplication().invokeLater {
            Notification("DevGlobe", "DevGlobe", message, type).notify(null)
        }
    }

    private fun pluginVersion(): String {
        return try {
            PluginManagerCore.getPlugin(PluginId.getId("xyz.devglobe.plugin"))?.version ?: "0.0.0"
        } catch (_: Exception) {
            "0.0.0"
        }
    }

    private fun formatSeconds(seconds: Int): String {
        val h = seconds / 3600
        val m = (seconds % 3600) / 60
        return if (h > 0) "${h}h ${m}m" else "${m}m"
    }

    override fun dispose() {
        coreClient?.dispose()
        coreClient = null
    }

    companion object {
        fun getInstance(): DevGlobeTracker =
            ApplicationManager.getApplication().getService(DevGlobeTracker::class.java)
    }
}
