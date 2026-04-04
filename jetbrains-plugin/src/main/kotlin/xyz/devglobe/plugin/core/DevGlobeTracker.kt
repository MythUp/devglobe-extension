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
import xyz.devglobe.plugin.settings.DevGlobeSettings
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean

class DevGlobeTracker : Disposable {

    private val LOG = Logger.getInstance(DevGlobeTracker::class.java)

    @Volatile private var state = TrackerState()
    @Volatile private var coreClient: CoreClient? = null
    private var currentApiKey: String? = null
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

    fun start(apiKey: String) {
        if (!started.compareAndSet(false, true)) return
        currentApiKey = apiKey
        val settings = DevGlobeSettings.getInstance()

        ApplicationManager.getApplication().executeOnPooledThread {
            val ok = ensureCore()
            if (!ok) {
                started.set(false)
                return@executeOnPooledThread
            }
            coreClient?.sendInit(apiKey, settings.state.shareRepo, settings.state.anonymousMode, settings.state.statusMessage)
            coreClient?.sendResume()
            ApplicationManager.getApplication().invokeLater { registerDocumentListener() }
        }
    }

    @Synchronized
    fun pause() {
        started.set(false)
        coreClient?.sendPause()
        state = state.copy(tracking = false)
        pushState()
    }

    @Synchronized
    fun stop() {
        started.set(false)
        coreClient?.sendPause()
        state = state.copy(tracking = false, connected = false)
        currentApiKey = null
        pushState()
    }

    @Synchronized
    fun reset() {
        started.set(false)
        coreClient?.sendShutdown()
        coreClient?.dispose()
        coreClient = null
        currentApiKey = null
        state = TrackerState()
        pushState()
    }

    @Synchronized
    fun restoreConnected(apiKey: String) {
        currentApiKey = apiKey
        val settings = DevGlobeSettings.getInstance()
        state = state.copy(
            connected = true,
            tracking = false,
            shareRepo = settings.state.shareRepo,
            anonymousMode = settings.state.anonymousMode,
            statusMessage = settings.state.statusMessage,
            error = null,
        )
        pushState()
    }

    @Synchronized
    fun setStatusMessage(message: String) {
        state = state.copy(statusMessage = message)
        pushState()
    }

    fun sendSetStatus(message: String) {
        ApplicationManager.getApplication().executeOnPooledThread {
            ensureCore()
            coreClient?.sendSetStatus(message)
        }
    }

    @Synchronized
    fun updatePreference(key: String, value: Boolean) {
        state = when (key) {
            "shareRepo" -> state.copy(shareRepo = value)
            "anonymousMode" -> state.copy(anonymousMode = value)
            else -> state
        }
        pushState()

        val client = coreClient
        when (key) {
            "shareRepo" -> client?.sendSetConfig(shareRepo = value, anonymousMode = null)
            "anonymousMode" -> client?.sendSetConfig(shareRepo = null, anonymousMode = value)
        }
    }

    @Synchronized
    private fun ensureCore(): Boolean {
        if (coreClient != null && coreClient!!.isAlive()) return true

        // Clean up dead client
        if (coreClient != null) {
            coreClient!!.dispose()
            coreClient = null
        }

        if (!CoreDownloader.isInstalled()) {
            LOG.info("devglobe-core not found, downloading...")
            notify("Downloading devglobe-core...", NotificationType.INFORMATION)

            val ok = CoreDownloader.download()
            if (!ok) {
                CoreDownloader.notifyDownloadFailed()
                state = state.copy(error = "Failed to download devglobe-core")
                pushState()
                return false
            }
            notify("devglobe-core downloaded successfully", NotificationType.INFORMATION)
        }

        val client = CoreClient(CoreDownloader.getBinaryPath())
        client.onState = { newState ->
            synchronized(this) { state = newState.copy(error = null) }
            pushState()
        }
        client.onOffline = { msg ->
            notify(msg, NotificationType.WARNING)
        }
        client.onOnline = { msg ->
            notify(msg, NotificationType.INFORMATION)
        }
        client.onStatusOk = { msg ->
            val text = if (msg.isNotEmpty()) "Status set to \"$msg\"" else "Status cleared"
            notify(text, NotificationType.INFORMATION)
        }
        client.onStatusError = { msg ->
            notify(msg, NotificationType.ERROR)
        }
        client.onError = { msg ->
            notify(msg, NotificationType.ERROR)
            synchronized(this) { state = state.copy(error = msg) }
            pushState()
        }
        client.onProcessDied = {
            LOG.warn("devglobe-core process died unexpectedly")
            synchronized(this) {
                coreClient = null
                started.set(false)
                state = state.copy(tracking = false, error = "devglobe-core stopped unexpectedly")
            }
            pushState()
            notify("DevGlobe tracking stopped — devglobe-core crashed", NotificationType.WARNING)
        }

        val ok = client.start()
        if (!ok) {
            state = state.copy(error = "Failed to start devglobe-core")
            pushState()
            return false
        }

        coreClient = client
        return true
    }

    private fun registerDocumentListener() {
        if (documentListener != null) return
        documentListener = object : DocumentListener {
            override fun documentChanged(event: DocumentEvent) {
                val project = LanguageService.getFocusedProject() ?: return
                val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return
                val file = editor.virtualFile ?: return
                val filePath = file.path
                val cwd = File(filePath).parent ?: return
                val language = file.fileType.name

                coreClient?.sendActivity(filePath, cwd, language)
            }
        }
        EditorFactory.getInstance().eventMulticaster.addDocumentListener(documentListener!!, this)
    }

    private fun pushState() {
        val snapshot = state.copy()
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

    override fun dispose() {
        coreClient?.dispose()
        coreClient = null
    }

    companion object {
        fun getInstance(): DevGlobeTracker =
            ApplicationManager.getApplication().getService(DevGlobeTracker::class.java)
    }
}
