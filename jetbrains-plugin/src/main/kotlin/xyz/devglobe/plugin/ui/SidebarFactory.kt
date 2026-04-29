package xyz.devglobe.plugin.ui

import com.intellij.ide.BrowserUtil
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import xyz.devglobe.plugin.core.DevGlobeTracker
import xyz.devglobe.plugin.core.TrackerState
import xyz.devglobe.plugin.settings.DevGlobeSettings

class SidebarFactory : ToolWindowFactory, DumbAware {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val tracker = DevGlobeTracker.getInstance()
        val panel = SidebarPanel()

        panel.listener = object : SidebarListener {
            override fun onConnect(apiKey: String) {
                tracker.saveApiKeyAndStart(apiKey)
                notify(project, "Connected! Click \"Start Tracking\" to go live.", NotificationType.INFORMATION)
            }

            override fun onDisconnect() {
                tracker.reset()
                notify(project, "Disconnected.", NotificationType.INFORMATION)
            }

            override fun onStartTracking() {
                val settings = DevGlobeSettings.getInstance()
                settings.state.trackingEnabled = true
                tracker.start()
                notify(project, "Tracking started.", NotificationType.INFORMATION)
            }

            override fun onStopTracking() {
                val settings = DevGlobeSettings.getInstance()
                settings.state.trackingEnabled = false
                tracker.pause()
                notify(project, "Tracking stopped.", NotificationType.INFORMATION)
            }

            override fun onSetStatus(message: String) {
                tracker.sendSetStatus(message)
            }

            override fun onOpenExternal(url: String) {
                BrowserUtil.browse(url)
            }
        }

        val stateListener: (TrackerState) -> Unit = { state -> panel.updateState(state) }
        tracker.addStateListener(stateListener)

        panel.updateState(tracker.getState())

        com.intellij.openapi.util.Disposer.register(toolWindow.disposable) {
            tracker.removeStateListener(stateListener)
        }

        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }

    private fun notify(project: Project, message: String, type: NotificationType) {
        Notification("DevGlobe", "DevGlobe", message, type).notify(project)
    }
}
